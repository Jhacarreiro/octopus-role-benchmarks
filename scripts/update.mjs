import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fitCaiEstimator, predictCai, rowFromModelFamily, RIDGE_FEATURES, KNN_FEATURES, RIDGE_LAMBDA, KNN_K, CAI_BLEND, CODING_ROLE_CAI_WEIGHT } from './cai-estimator.mjs';
import { fitScicodeEstimator, predictScicode, validateScicodeEstimator, scicodeRowFromAa, isCompleteScicodeFeatureRow, SCICODE_FEATURES, SCICODE_RIDGE_LAMBDA, SCICODE_VALIDATION_LIMITS } from './scicode-estimator.mjs';
import { fetchArtificialAnalysisCyberIndex } from './aa-cyber-index.mjs';
import { planEconomics, planAdjustedTaskCost } from './lib/plan-economics.mjs';
import { applyBalancedScores } from './lib/balanced-score.mjs';
import { caiIndexPercent, detectCodingAgentVersionFromRows, detectCodingAgentVersionFromSnapshot, historicalCaiAnchor, calibrateHistoricalCai, applyHistoricalCai } from './lib/cai-version-fallback.mjs';
import { calibrateScicodeLkg, applyScicodeLkg } from './lib/scicode-lkg.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opencliHome=path.join(root,'.opencli-home');
const bin=path.join(root,'node_modules','.bin','opencli');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
const normalizedTaskProfile=roles.costBasis?.normalizedTask?.referenceTokenProfile;
if(!normalizedTaskProfile||['nonCacheInput','cacheRead','cacheWrite','output'].some(k=>!Number.isFinite(normalizedTaskProfile[k])))throw new Error('Missing normalized reference token profile');
const lineupPolicy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const economics=planEconomics(lineupPolicy);
const balancedWeights=lineupPolicy.modes?.balanced?.percentileWeights??{quality:0.75,affordability:0.25};
const aliases=JSON.parse(fs.readFileSync(path.join(root,'config','model-aliases.json'),'utf8')).aliases;
const benchmarkFallbacks=JSON.parse(fs.readFileSync(path.join(root,"config","benchmark-fallbacks.json"),"utf8"));
const previousSnapshotPath=path.join(root,"data","latest.json");
const previousSnapshot=fs.existsSync(previousSnapshotPath)?JSON.parse(fs.readFileSync(previousSnapshotPath,"utf8")):null;

function runOpenCLI(args){
  const r=spawnSync(bin,args,{cwd:root,env:{...process.env,HOME:opencliHome},encoding:'utf8',maxBuffer:40*1024*1024});
  if(r.status!==0) throw new Error(`opencli ${args.join(' ')} failed\n${r.stderr}\n${r.stdout}`);
  try{return JSON.parse(r.stdout.trim())}catch(e){throw new Error(`Invalid JSON from opencli ${args.join(' ')}: ${e.message}\n${r.stdout.slice(0,1200)}`)}
}
function normalize(value){return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+\(latest\)$/,'').replace(/\s+\(exp\)$/,'').replace(/\s+contributor$/,'').replace(/\s+highspeed$/,'').replace(/\s+fast$/,'').replace(/[^a-z0-9]+/g,'')}
function round(n,d=4){const p=10**d;return Math.round((n+Number.EPSILON)*p)/p}
function scaleBenchmark(key,model){const spec=roles.benchmarks[key];const v=model[spec.sourceField];const multiplier=spec.multiplier??100;const offset=spec.offset??0;return v==null?null:round(v*multiplier+offset,4)}
function tokenPriceBases(m){const input=m.inputPerM,output=m.outputPerM;return{input,output,cacheRead:m.cacheReadPerM??null,cacheWrite:m.cacheWritePerM??null,blended50:input==null||output==null?null:round((input+output)/2,6)}}
function repriceTask(tokens,row){
  if(!tokens||[tokens.nonCacheInput,tokens.cacheRead,tokens.cacheWrite,tokens.output].some(v=>v==null)) return null;
  const input=row.inputPerM,output=row.outputPerM;
  if(input==null||output==null) return null;
  const cacheRead=row.cacheReadPerM??input, cacheWrite=row.cacheWritePerM??input;
  return round((tokens.nonCacheInput*input+tokens.cacheRead*cacheRead+tokens.cacheWrite*cacheWrite+tokens.output*output)/1e6,6);
}
const codingHostAliases={
  'alibaba_cloud_qwen3-8-max-public':'qwen3-8-max',
  'deepseek_deepseek-v4-flash-0731':'deepseek-v4-flash',
  'deepseek_deepseek-v4-pro-1m':'deepseek-v4-pro',
  'deepseek_deepseek-v4-pro-0813':'deepseek-v4-pro',
  'google_andwise_ai-studio':'gemini-3-7-flash',
  'google_skimaki_ai-studio':'gemini-3-8-flash',
  'meta_spiffy-blimp350':'muse-spark-1-2',
  'meta_spiffy-blimp350-tbh-r708-1':'muse-spark-1-2',
  'meta_super-nova':'muse-spark-1-1',
  'meta_aa_glacier135':'muse-spark-1-3-xhigh',
  'meta_joyful-jello138':'muse-spark-1-3-xhigh',
  'openai_vega-alpha':'gpt-6-astra',
  'xai_grok-4-6-xhigh':'grok-4-6',
  'zai_glm-5-3':'glm-5-3',
  'cognition_fusion-gpt-6-astra-xhigh-sidekick-penguin-medium':'gpt-6-astra',
  'cognition_fusion-claude-fable-5-1-xhigh-sidekick-penguin-medium':'claude-fable-5-1'
};
function codingHostBase(host){
  if(codingHostAliases[host]) return codingHostAliases[host];
  let s=host;
  for(const p of ['alibaba_cloud_','anthropic_','deepseek_','friendliai_','google_','moonshot_','novita_','openai_','xai_']) if(s.startsWith(p)){s=s.slice(p.length);break}
  for(const suffix of ['_ai-studio','_fp8','_api-key']) if(s.endsWith(suffix)) s=s.slice(0,-suffix.length);
  return s;
}
function codingRank(r){return[(r.isHighlighted?1:0),(r.isDefault?1:0),r.indexScore??-1]}
function betterCoding(a,b){if(!a)return b;const A=codingRank(a),B=codingRank(b);for(let i=0;i<A.length;i++){if(B[i]>A[i])return b;if(B[i]<A[i])return a}return a}

const installer=spawnSync(process.execPath,[path.join(root,'scripts','install-opencli-adapters.mjs')],{cwd:root,env:{...process.env,OPENCLI_HOME:opencliHome},encoding:'utf8'});
if(installer.status!==0)throw new Error(installer.stderr||installer.stdout||'Adapter install failed');

const maxRows=runOpenCLI(['commandcode','max','-f','json']);
const catalog=runOpenCLI(['artificial-analysis','catalog','-f','json']);
const codingRows=runOpenCLI(['artificial-analysis','coding-agents','-f','json']);
const byNorm=new Map();
for(const row of catalog){const k=normalize(row.slug),list=byNorm.get(k)||[];list.push(row.slug);byNorm.set(k,list)}

const mapped=maxRows.map(row=>{
  const override=aliases[row.name];
  if(override){const meta={identityStatus:override.identityStatus??null,externalSource:override.externalSource??null,externalEvidence:override.externalEvidence??null};if(override.status==='unscored')return{...row,mapping:{status:'unscored',reason:override.reason,...meta}};return{...row,mapping:{status:override.status,slug:override.slug,reason:override.reason,...meta}}}
  const candidates=byNorm.get(normalize(row.name))||[];
  if(candidates.length===1)return{...row,mapping:{status:'exact',slug:candidates[0],reason:'Unique normalized match to AA canonical slug.'}};
  return{...row,mapping:{status:'unscored',reason:candidates.length?`Ambiguous AA identity: ${candidates.join(', ')}`:'No verified AA identity.'}}
});
const slugs=[...new Set(mapped.filter(x=>x.mapping.slug).map(x=>x.mapping.slug))].sort();
const mappedSlugSet=new Set(slugs);
const aaRows=runOpenCLI(['artificial-analysis','models',slugs.join(','),'-f','json']);
const aa=new Map(aaRows.map(x=>[x.slug,{...x}]));
if(aa.size!==slugs.length)throw new Error(`AA returned ${aa.size}/${slugs.length} requested families`);
const cyberIndexDataset=await fetchArtificialAnalysisCyberIndex();
const cyberIndexBySlug=cyberIndexDataset.bySlug;
const previousBySlug=new Map((previousSnapshot?.models||[]).filter(m=>m.aaModel?.slug).map(m=>[m.aaModel.slug,m]));
function previousObservedBenchmark(slug,key){
  // Snapshots produced before AA parser v2 used an unsafe forward slice that
  // could mix metrics from adjacent embedded model objects. Do not use them as
  // observed anchors for benchmark fallbacks.
  if(previousSnapshot?.sources?.artificialAnalysis?.parserVersion!==2)return null;
  const model=previousBySlug.get(slug);
  if(!model)return null;
  const provenance=model?.benchmarkProvenance?.[key];
  if(['estimated','historical_calibrated'].includes(provenance?.status)){
    const anchor=provenance.lastObserved;
    if(Number.isFinite(anchor?.value)&&anchor?.observedAt)return anchor;
    return null;
  }
  const value=model?.benchmarks?.[key];
  if(!Number.isFinite(value))return null;
  return {value,observedAt:previousSnapshot?.benchmarkGeneratedAt??previousSnapshot?.generatedAt??null};
}
function observedAnchorAgeDays(anchor){
  if(!anchor?.observedAt)return Infinity;
  return (Date.now()-new Date(anchor.observedAt).getTime())/86400000;
}
function eligibleObservedAnchor(anchor,maxAgeDays){
  const age=observedAnchorAgeDays(anchor);
  return Number.isFinite(anchor?.value)&&age>=0&&age<=maxAgeDays;
}
const scicodePolicy=benchmarkFallbacks.benchmarks?.scicode||{};
const observedRawScicodeBySlug=new Map([...aa.values()].map(m=>[m.slug,m.scicode]));
const scicodeRows=[...aa.values()].map(scicodeRowFromAa).filter(isCompleteScicodeFeatureRow);
const observedScicodeRows=scicodeRows.filter(r=>Number.isFinite(r.scicode));
const lastKnownMaxAgeDays=scicodePolicy.lastKnownMaxAgeDays??14;
const scicodeLkgPairs=observedScicodeRows.flatMap(row=>{const anchor=previousObservedBenchmark(row.slug,'scicode');return eligibleObservedAnchor(anchor,lastKnownMaxAgeDays)?[{slug:row.slug,previous:anchor.value,current:row.scicode}]:[];});
const scicodeLkgCalibration=calibrateScicodeLkg(scicodeLkgPairs);
const scicodeValidation=validateScicodeEstimator(observedScicodeRows);
const scicodeValidationErrors=[...scicodeValidation.errors].sort((a,b)=>b.error-a.error);
const scicodeWorst=scicodeValidationErrors[0]??null;
const scicodeEstimatorValid=scicodeValidation.mae<=SCICODE_VALIDATION_LIMITS.mae&&scicodeValidation.maxError<=SCICODE_VALIDATION_LIMITS.maxError;
const scicodeEstimator=scicodeEstimatorValid?fitScicodeEstimator(observedScicodeRows):null;
const benchmarkFallbacksApplied=[];
const validationIssues=[];
for(const row of scicodeRows){
  if(Number.isFinite(row.scicode))continue;
  const source=aa.get(row.slug);
  const lkgAnchor=previousObservedBenchmark(row.slug,'scicode');
  const calibratedLkg=eligibleObservedAnchor(lkgAnchor,lastKnownMaxAgeDays)?applyScicodeLkg(lkgAnchor,scicodeLkgCalibration):null;
  if(Number.isFinite(calibratedLkg)){
    const chosen=round(calibratedLkg,4);
    source.scicode=chosen/100;
    benchmarkFallbacksApplied.push({benchmark:'scicode',targetSlug:row.slug,strategy:'last_known_observed_calibrated',provenanceStatus:'historical_calibrated',value:chosen,lastObserved:{value:lkgAnchor.value,observedAt:lkgAnchor.observedAt,ageDays:round(observedAnchorAgeDays(lkgAnchor),3)},calibration:{method:scicodeLkgCalibration.method,factor:round(scicodeLkgCalibration.factor,6),rawMedianRatio:round(scicodeLkgCalibration.rawMedianRatio,6),overlap:scicodeLkgCalibration.overlap,mae:round(scicodeLkgCalibration.mae,4),maxError:round(scicodeLkgCalibration.maxError,4),maxAgeDays:lastKnownMaxAgeDays}});
    continue;
  }
  if(!scicodeEstimatorValid){
    const reason=`Artificial Analysis publishes no current SciCode for ${row.slug}; estimator fallback failed validation (MAE=${scicodeValidation.mae.toFixed(3)}, max=${scicodeValidation.maxError.toFixed(3)}).`;
    if(Number.isFinite(lkgAnchor?.value)&&lkgAnchor?.observedAt){
      const chosen=round(lkgAnchor.value,4);
      source.scicode=chosen/100;
      const issue={benchmark:'scicode',targetSlug:row.slug,status:'stale',reason,value:chosen,lastObserved:{value:chosen,observedAt:lkgAnchor.observedAt,ageDays:round(observedAnchorAgeDays(lkgAnchor),3)},maxFreshAgeDays:lastKnownMaxAgeDays};
      benchmarkFallbacksApplied.push({benchmark:'scicode',targetSlug:row.slug,strategy:'stale_last_observed',provenanceStatus:'stale',...issue});
      validationIssues.push(issue);
      continue;
    }
    const issue={benchmark:'scicode',targetSlug:row.slug,status:'unavailable',reason,lastObserved:null,maxFreshAgeDays:lastKnownMaxAgeDays};
    benchmarkFallbacksApplied.push({benchmark:'scicode',targetSlug:row.slug,strategy:'unavailable_after_validation_failure',provenanceStatus:'unavailable',...issue});
    validationIssues.push(issue);
    continue;
  }
  const estimate=round(predictScicode(scicodeEstimator,row),4);
  const candidates=[{kind:'ridge_current_peers',value:estimate}];

  const lastObservedTarget=lkgAnchor;
  const lastKnownTarget=null;

  const analogy=scicodePolicy.analogies?.[row.slug];
  let analogyValue=null,analogySourceMode=null,analogyObservedAt=null;
  if(analogy?.sourceSlug){
    const live=observedRawScicodeBySlug.get(analogy.sourceSlug);
    if(live!=null){
      analogyValue=round(live*100,4);
      analogySourceMode='live';
    } else {
      const priorAnchor=previousObservedBenchmark(analogy.sourceSlug,'scicode');
      if(eligibleObservedAnchor(priorAnchor,lastKnownMaxAgeDays)){
        analogyValue=priorAnchor.value;
        analogyObservedAt=priorAnchor.observedAt;
        analogySourceMode='previous_observed';
      }
    }
    if(Number.isFinite(analogyValue))candidates.push({kind:`analogy_${analogy.relationship||'related'}`,value:analogyValue});
  }

  let ceilingValue=null,ceilingSourceMode=null,ceilingObservedAt=null;
  if(analogy?.ceilingSlug){
    const live=observedRawScicodeBySlug.get(analogy.ceilingSlug);
    if(live!=null){
      ceilingValue=round(live*100,4);
      ceilingSourceMode='live';
    } else {
      const priorAnchor=previousObservedBenchmark(analogy.ceilingSlug,'scicode');
      if(eligibleObservedAnchor(priorAnchor,lastKnownMaxAgeDays)){
        ceilingValue=priorAnchor.value;
        ceilingObservedAt=priorAnchor.observedAt;
        ceilingSourceMode='previous_observed';
      }
    }
  }

  let chosen=(scicodePolicy.conservativeMin??true)?Math.min(...candidates.map(x=>x.value)):estimate;
  if(Number.isFinite(ceilingValue))chosen=Math.min(chosen,ceilingValue);
  chosen=round(chosen,4);
  source.scicode=chosen/100;
  benchmarkFallbacksApplied.push({
    benchmark:'scicode',
    targetSlug:row.slug,
    strategy:'validated_ridge_with_conservative_bounds',provenanceStatus:'estimated',
    estimate,
    lastKnownTarget:Number.isFinite(lastKnownTarget)?lastKnownTarget:null,
    lastObserved:lastObservedTarget?{
      value:lastObservedTarget.value,
      observedAt:lastObservedTarget.observedAt,
      ageDays:round(observedAnchorAgeDays(lastObservedTarget),3)
    }:null,
    analogy:analogy?.sourceSlug?{
      sourceSlug:analogy.sourceSlug,
      relationship:analogy.relationship||null,
      value:analogyValue,
      sourceMode:analogySourceMode,
      observedAt:analogyObservedAt
    }:null,
    ceiling:analogy?.ceilingSlug?{
      sourceSlug:analogy.ceilingSlug,
      relationship:analogy.relationship||null,
      value:ceilingValue,
      sourceMode:ceilingSourceMode,
      observedAt:ceilingObservedAt
    }:null,
    candidates,
    value:chosen
  });
}
const scicodeFallbackSlugs=new Set(benchmarkFallbacksApplied.filter(x=>x.benchmark==='scicode').map(x=>x.targetSlug));
const benchmarkFallbackBySlug=new Map();
for(const item of benchmarkFallbacksApplied){if(!benchmarkFallbackBySlug.has(item.targetSlug))benchmarkFallbackBySlug.set(item.targetSlug,{});benchmarkFallbackBySlug.get(item.targetSlug)[item.benchmark]=item;}


const activeBenchmarks=[...new Set(roles.roles.flatMap(r=>Object.keys(r.weights||{})))];
const sourceIncomplete=[];
for(const slug of slugs){
  const source=aa.get(slug);
  const missingBenchmarks=activeBenchmarks.filter(key=>source?.[roles.benchmarks[key].sourceField]==null);
  if(missingBenchmarks.length) sourceIncomplete.push({slug,missingBenchmarks});
}
const sourceIncompleteBySlug=new Map(sourceIncomplete.map(x=>[x.slug,x]));
const partialScoredBySlug=new Map(sourceIncomplete.filter(x=>x.missingBenchmarks.length>0&&x.missingBenchmarks.every(key=>key==='gdpval')).map(x=>[x.slug,x]));
const hardIncompleteBySlug=new Map(sourceIncomplete.filter(x=>!partialScoredBySlug.has(x.slug)).map(x=>[x.slug,x]));
const scoredSlugs=slugs.filter(slug=>!hardIncompleteBySlug.has(slug));
const scoredSlugSet=new Set(scoredSlugs);
if(!scoredSlugs.length)throw new Error('No scoreable AA families remain after source-completeness filtering');
const coverage={};
for(const key of activeBenchmarks){
  const field=roles.benchmarks[key].sourceField;
  const missing=scoredSlugs.filter(slug=>aa.get(slug)?.[field]==null);
  coverage[key]={field,total:scoredSlugs.length,present:scoredSlugs.length-missing.length,ratio:round((scoredSlugs.length-missing.length)/scoredSlugs.length,6),missing};
  const hardMissing=missing.filter(slug=>!partialScoredBySlug.has(slug));
  if(hardMissing.length)throw new Error(`Coverage failure ${key}/${field}: hard-missing ${hardMissing.join(', ')}`);
}
const efficiencyMissing=[];
const efficiencyCoverage={total:scoredSlugs.length,present:scoredSlugs.length,ratio:1,missing:[],basis:'normalized_reference_v1'};

const codingBySlug=new Map();
for(const row of codingRows){const base=codingHostBase(row.hostModelSlug);if(!scoredSlugSet.has(base))continue;codingBySlug.set(base,betterCoding(codingBySlug.get(base),row))}
const codingCoverage={total:scoredSlugs.length,present:codingBySlug.size,ratio:round(codingBySlug.size/scoredSlugs.length,6),missing:scoredSlugs.filter(s=>!codingBySlug.has(s))};
const codingAgentVersion=detectCodingAgentVersionFromRows(codingRows);
const previousCodingAgentVersion=detectCodingAgentVersionFromSnapshot(previousSnapshot);
const previousCodingObservedAt=previousSnapshot?.benchmarkGeneratedAt??previousSnapshot?.generatedAt??null;
const caiVersionCalibration=calibrateHistoricalCai({
  currentBySlug:codingBySlug,
  previousBySlug,
  previousSnapshotVersion:previousCodingAgentVersion,
  previousObservedAt:previousCodingObservedAt,
  currentVersion:codingAgentVersion
});
if(codingAgentVersion==='v1.5'&&!caiVersionCalibration.valid){
  throw new Error(`CAI version calibration failed: ${caiVersionCalibration.errors.join('; ')}`);
}

function benchmarksForSource(source){
  const out={};
  for(const key of activeBenchmarks) out[key]=scaleBenchmark(key,source);
  return out;
}
const caiEligibleSlugs=scoredSlugs.filter(slug=>!partialScoredBySlug.has(slug));
const familyRows=caiEligibleSlugs.map(slug=>{
  const source=aa.get(slug);
  const benchmarks=benchmarksForSource(source);
  const observed=codingBySlug.get(slug);
  return rowFromModelFamily(slug,benchmarks,source.intelligenceTask.tokens.output,observed?round(observed.indexScore*100,3):null);
});
const observedCaiRows=familyRows.filter(r=>r.cai!=null);
const caiEstimator=fitCaiEstimator(observedCaiRows);
const caiBySlug=new Map();
let caiHistoricalCalibratedFamilies=0;
let caiEstimatedFamilies=0;
for(const row of familyRows){
  const previousModel=previousBySlug.get(row.slug);
  const historicalAnchor=historicalCaiAnchor(previousModel,previousCodingAgentVersion,previousCodingObservedAt);
  if(row.cai!=null){
    caiBySlug.set(row.slug,{value:round(row.cai,3),source:'observed',version:codingAgentVersion,historicalAnchor});
    continue;
  }
  const migrated=applyHistoricalCai(historicalAnchor,caiVersionCalibration);
  if(Number.isFinite(migrated)){
    caiHistoricalCalibratedFamilies++;
    caiBySlug.set(row.slug,{
      value:round(migrated,3),
      source:'historical_calibrated',
      version:codingAgentVersion,
      historicalAnchor,
      calibration:{
        method:caiVersionCalibration.method,
        fromVersion:caiVersionCalibration.fromVersion,
        toVersion:caiVersionCalibration.toVersion,
        factor:round(caiVersionCalibration.factor,6),
        comparableFamilies:caiVersionCalibration.comparableFamilies,
        looMae:round(caiVersionCalibration.looMae,3),
        looMaxError:round(caiVersionCalibration.looMaxError,3)
      }
    });
    continue;
  }
  const pred=predictCai(caiEstimator,row);
  caiEstimatedFamilies++;
  caiBySlug.set(row.slug,{value:round(pred.estimate,3),source:'estimated',version:codingAgentVersion,ridge:round(pred.ridge,3),knn:round(pred.knn,3),historicalAnchor});
}
const caiStarCoverage={
  total:caiEligibleSlugs.length,
  present:caiBySlug.size,
  ratio:round(caiBySlug.size/Math.max(1,caiEligibleSlugs.length),6),
  observed:observedCaiRows.length,
  historicalCalibrated:caiHistoricalCalibratedFamilies,
  estimated:caiEstimatedFamilies
};
if(caiStarCoverage.present!==caiStarCoverage.total) throw new Error(`CAI* coverage failure: ${caiStarCoverage.present}/${caiStarCoverage.total}`);

const models=mapped.map(row=>{
  const rawSource=row.mapping.slug?aa.get(row.mapping.slug):null;
  const incomplete=row.mapping.slug?hardIncompleteBySlug.get(row.mapping.slug):null;
  const partial=row.mapping.slug?partialScoredBySlug.get(row.mapping.slug):null;
  const source=incomplete?null:rawSource;
  const mapping=incomplete?{...row.mapping,status:'source_incomplete',reason:`AA source incomplete for active methodology: ${incomplete.missingBenchmarks.join(', ')}`,missingBenchmarks:incomplete.missingBenchmarks}:partial?{...row.mapping,status:'partial_scored',reason:`Scored conservatively with unavailable benchmark: ${partial.missingBenchmarks.join(', ')}`,missingBenchmarks:partial.missingBenchmarks}:row.mapping;
  const benchmarks=source?benchmarksForSource(source):{};
  const cyberIndex=source?cyberIndexBySlug.get(source.slug):null;
  if(cyberIndex)benchmarks.cyberIndex=round(cyberIndex.value,3);
  const tokenPrices=tokenPriceBases(row);
  const observedTaskTokenProfile=source?.intelligenceTask?.tokens??null;
  const hasObservedTaskTokenProfile=observedTaskTokenProfile&&['nonCacheInput','cacheRead','cacheWrite','output'].every(k=>Number.isFinite(observedTaskTokenProfile[k]));
  const costTokenProfile=hasObservedTaskTokenProfile?observedTaskTokenProfile:normalizedTaskProfile;
  const costBasis=hasObservedTaskTokenProfile?'observed_aa_task_profile':'normalized_reference_v1';
  const taskCostUsd=source?repriceTask(costTokenProfile,row):null;
  const planAdjustedCostUsd=source?round(planAdjustedTaskCost(taskCostUsd,row,economics),6):null;
  const caiStar=source?caiBySlug.get(source.slug):null;
  const roleScores={};
  if(source){
    for(const role of roles.roles){
      if(role.externalBenchmark){
        const direct=benchmarks[role.externalBenchmark];
        if(direct==null)continue;
        const rankingQuality=round(direct,3);
        roleScores[role.id]={score:rankingQuality,rankingQuality,rankingValue:null};
        continue;
      }
      let score=0,availableWeight=0,totalWeight=0;
      const missingBenchmarks=[];
      for(const [key,w] of Object.entries(role.weights||{})){
        totalWeight+=w;
        const value=benchmarks[key];
        if(value==null){missingBenchmarks.push(key);continue}
        score+=value*w;availableWeight+=w;
      }
      score=round(score,3);
      let rankingQuality=score;
      let coverageWeight=availableWeight;
      const missingComponents=[...missingBenchmarks];
      if(role.codingAdjusted){
        if(caiStar){rankingQuality=round((1-CODING_ROLE_CAI_WEIGHT)*score+CODING_ROLE_CAI_WEIGHT*caiStar.value,3);coverageWeight=(1-CODING_ROLE_CAI_WEIGHT)*availableWeight+CODING_ROLE_CAI_WEIGHT}
        else{rankingQuality=round((1-CODING_ROLE_CAI_WEIGHT)*score,3);coverageWeight=(1-CODING_ROLE_CAI_WEIGHT)*availableWeight;missingComponents.push('caiStar')}
      }
      roleScores[role.id]={score,rankingQuality,rankingValue:null,status:missingComponents.length?'partial':'valid',coverageWeight:round(coverageWeight,4),missingComponents};
    }
  }
  const c=source?codingBySlug.get(source.slug):null;
  const codingAgent=c?{
    hostModelSlug:c.hostModelSlug,agent:c.agent,displayLabel:c.displayLabel,indexScore:round(caiIndexPercent(c.indexScore),3),
    evaluations:Object.fromEntries(Object.entries(c.evaluations||{}).map(([k,v])=>[k,round(caiIndexPercent(v),3)])),
    tokensPerTask:c.telemetry,totalTokensPerTask:c.telemetry?.totalTokens??null,timePerTaskSec:c.telemetry?.wallTimeSec??null,
    sourceUrl:c.sourceUrl,
    selection:{isHighlighted:c.isHighlighted,isDefault:c.isDefault,rule:'highlighted > default > highest index score'}
  }:null;
  const benchmarkFallback=benchmarkFallbackBySlug.get(row.mapping.slug)||{};
  const benchmarkProvenance={};
  for(const [key,fallback] of Object.entries(benchmarkFallback))benchmarkProvenance[key]={status:fallback.provenanceStatus??'estimated',...fallback};
  if(partial){for(const key of partial.missingBenchmarks)benchmarkProvenance[key]={status:'unavailable',benchmark:key,targetSlug:row.mapping.slug,reason:`Artificial Analysis publishes no current ${key} value for this mapped model; role scores use a conservative zero contribution for this component.`};}
  if(cyberIndex)benchmarkProvenance.cyberIndex={status:'observed',source:'Artificial Analysis Cyber Index v1',sourceUrl:cyberIndexDataset.sourceUrl,value:round(cyberIndex.value,3),components:Object.fromEntries(Object.entries(cyberIndex.components).map(([k,v])=>[k,v==null?null:round(v*100,3)])),safetyBlocks:Object.fromEntries(Object.entries(cyberIndex.safetyBlocks).map(([k,v])=>[k,v==null?null:round(v*100,3)]))};
  return{...row,mapping,benchmarkProvenance,tokenPrices,taskEfficiency:source?{commandCodeCostPerTaskUsd:taskCostUsd,planAdjustedCostPerTaskUsd:planAdjustedCostUsd,costBasis,costTokenProfile,normalizedTokenProfile:normalizedTaskProfile,observedTaskTokenProfile}:null,benchmarks,roleScores,caiStar,codingAgent,aaModel:rawSource?{slug:rawSource.slug,sourceUrl:rawSource.sourceUrl,intelligenceIndex:rawSource.intelligenceIndex??null}:null};
});
applyBalancedScores(models,roles.roles.map(r=>r.id),{qualityWeight:Number(balancedWeights.quality),costWeight:Number(balancedWeights.affordability)});
for(const m of models){for(const score of Object.values(m.roleScores||{})){if(Number.isFinite(score.rankingValue))score.rankingValue=round(score.rankingValue,3);if(Number.isFinite(score.balancedQualityPercentile))score.balancedQualityPercentile=round(score.balancedQualityPercentile,3);if(Number.isFinite(score.balancedAffordabilityPercentile))score.balancedAffordabilityPercentile=round(score.balancedAffordabilityPercentile,3);}}
const unscoredModels=models.filter(x=>x.mapping?.status==='unscored'||!x.aaModel);
for(const model of unscoredModels){
  validationIssues.push({benchmark:'mapping',targetModel:model.name,status:'unavailable',reason:model.mapping?.reason||'No verified benchmark identity for this CommandCode model.'});
}
for(const model of models.filter(x=>x.mapping?.status==='partial_scored')){for(const key of model.mapping.missingBenchmarks||[])validationIssues.push({benchmark:key,targetSlug:model.aaModel?.slug??model.mapping?.slug,status:'unavailable',reason:`Artificial Analysis publishes no current ${key} value; affected role scores are conservative partial scores.`});}
const missingTaskRows=models.filter(x=>x.mapping?.status!=='source_incomplete'&&x.aaModel&&x.taskEfficiency?.commandCodeCostPerTaskUsd==null);if(missingTaskRows.length)throw new Error(`CommandCode task repricing failed: ${missingTaskRows.map(x=>x.name).join(', ')}`);

const now=new Date(),nowIso=now.toISOString(),date=nowIso.slice(0,10);
const scicodeTopResiduals=scicodeValidationErrors.slice(0,5).map(x=>({slug:x.slug,actual:round(x.actual,4),predicted:round(x.predicted,4),error:round(x.error,4)}));
const snapshot={schemaVersion:6,methodologyVersion:roles.schemaVersion,date,generatedAt:nowIso,benchmarkDate:date,benchmarkGeneratedAt:nowIso,lineupInputsRefreshedAt:nowIso,validationStatus:validationIssues.length?'partial':'valid',validationIssues,costBasis:{id:'observed_or_normalized_v1',observedSource:'Artificial Analysis task token telemetry',fallback:'normalized_reference_v1',profileVersion:roles.costBasis.normalizedTask.profileVersion,referenceTokenProfile:normalizedTaskProfile,priceSource:'CommandCode',planAdjustment:'Max 10 base credits; model deal is represented once through CommandCode effective token prices',dealMetadata:'CommandCode pricing effective-usage multiplier and deal discount metadata'},sources:{commandCodeMax:{url:'https://commandcode.ai/docs/plans/max',pricingUrl:'https://commandcode.ai/pricing',pricingLimitsUrl:'https://commandcode.ai/docs/resources/pricing-limits',rows:maxRows.length,planEconomics:economics,billingCategories:{standard:maxRows.filter(x=>x.billingCategory==='standard').length,premium:maxRows.filter(x=>x.billingCategory==='premium').length,free:maxRows.filter(x=>x.billingCategory==='free').length}},artificialAnalysis:{url:'https://artificialanalysis.ai/',parserVersion:2,mappedFamilies:slugs.length,scoredFamilies:scoredSlugs.length,sourceIncompleteFamilies:sourceIncomplete.length},artificialAnalysisCyberIndex:{url:cyberIndexDataset.sourceUrl,fetchedAt:cyberIndexDataset.fetchedAt,version:cyberIndexDataset.version,directFamilies:[...slugs].filter(slug=>cyberIndexBySlug.has(slug)).length,availableRows:cyberIndexBySlug.size,components:['CWE-Bench-AA','DeepsecBench-AA','CyberGym-E2E-AA'],weighting:'equal thirds'},codingAgentIndex:{
  url:'https://artificialanalysis.ai/agents/coding-agents',
  version:codingAgentVersion,
  variants:codingRows.length,
  calibration:caiVersionCalibration.valid?{
    fromVersion:caiVersionCalibration.fromVersion,
    toVersion:caiVersionCalibration.toVersion,
    method:caiVersionCalibration.method,
    factor:round(caiVersionCalibration.factor,6),
    comparableFamilies:caiVersionCalibration.comparableFamilies,
    ratioMad:round(caiVersionCalibration.ratioMad,6),
    looMae:round(caiVersionCalibration.looMae,3),
    looMaxError:round(caiVersionCalibration.looMaxError,3)
  }:null
}},coveragePolicy:roles.coveragePolicy,benchmarkFallbacksApplied,scicodeEstimator:{method:'current_observed_then_calibrated_lkg_then_validated_ridge',lambda:SCICODE_RIDGE_LAMBDA,features:SCICODE_FEATURES,observedFamilies:observedScicodeRows.length,historicalCalibratedFamilies:benchmarkFallbacksApplied.filter(x=>x.strategy==='last_known_observed_calibrated').length,estimatedFamilies:benchmarkFallbacksApplied.filter(x=>x.provenanceStatus==='estimated').length,validatedAt:nowIso,sourceSnapshotGeneratedAt:nowIso,lkg:{maxAgeDays:lastKnownMaxAgeDays,calibration:{valid:scicodeLkgCalibration.valid,method:scicodeLkgCalibration.method,factor:scicodeLkgCalibration.factor==null?null:round(scicodeLkgCalibration.factor,6),rawMedianRatio:scicodeLkgCalibration.rawMedianRatio==null?null:round(scicodeLkgCalibration.rawMedianRatio,6),overlap:scicodeLkgCalibration.overlap,mae:scicodeLkgCalibration.mae==null?null:round(scicodeLkgCalibration.mae,4),maxError:scicodeLkgCalibration.maxError==null?null:round(scicodeLkgCalibration.maxError,4),failures:scicodeLkgCalibration.failures}},validation:{valid:scicodeEstimatorValid,mae:round(scicodeValidation.mae,4),maxError:round(scicodeValidation.maxError,4),limits:SCICODE_VALIDATION_LIMITS,worstResidual:scicodeTopResiduals[0]??null,topResiduals:scicodeTopResiduals}},sourceIncomplete,coverage,efficiencyCoverage,codingAgentCoverage:codingCoverage,caiStarCoverage,caiEstimator:{method:'50% ridge + 50% inverse-distance 5NN',ridge:{lambda:RIDGE_LAMBDA,features:RIDGE_FEATURES},knn:{k:KNN_K,features:KNN_FEATURES},blend:CAI_BLEND,codingRoleWeight:CODING_ROLE_CAI_WEIGHT,observedFamilies:observedCaiRows.length,historicalCalibratedFamilies:caiHistoricalCalibratedFamilies,estimatedFamilies:caiEstimatedFamilies},counts:{commandCodeRows:maxRows.length,mappedRows:models.filter(x=>x.aaModel).length,scoredRows:models.filter(x=>x.aaModel&&x.mapping?.status!=='source_incomplete').length,partialRows:models.filter(x=>x.mapping?.status==='unscored'||x.mapping?.status==='source_incomplete'||x.mapping?.status==='partial_scored'||Object.values(x.benchmarkProvenance||{}).some(v=>['stale','unavailable'].includes(v?.status))).length,partialScoredRows:models.filter(x=>x.mapping?.status==='partial_scored').length,sourceIncompleteRows:models.filter(x=>x.mapping?.status==='source_incomplete').length,unscoredRows:models.filter(x=>!x.aaModel).length,mappedFamilies:slugs.length,scoredFamilies:scoredSlugs.length,partialScoredFamilies:partialScoredBySlug.size,sourceIncompleteFamilies:hardIncompleteBySlug.size,codingAgentFamilies:codingBySlug.size,caiObservedFamilies:observedCaiRows.length,caiHistoricalCalibratedFamilies,caiEstimatedFamilies,cyberIndexDirectFamilies:[...slugs].filter(slug=>cyberIndexBySlug.has(slug)).length},benchmarks:roles.benchmarks,roles:roles.roles,models};
for(const dir of [path.join(root,'data'),path.join(root,'site','data')])fs.mkdirSync(dir,{recursive:true});
const json=JSON.stringify(snapshot,null,2)+'\n';fs.writeFileSync(path.join(root,'data',`${date}.json`),json);fs.writeFileSync(path.join(root,'data','latest.json'),json);fs.writeFileSync(path.join(root,'site','data','latest.json'),json);
console.log(JSON.stringify({date,...snapshot.counts,taskCoverage:`${efficiencyCoverage.present}/${efficiencyCoverage.total}`,codingAgentCoverage:`${codingCoverage.present}/${codingCoverage.total}`,caiStarCoverage:`${caiStarCoverage.present}/${caiStarCoverage.total}`,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,`${v.present}/${v.total}`])),unscored:models.filter(x=>!x.aaModel).map(x=>x.name)},null,2));
