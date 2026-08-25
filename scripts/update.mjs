import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fitCaiEstimator, predictCai, rowFromModelFamily, RIDGE_FEATURES, KNN_FEATURES, RIDGE_LAMBDA, KNN_K, CAI_BLEND, CODING_ROLE_CAI_WEIGHT } from './cai-estimator.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opencliHome=path.join(root,'.opencli-home');
const bin=path.join(root,'node_modules','.bin','opencli');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
const aliases=JSON.parse(fs.readFileSync(path.join(root,'config','model-aliases.json'),'utf8')).aliases;

function runOpenCLI(args){
  const r=spawnSync(bin,args,{cwd:root,env:{...process.env,HOME:opencliHome},encoding:'utf8',maxBuffer:40*1024*1024});
  if(r.status!==0) throw new Error(`opencli ${args.join(' ')} failed\n${r.stderr}\n${r.stdout}`);
  try{return JSON.parse(r.stdout.trim())}catch(e){throw new Error(`Invalid JSON from opencli ${args.join(' ')}: ${e.message}\n${r.stdout.slice(0,1200)}`)}
}
function normalize(value){return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+\(latest\)$/,'').replace(/\s+\(exp\)$/,'').replace(/\s+contributor$/,'').replace(/\s+highspeed$/,'').replace(/\s+fast$/,'').replace(/[^a-z0-9]+/g,'')}
function round(n,d=4){const p=10**d;return Math.round((n+Number.EPSILON)*p)/p}
function scaleBenchmark(key,model){const v=model[roles.benchmarks[key].sourceField];return v==null?null:round(v*100,4)}
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
const slugSet=new Set(slugs);
const aaRows=runOpenCLI(['artificial-analysis','models',slugs.join(','),'-f','json']);
const aa=new Map(aaRows.map(x=>[x.slug,x]));
if(aa.size!==slugs.length)throw new Error(`AA returned ${aa.size}/${slugs.length} requested families`);

const activeBenchmarks=[...new Set(roles.roles.flatMap(r=>Object.keys(r.weights)))];
const coverage={};
for(const key of activeBenchmarks){const field=roles.benchmarks[key].sourceField;const missing=slugs.filter(slug=>aa.get(slug)?.[field]==null);coverage[key]={field,total:slugs.length,present:slugs.length-missing.length,ratio:round((slugs.length-missing.length)/slugs.length,6),missing};if(missing.length)throw new Error(`Coverage failure ${key}/${field}: ${slugs.length-missing.length}/${slugs.length}; missing ${missing.join(', ')}`)}
const efficiencyMissing=slugs.filter(slug=>{const t=aa.get(slug)?.intelligenceTask?.tokens;return !t||[t.nonCacheInput,t.cacheRead,t.cacheWrite,t.output].some(v=>v==null)});
if(efficiencyMissing.length)throw new Error(`Per-task token coverage failure: ${slugs.length-efficiencyMissing.length}/${slugs.length}; missing ${efficiencyMissing.join(', ')}`);
const efficiencyCoverage={total:slugs.length,present:slugs.length-efficiencyMissing.length,ratio:round((slugs.length-efficiencyMissing.length)/slugs.length,6),missing:efficiencyMissing};

const codingBySlug=new Map();
for(const row of codingRows){const base=codingHostBase(row.hostModelSlug);if(!slugSet.has(base))continue;codingBySlug.set(base,betterCoding(codingBySlug.get(base),row))}
const codingCoverage={total:slugs.length,present:codingBySlug.size,ratio:round(codingBySlug.size/slugs.length,6),missing:slugs.filter(s=>!codingBySlug.has(s))};

function benchmarksForSource(source){
  const out={};
  for(const key of activeBenchmarks) out[key]=scaleBenchmark(key,source);
  return out;
}
const familyRows=slugs.map(slug=>{
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
const caiStarCoverage={total:slugs.length,present:caiBySlug.size,ratio:round(caiBySlug.size/slugs.length,6),observed:observedCaiRows.length,estimated:slugs.length-observedCaiRows.length};
if(caiStarCoverage.present!==caiStarCoverage.total) throw new Error(`CAI* coverage failure: ${caiStarCoverage.present}/${caiStarCoverage.total}`);

const models=mapped.map(row=>{
  const source=row.mapping.slug?aa.get(row.mapping.slug):null;
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
  return{...row,tokenPrices,taskEfficiency:source?{commandCodeCostPerTaskUsd:taskCostUsd,aaCostPerTaskUsd:source.intelligenceTask?.aaCostUsd?.total??null,tokens:source.intelligenceTask?.tokens??null}:null,benchmarks,roleScores,caiStar,codingAgent,aaModel:source?{slug:source.slug,sourceUrl:source.sourceUrl}:null};
});
const unexpectedUnscored=models.filter(x=>!x.aaModel&&!aliases[x.name]);if(unexpectedUnscored.length)throw new Error(`Unexpected unscored models: ${unexpectedUnscored.map(x=>x.name).join(', ')}`);
const missingTaskRows=models.filter(x=>x.aaModel&&x.taskEfficiency?.commandCodeCostPerTaskUsd==null);if(missingTaskRows.length)throw new Error(`CommandCode task repricing failed: ${missingTaskRows.map(x=>x.name).join(', ')}`);

const now=new Date(),date=now.toISOString().slice(0,10);
const snapshot={schemaVersion:4,methodologyVersion:roles.schemaVersion,date,generatedAt:now.toISOString(),sources:{commandCodeMax:{url:'https://commandcode.ai/docs/plans/max',rows:maxRows.length},artificialAnalysis:{url:'https://artificialanalysis.ai/',scoredFamilies:slugs.length},codingAgentIndex:{url:'https://artificialanalysis.ai/agents/coding-agents',variants:codingRows.length}},coveragePolicy:roles.coveragePolicy,coverage,efficiencyCoverage,codingAgentCoverage:codingCoverage,caiStarCoverage,caiEstimator:{method:'50% ridge + 50% inverse-distance 5NN',ridge:{lambda:RIDGE_LAMBDA,features:RIDGE_FEATURES},knn:{k:KNN_K,features:KNN_FEATURES},blend:CAI_BLEND,codingRoleWeight:CODING_ROLE_CAI_WEIGHT,observedFamilies:observedCaiRows.length,estimatedFamilies:slugs.length-observedCaiRows.length},counts:{commandCodeRows:maxRows.length,scoredRows:models.filter(x=>x.aaModel).length,unscoredRows:models.filter(x=>!x.aaModel).length,scoredFamilies:slugs.length,codingAgentFamilies:codingBySlug.size,caiObservedFamilies:observedCaiRows.length,caiEstimatedFamilies:slugs.length-observedCaiRows.length},benchmarks:roles.benchmarks,roles:roles.roles,models};
for(const dir of [path.join(root,'data'),path.join(root,'site','data')])fs.mkdirSync(dir,{recursive:true});
const json=JSON.stringify(snapshot,null,2)+'\n';fs.writeFileSync(path.join(root,'data',`${date}.json`),json);fs.writeFileSync(path.join(root,'data','latest.json'),json);fs.writeFileSync(path.join(root,'site','data','latest.json'),json);
console.log(JSON.stringify({date,...snapshot.counts,taskCoverage:`${efficiencyCoverage.present}/${efficiencyCoverage.total}`,codingAgentCoverage:`${codingCoverage.present}/${codingCoverage.total}`,caiStarCoverage:`${caiStarCoverage.present}/${caiStarCoverage.total}`,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,`${v.present}/${v.total}`])),unscored:models.filter(x=>!x.aaModel).map(x=>x.name)},null,2));
