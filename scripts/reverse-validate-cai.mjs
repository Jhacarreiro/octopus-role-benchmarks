import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitCaiEstimator, predictCai, rowFromModelFamily, CODING_ROLE_CAI_WEIGHT } from './cai-estimator.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data','latest.json'),'utf8'));

function mean(a){return a.reduce((x,y)=>x+y,0)/a.length}
function ranks(values){
  const order=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);
  const out=Array(values.length); let p=0;
  while(p<order.length){let q=p;while(q+1<order.length&&Math.abs(order[q+1].v-order[p].v)<1e-12)q++;const r=(p+q)/2+1;for(let j=p;j<=q;j++)out[order[j].i]=r;p=q+1}
  return out;
}
function pearson(a,b){const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y}return n/Math.sqrt(da*db)}
function pairwiseAccuracy(actual,pred){let good=0,total=0;for(let i=0;i<actual.length;i++)for(let j=i+1;j<actual.length;j++){const a=actual[i]-actual[j],p=pred[i]-pred[j];if(a===0||p===0)continue;total++;if(a*p>0)good++}return good/total}
function topKHit(actual,pred,k=5){const ai=actual.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]).slice(0,k).map(x=>x[1]);const pi=new Set(pred.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]).slice(0,k).map(x=>x[1]));return ai.filter(i=>pi.has(i)).length/k}
function metrics(actual,pred){
  const errors=actual.map((v,i)=>pred[i]-v);
  return {mae:mean(errors.map(Math.abs)),rmse:Math.sqrt(mean(errors.map(e=>e*e))),spearman:pearson(ranks(actual),ranks(pred)),pairwiseAccuracy:pairwiseAccuracy(actual,pred)};
}
function vendor(slug){
  for(const [prefix,name] of [['kimi-','Kimi'],['glm-','GLM'],['deepseek-','DeepSeek'],['qwen','Qwen'],['claude-','Claude'],['gpt-','GPT'],['gemini-','Gemini'],['muse-','Muse'],['grok-','Grok']]) if(slug.startsWith(prefix)) return name;
  return slug.split('-')[0];
}
function quantile(values,q){const a=[...values].sort((x,y)=>x-y);const x=(a.length-1)*q,lo=Math.floor(x),hi=Math.ceil(x);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(x-lo)}
function rng(seed=20260824){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296}}
function shuffleIndexes(n,random){const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

const familyBySlug=new Map();
for(const m of data.models){
  if(!m.aaModel||m.caiStar?.source!=='observed') continue;
  const slug=m.aaModel.slug;
  const prior=familyBySlug.get(slug);
  if(!prior){
    familyBySlug.set(slug,{slug,benchmarks:m.benchmarks,outputTokens:m.taskEfficiency.tokens.output,cai:m.caiStar.value,taskCost:m.taskEfficiency.commandCodeCostPerTaskUsd,roleScores:Object.fromEntries(data.roles.map(r=>[r.id,m.roleScores[r.id].score]))});
  }else{
    prior.taskCost=Math.min(prior.taskCost,m.taskEfficiency.commandCodeCostPerTaskUsd);
  }
}
const families=[...familyBySlug.values()].map(f=>({...f,...rowFromModelFamily(f.slug,f.benchmarks,f.outputTokens,f.cai)}));
if(families.length<8) throw new Error(`Not enough observed CAI families for validation: ${families.length}`);

const actual=[],ridgePred=[],knnPred=[],ensemblePred=[],vendorPrediction=new Map();
for(const g of [...new Set(families.map(f=>vendor(f.slug)))].sort()){
  const train=families.filter(f=>vendor(f.slug)!==g),test=families.filter(f=>vendor(f.slug)===g);
  const estimator=fitCaiEstimator(train);
  for(const t of test){const p=predictCai(estimator,t);actual.push(t.cai);ridgePred.push(p.ridge);knnPred.push(p.knn);ensemblePred.push(p.estimate);vendorPrediction.set(t.slug,p.estimate)}
}
const vendorHoldout={
  n:families.length,
  groups:[...new Set(families.map(f=>vendor(f.slug)))].length,
  ridge:metrics(actual,ridgePred),
  knn:metrics(actual,knnPred),
  ensemble:metrics(actual,ensemblePred)
};

const random=rng(); const reps=[];
for(let rep=0;rep<500;rep++){
  const idx=shuffleIndexes(families.length,random);const n=Math.max(5,Math.round(families.length*0.30));const testSet=new Set(idx.slice(0,n));
  const train=families.filter((_,i)=>!testSet.has(i)),test=families.filter((_,i)=>testSet.has(i));const estimator=fitCaiEstimator(train);
  const a=test.map(t=>t.cai),p=test.map(t=>predictCai(estimator,t).estimate);reps.push(metrics(a,p));
}
const randomHoldout={repetitions:500,testFraction:0.30,mae:{median:quantile(reps.map(x=>x.mae),0.5),p90:quantile(reps.map(x=>x.mae),0.9)},spearman:{median:quantile(reps.map(x=>x.spearman),0.5),p10:quantile(reps.map(x=>x.spearman),0.1)},pairwiseAccuracy:{median:quantile(reps.map(x=>x.pairwiseAccuracy),0.5)}};

const finalRanking={};
for(const roleId of ['implementer','implementer-heavy','code-reviewer']){
  const a=[],p=[];let qerr=0;
  for(const f of families){
    const base=f.roleScores[roleId],pred=vendorPrediction.get(f.slug);
    const qa=(1-CODING_ROLE_CAI_WEIGHT)*base+CODING_ROLE_CAI_WEIGHT*f.cai;
    const qp=(1-CODING_ROLE_CAI_WEIGHT)*base+CODING_ROLE_CAI_WEIGHT*pred;
    a.push(qa/f.taskCost);p.push(qp/f.taskCost);qerr+=Math.abs(qp-qa);
  }
  const m=metrics(a,p);
  finalRanking[roleId]={...m,top5Hit:topKHit(a,p,5),qualityMae:qerr/families.length};
}

const result={schemaVersion:1,date:data.date,observedFamilies:families.length,method:'50% ridge + 50% inverse-distance 5NN',vendorHoldout,randomHoldout,finalRanking,guardrails:{ensembleMaeMax:8,ensembleSpearmanMin:0.70,finalRankingSpearmanMin:0.95,finalRankingTop5HitMin:0.80}};
const g=result.guardrails;
if(vendorHoldout.ensemble.mae>g.ensembleMaeMax) throw new Error(`CAI estimator MAE guardrail failed: ${vendorHoldout.ensemble.mae}`);
if(vendorHoldout.ensemble.spearman<g.ensembleSpearmanMin) throw new Error(`CAI estimator Spearman guardrail failed: ${vendorHoldout.ensemble.spearman}`);
for(const [role,m] of Object.entries(finalRanking)){
  if(m.spearman<g.finalRankingSpearmanMin) throw new Error(`${role} ranking Spearman guardrail failed: ${m.spearman}`);
  if(m.top5Hit<g.finalRankingTop5HitMin) throw new Error(`${role} top-5 guardrail failed: ${m.top5Hit}`);
}
function r(n,d=3){return Number(n.toFixed(d))}
const clean=JSON.parse(JSON.stringify(result,(k,v)=>typeof v==='number'?r(v,4):v));
fs.writeFileSync(path.join(root,'data','cai-validation.json'),JSON.stringify(clean,null,2)+'\n');
fs.mkdirSync(path.join(root,'site','data'),{recursive:true});
fs.writeFileSync(path.join(root,'site','data','cai-validation.json'),JSON.stringify(clean,null,2)+'\n');
const e=clean.vendorHoldout.ensemble,rr=clean.randomHoldout;
const lines=[
  '# CAI estimation — reverse validation','',
  `Snapshot: **${data.date}**`,`Observed Coding Agent families: **${families.length}**`,'',
  '## Selected estimator','',
  '`CAI* estimate = 50% Ridge + 50% inverse-distance 5-nearest-neighbours`.','',
  '- Ridge: λ=1; SciCode, GPQA, HLE, LCR, GDPval, AA-Omniscience Index (normalized to 0–100), log(Output Tokens/Task).',
  '- 5NN: SciCode, GPQA, HLE, LCR; standardized features; Euclidean distance; inverse-distance weighting.',
  '- Production coding-role blend: `2/3 universal role score + 1/3 CAI*`.','',
  '## Leave-one-vendor-out','',
  'An entire vendor/family group is removed from training before predicting it. This is deliberately harder than normal random cross-validation.','',
  '| Method | MAE | RMSE | Spearman | Pairwise accuracy |','|---|---:|---:|---:|---:|',
  `| Ridge | ${r(clean.vendorHoldout.ridge.mae,2)} | ${r(clean.vendorHoldout.ridge.rmse,2)} | ${r(clean.vendorHoldout.ridge.spearman,3)} | ${r(clean.vendorHoldout.ridge.pairwiseAccuracy*100,1)}% |`,
  `| 5NN | ${r(clean.vendorHoldout.knn.mae,2)} | ${r(clean.vendorHoldout.knn.rmse,2)} | ${r(clean.vendorHoldout.knn.spearman,3)} | ${r(clean.vendorHoldout.knn.pairwiseAccuracy*100,1)}% |`,
  `| **50/50 ensemble** | **${r(e.mae,2)}** | **${r(e.rmse,2)}** | **${r(e.spearman,3)}** | **${r(e.pairwiseAccuracy*100,1)}%** |`,'',
  '## Random 30% holdout × 500','',
  `- MAE median: **${r(rr.mae.median,2)}**; p90: **${r(rr.mae.p90,2)}**.`,
  `- Spearman median: **${r(rr.spearman.median,3)}**; p10: **${r(rr.spearman.p10,3)}**.`,
  `- Pairwise ranking accuracy median: **${r(rr.pairwiseAccuracy.median*100,1)}%**.`,'',
  '## Effect on final ranking','',
  'For each observed family, the real CAI is hidden using leave-one-vendor-out; the estimated CAI is then inserted into the production `2/3 + 1/3` quality formula.','',
  '| Role | Spearman | Pairwise accuracy | Top-5 recovered | Quality MAE |','|---|---:|---:|---:|---:|',
  ...Object.entries(clean.finalRanking).map(([role,m])=>`| ${role} | ${r(m.spearman,3)} | ${r(m.pairwiseAccuracy*100,1)}% | ${r(m.top5Hit*100,0)}% | ${r(m.qualityMae,2)} |`),'',
  '## Guardrails','',
  'The daily pipeline fails closed if leave-one-vendor-out ensemble MAE rises above 8, estimator Spearman falls below 0.70, or any coding-role final-ranking Spearman falls below 0.95 / top-5 recovery below 80%.',''
];
fs.writeFileSync(path.join(root,'methodology','cai-estimation-validation.md'),lines.join('\n'));
console.log(JSON.stringify(clean,null,2));
