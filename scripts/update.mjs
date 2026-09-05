import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fitCaiEstimator, predictCai, rowFromModelFamily, RIDGE_FEATURES, KNN_FEATURES, RIDGE_LAMBDA, KNN_K, CAI_BLEND, CODING_ROLE_CAI_WEIGHT } from './cai-estimator.mjs';
import { fitScicodeEstimator, predictScicode, validateScicodeEstimator, scicodeRowFromAa, isCompleteScicodeFeatureRow, SCICODE_FEATURES, SCICODE_RIDGE_LAMBDA, SCICODE_VALIDATION_LIMITS } from './scicode-estimator.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opencliHome=path.join(root,'.opencli-home');
const bin=path.join(root,'node_modules','.bin','opencli');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
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
function tokenPriceBases(m){const input=m.inputPerM,output=m.outputPerM;return{input,output,blended50:input==null||output==null?null:round((input+output)/2,6)}}
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
  'google_andwise_ai-studio':'gemini-3-7-flash',
  'meta_spiffy-blimp350':'muse-spark-1-2',
  'meta_spiffy-blimp350-tbh-r708-1':'muse-spark-1-2',
  'meta_super-nova':'muse-spark-1-1'
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
  if(override){if(override.status==='unscored')return{...row,mapping:{status:'unscored',reason:override.reason}};return{...row,mapping:{status:override.status,slug:override.slug,reason:override.reason}}}
  const candidates=byNorm.get(normalize(row.name))||[];
  if(candidates.length===1)return{...row,mapping:{status:'exact',slug:candidates[0],reason:'Unique normalized match to AA canonical slug.'}};
  return{...row,mapping:{status:'unscored',reason:candidates.length?`Ambiguous AA identity: ${candidates.join(', ')}`:'No verified AA identity.'}}
});
const slugs=[...new Set(mapped.filter(x=>x.mapping.slug).map(x=>x.mapping.slug))].sort();
const mappedSlugSet=new Set(slugs);
const aaRows=runOpenCLI(['artificial-analysis','models',slugs.join(','),'-f','json']);
const aa=new Map(aaRows.map(x=>[x.slug,{...x}]));
if(aa.size!==slugs.length)throw new Error(`AA returned ${aa.size}/${slugs.length} requested families`);
const previousBySlug=new Map((previousSnapshot?.models||[]).filter(m=>m.aaModel?.slug).map(m=>[m.aaModel.slug,m]));
function previousObservedBenchmark(slug,key){
  const model=previousBySlug.get(slug);
  if(!model)return null;
  const provenance=model?.benchmarkProvenance?.[key];
  if(provenance?.status==='estimated'){
    const anchor=provenance.lastObserved;
    if(Number.isFinite(anchor?.value)&&anchor?.observedAt)return anchor;
    return null;
  }
  const value=model?.benchmarks?.[key];
  if(!Number.isFinite(value))return null;
  return {value,observedAt:previousSnapshot?.generatedAt??null};
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
const scicodeValidation=validateScicodeEstimator(observedScicodeRows);
if(scicodeValidation.mae>SCICODE_VALIDATION_LIMITS.mae||scicodeValidation.maxError>SCICODE_VALIDATION_LIMITS.maxError){
  throw new Error(`SciCode estimator validation failed: MAE ${scicodeValidation.mae.toFixed(3)} max ${scicodeValidation.maxError.toFixed(3)}`);
}
const scicodeEstimator=fitScicodeEstimator(observedScicodeRows);
const lastKnownMaxAgeDays=scicodePolicy.lastKnownMaxAgeDays??7;
const benchmarkFallbacksApplied=[];
for(const row of scicodeRows){
  if(Number.isFinite(row.scicode))continue;
  const source=aa.get(row.slug);
  const estimate=round(predictScicode(scicodeEstimator,row),4);
  const candidates=[{kind:'ridge_current_peers',value:estimate}];

  const lastObservedTarget=previousObservedBenchmark(row.slug,'scicode');
  const lastKnownTarget=eligibleObservedAnchor(lastObservedTarget,lastKnownMaxAgeDays)?lastObservedTarget.value:null;
  if(Number.isFinite(lastKnownTarget))candidates.push({kind:'last_known_target',value:lastKnownTarget});

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
    strategy:'ridge_with_conservative_bounds',
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
const benchmarkFallbackBySlug=new Map(benchmarkFallbacksApplied.map(x=>[x.targetSlug,x]));

const activeBenchmarks=[...new Set(roles.roles.flatMap(r=>Object.keys(r.weights)))];
const sourceIncomplete=[];
for(const slug of slugs){
  const source=aa.get(slug);
  const missingBenchmarks=activeBenchmarks.filter(key=>source?.[roles.benchmarks[key].sourceField]==null);
  const t=source?.intelligenceTask?.tokens;
  const missingTaskTokens=!t||[t.nonCacheInput,t.cacheRead,t.cacheWrite,t.output].some(v=>v==null);
  if(missingBenchmarks.length||missingTaskTokens) sourceIncomplete.push({slug,missingBenchmarks,missingTaskTokens});
}
const sourceIncompleteBySlug=new Map(sourceIncomplete.map(x=>[x.slug,x]));
const scoredSlugs=slugs.filter(slug=>!sourceIncompleteBySlug.has(slug));
const scoredSlugSet=new Set(scoredSlugs);
if(!scoredSlugs.length)throw new Error('No fully covered AA families remain after source-completeness filtering');
const coverage={};
for(const key of activeBenchmarks){const field=roles.benchmarks[key].sourceField;const missing=scoredSlugs.filter(slug=>aa.get(slug)?.[field]==null);coverage[key]={field,total:scoredSlugs.length,present:scoredSlugs.length-missing.length,ratio:round((scoredSlugs.length-missing.length)/scoredSlugs.length,6),missing};if(missing.length)throw new Error(`Coverage failure ${key}/${field}: ${scoredSlugs.length-missing.length}/${scoredSlugs.length}; missing ${missing.join(', ')}`)}
const efficiencyMissing=scoredSlugs.filter(slug=>{const t=aa.get(slug)?.intelligenceTask?.tokens;return !t||[t.nonCacheInput,t.cacheRead,t.cacheWrite,t.output].some(v=>v==null)});
if(efficiencyMissing.length)throw new Error(`Per-task token coverage failure: ${scoredSlugs.length-efficiencyMissing.length}/${scoredSlugs.length}; missing ${efficiencyMissing.join(', ')}`);
const efficiencyCoverage={total:scoredSlugs.length,present:scoredSlugs.length-efficiencyMissing.length,ratio:round((scoredSlugs.length-efficiencyMissing.length)/scoredSlugs.length,6),missing:efficiencyMissing};

const codingBySlug=new Map();
for(const row of codingRows){const base=codingHostBase(row.hostModelSlug);if(!scoredSlugSet.has(base))continue;codingBySlug.set(base,betterCoding(codingBySlug.get(base),row))}
const codingCoverage={total:scoredSlugs.length,present:codingBySlug.size,ratio:round(codingBySlug.size/scoredSlugs.length,6),missing:scoredSlugs.filter(s=>!codingBySlug.has(s))};

function benchmarksForSource(source){
  const out={};
  for(const key of activeBenchmarks) out[key]=scaleBenchmark(key,source);
  return out;
}
const familyRows=scoredSlugs.map(slug=>{
  const source=aa.get(slug);
  const benchmarks=benchmarksForSource(source);
  const observed=codingBySlug.get(slug);
  return rowFromModelFamily(slug,benchmarks,source.intelligenceTask.tokens.output,observed?round(observed.indexScore*100,3):null);
});
const observedCaiRows=familyRows.filter(r=>r.cai!=null);
const caiEstimator=fitCaiEstimator(observedCaiRows);
const caiBySlug=new Map();
for(const row of familyRows){
  if(row.cai!=null){
    caiBySlug.set(row.slug,{value:round(row.cai,3),source:'observed'});
  }else{
    const pred=predictCai(caiEstimator,row);
    caiBySlug.set(row.slug,{value:round(pred.estimate,3),source:'estimated',ridge:round(pred.ridge,3),knn:round(pred.knn,3)});
  }
}
const caiStarCoverage={total:scoredSlugs.length,present:caiBySlug.size,ratio:round(caiBySlug.size/scoredSlugs.length,6),observed:observedCaiRows.length,estimated:scoredSlugs.length-observedCaiRows.length};
if(caiStarCoverage.present!==caiStarCoverage.total) throw new Error(`CAI* coverage failure: ${caiStarCoverage.present}/${caiStarCoverage.total}`);

const models=mapped.map(row=>{
  const rawSource=row.mapping.slug?aa.get(row.mapping.slug):null;
  const incomplete=row.mapping.slug?sourceIncompleteBySlug.get(row.mapping.slug):null;
  const source=incomplete?null:rawSource;
  const mapping=incomplete?{...row.mapping,status:'source_incomplete',reason:`AA source incomplete for active methodology: ${[...incomplete.missingBenchmarks,incomplete.missingTaskTokens?'taskTokens':null].filter(Boolean).join(', ')}`,missingBenchmarks:incomplete.missingBenchmarks,missingTaskTokens:incomplete.missingTaskTokens}:row.mapping;
  const benchmarks=source?benchmarksForSource(source):{};
  const tokenPrices=tokenPriceBases(row);
  const taskCostUsd=source?repriceTask(source.intelligenceTask?.tokens,row):null;
  const caiStar=source?caiBySlug.get(source.slug):null;
  const roleScores={};
  if(source){
    for(const role of roles.roles){
      let score=0;
      for(const [key,w] of Object.entries(role.weights)) score+=benchmarks[key]*w;
      score=round(score,3);
      const rankingQuality=role.codingAdjusted?round((1-CODING_ROLE_CAI_WEIGHT)*score+CODING_ROLE_CAI_WEIGHT*caiStar.value,3):score;
      const rankingValue=taskCostUsd===0||taskCostUsd==null?null:round(rankingQuality/taskCostUsd,3);
      roleScores[role.id]={score,rankingQuality,rankingValue};
    }
  }
  const c=source?codingBySlug.get(source.slug):null;
  const codingAgent=c?{
    hostModelSlug:c.hostModelSlug,agent:c.agent,displayLabel:c.displayLabel,indexScore:round(c.indexScore*100,3),
    evaluations:Object.fromEntries(Object.entries(c.evaluations||{}).map(([k,v])=>[k,round(v*100,3)])),
    tokensPerTask:c.telemetry,totalTokensPerTask:c.telemetry?.totalTokens??null,timePerTaskSec:c.telemetry?.wallTimeSec??null,
    aaCostPerTaskUsd:c.telemetry?.costUsd??null,sourceUrl:c.sourceUrl,
    selection:{isHighlighted:c.isHighlighted,isDefault:c.isDefault,rule:'highlighted > default > highest index score'}
  }:null;
  if(codingAgent?.aaCostPerTaskUsd>0)codingAgent.aaValuePerDollar=round(codingAgent.indexScore/codingAgent.aaCostPerTaskUsd,3);
  return{...row,mapping,benchmarkProvenance:benchmarkFallbackBySlug.has(row.mapping.slug)?{scicode:{status:'estimated',...benchmarkFallbackBySlug.get(row.mapping.slug)}}:{},tokenPrices,taskEfficiency:source?{commandCodeCostPerTaskUsd:taskCostUsd,aaCostPerTaskUsd:source.intelligenceTask?.aaCostUsd?.total??null,tokens:source.intelligenceTask?.tokens??null}:null,benchmarks,roleScores,caiStar,codingAgent,aaModel:rawSource?{slug:rawSource.slug,sourceUrl:rawSource.sourceUrl}:null};
});
const unexpectedUnscored=models.filter(x=>!x.aaModel&&!aliases[x.name]);if(unexpectedUnscored.length)throw new Error(`Unexpected unscored models: ${unexpectedUnscored.map(x=>x.name).join(', ')}`);
const missingTaskRows=models.filter(x=>x.mapping?.status!=='source_incomplete'&&x.aaModel&&x.taskEfficiency?.commandCodeCostPerTaskUsd==null);if(missingTaskRows.length)throw new Error(`CommandCode task repricing failed: ${missingTaskRows.map(x=>x.name).join(', ')}`);

const now=new Date(),date=now.toISOString().slice(0,10);
const snapshot={schemaVersion:5,methodologyVersion:roles.schemaVersion,date,generatedAt:now.toISOString(),sources:{commandCodeMax:{url:'https://commandcode.ai/docs/plans/max',rows:maxRows.length},artificialAnalysis:{url:'https://artificialanalysis.ai/',mappedFamilies:slugs.length,scoredFamilies:scoredSlugs.length,sourceIncompleteFamilies:sourceIncomplete.length},codingAgentIndex:{url:'https://artificialanalysis.ai/agents/coding-agents',variants:codingRows.length}},coveragePolicy:roles.coveragePolicy,benchmarkFallbacksApplied,scicodeEstimator:{method:'ridge_from_independent_AA_benchmarks_with_conservative_bounds',lambda:SCICODE_RIDGE_LAMBDA,features:SCICODE_FEATURES,observedFamilies:observedScicodeRows.length,estimatedFamilies:benchmarkFallbacksApplied.length,validation:{mae:round(scicodeValidation.mae,4),maxError:round(scicodeValidation.maxError,4),limits:SCICODE_VALIDATION_LIMITS}},sourceIncomplete,coverage,efficiencyCoverage,codingAgentCoverage:codingCoverage,caiStarCoverage,caiEstimator:{method:'50% ridge + 50% inverse-distance 5NN',ridge:{lambda:RIDGE_LAMBDA,features:RIDGE_FEATURES},knn:{k:KNN_K,features:KNN_FEATURES},blend:CAI_BLEND,codingRoleWeight:CODING_ROLE_CAI_WEIGHT,observedFamilies:observedCaiRows.length,estimatedFamilies:scoredSlugs.length-observedCaiRows.length},counts:{commandCodeRows:maxRows.length,mappedRows:models.filter(x=>x.aaModel).length,scoredRows:models.filter(x=>x.aaModel&&x.mapping?.status!=='source_incomplete').length,sourceIncompleteRows:models.filter(x=>x.mapping?.status==='source_incomplete').length,unscoredRows:models.filter(x=>!x.aaModel).length,mappedFamilies:slugs.length,scoredFamilies:scoredSlugs.length,sourceIncompleteFamilies:sourceIncomplete.length,codingAgentFamilies:codingBySlug.size,caiObservedFamilies:observedCaiRows.length,caiEstimatedFamilies:scoredSlugs.length-observedCaiRows.length},benchmarks:roles.benchmarks,roles:roles.roles,models};
for(const dir of [path.join(root,'data'),path.join(root,'site','data')])fs.mkdirSync(dir,{recursive:true});
const json=JSON.stringify(snapshot,null,2)+'\n';fs.writeFileSync(path.join(root,'data',`${date}.json`),json);fs.writeFileSync(path.join(root,'data','latest.json'),json);fs.writeFileSync(path.join(root,'site','data','latest.json'),json);
console.log(JSON.stringify({date,...snapshot.counts,taskCoverage:`${efficiencyCoverage.present}/${efficiencyCoverage.total}`,codingAgentCoverage:`${codingCoverage.present}/${codingCoverage.total}`,caiStarCoverage:`${caiStarCoverage.present}/${caiStarCoverage.total}`,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,`${v.present}/${v.total}`])),unscored:models.filter(x=>!x.aaModel).map(x=>x.name)},null,2));
