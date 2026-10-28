import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildRoleSnapshot,scoreRole,validateRoleSnapshot} from './lib/role-scoring.mjs';
import {applyBalancedScores} from './lib/balanced-score.mjs';
import {isolatedOutput} from './selective-update.mjs';
const root=path.resolve(import.meta.dirname,'..');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]};
const output=isolatedOutput(root,arg('--output-dir'));
const inputPath=arg('--inputs')??path.join(root,'methodology/fixtures/2026-10-28-selective-inputs.json');
const baselinePath=arg('--baseline')??path.join(root,'methodology/fixtures/2026-10-28-v9-baseline.json');
const inputs=JSON.parse(fs.readFileSync(inputPath)),baseline=JSON.parse(fs.readFileSync(baselinePath));
const config=JSON.parse(fs.readFileSync(path.join(root,'config/roles-v10.json')));
const policyFile=path.join(root,'config/lineup-policy.json'),policy=JSON.parse(fs.readFileSync(policyFile));
const frozenCosts=Object.fromEntries(baseline.models.filter(m=>m.taskEfficiency).map(m=>[m.name,m.taskEfficiency]));
const candidate=buildRoleSnapshot({...inputs,config,policy,frozenCosts});
validateRoleSnapshot(candidate,config);
const observedConfig=structuredClone(config);observedConfig.approximations.enabled=false;
const observedCandidate=buildRoleSnapshot({...inputs,config:observedConfig,policy,frozenCosts});
const observedNames=new Set(candidate.models.filter(m=>m.generationEligibility?.eligible!==false&&Number.isFinite(m.aaModel?.intelligenceIndex)&&baseline.models.some(b=>b.name===m.name&&b.aaModel&&Object.values(b.roleScores??{}).some(r=>Number.isFinite(r.rankingQuality)))).map(m=>m.name));
function aligned(data){
  const copy=structuredClone(data);copy.models=copy.models.filter(m=>observedNames.has(m.name));
  for(const m of copy.models){const actual=candidate.models.find(c=>c.name===m.name);m.aaModel=structuredClone(actual.aaModel);m.taskEfficiency=structuredClone(actual.taskEfficiency);}
  applyBalancedScores(copy.models,config.roles.map(r=>r.id));return copy;
}
const scenarios={published:baseline,'aligned-v9':aligned(baseline),'aligned-v10':aligned(candidate),'observed-v10':observedCandidate,'expanded-v10':candidate};
fs.mkdirSync(output,{recursive:true});
const lineups={};
for(const [name,snapshot]of Object.entries(scenarios)){
  const file=path.join(output,name+'.json'),target=path.join(output,name+'-lineups.json');
  fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+'\n');
  const run=spawnSync(process.execPath,[path.join(root,'scripts/build-lineups.mjs'),'--snapshot',file,'--output',target],{encoding:'utf8',timeout:45000});
  if(run.status!==0)throw new Error(`Portfolio comparison ${name} failed: ${run.stderr}`);
  lineups[name]=JSON.parse(fs.readFileSync(target));
}
function rank(values){
  const sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=[];
  for(let i=0;i<sorted.length;){let end=i;while(end+1<sorted.length&&sorted[end+1].v===sorted[i].v)end++;for(let j=i;j<=end;j++)out[sorted[j].i]=(i+end)/2+1;i=end+1;}return out;
}
function pearson(a,b){
  if(a.length<2)return null;const mean=v=>v.reduce((s,x)=>s+x,0)/v.length,ma=mean(a),mb=mean(b);
  let cross=0,sa=0,sb=0;for(let i=0;i<a.length;i++){cross+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return sa&&sb?cross/Math.sqrt(sa*sb):null;
}
function kendall(a,b){
  let c=0,d=0,ta=0,tb=0;
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const x=Math.sign(a[i]-a[j]),y=Math.sign(b[i]-b[j]);if(!x&&!y)continue;if(!x)ta++;else if(!y)tb++;else if(x===y)c++;else d++;}
  const den=Math.sqrt((c+d+ta)*(c+d+tb));return den?(c-d)/den:null;
}
function ranked(snapshot,role,mode='quality'){
  const byId=new Map();
  for(const model of snapshot.models){
    const r=model.roleScores?.[role],slug=model.aaModel?.slug??(model.approximation?'estimated:'+model.name:null);
    const budget=Number.isFinite(r?.balancedQualityPercentile)&&Number.isFinite(r?.balancedAffordabilityPercentile)?0.4*r.balancedQualityPercentile+0.6*r.balancedAffordabilityPercentile:null;
    const s=mode==='quality'?r?.rankingQuality:mode==='balanced'?r?.rankingValue:budget;
    if(model.generationEligibility?.eligible===false||!slug||!Number.isFinite(s))continue;
    const old=byId.get(slug);if(!old||s>old.score)byId.set(slug,{slug,model:model.name,score:s,status:r.status??'valid',measurementKind:r.status==='estimated'?'estimated':'observed'});
  }
  return [...byId.values()].sort((a,b)=>b.score-a.score||a.slug.localeCompare(b.slug));
}
function comparison(a,b,role,mode='quality'){
  const left=ranked(a,role,mode),right=ranked(b,role,mode),li=new Map(left.map((r,i)=>[r.slug,{...r,rank:i+1}])),ri=new Map(right.map((r,i)=>[r.slug,{...r,rank:i+1}]));
  const common=[...li.keys()].filter(k=>ri.has(k)),x=common.map(k=>li.get(k).score),y=common.map(k=>ri.get(k).score);
  const top=k=>{const size=Math.min(k,common.length),set=new Set(right.filter(r=>li.has(r.slug)).slice(0,size).map(r=>r.slug));return size?left.filter(r=>ri.has(r.slug)).slice(0,size).filter(r=>set.has(r.slug)).length/size:null;};
  const moves=common.map(slug=>({slug,from:li.get(slug).rank,to:ri.get(slug).rank,oldQuality:li.get(slug).score,newQuality:ri.get(slug).score,oldStatus:li.get(slug).status}));
  return {oldIdentities:left.length,newIdentities:right.length,commonIdentities:common.length,spearman:pearson(rank(x),rank(y)),kendallTauB:kendall(x,y),top5Overlap:top(5),top10Overlap:top(10),entered:right.filter(r=>!li.has(r.slug)).map(r=>r.slug),exited:left.filter(r=>!ri.has(r.slug)).map(r=>r.slug),moves,
    contributions:right.map(r=>{const m=b.models.find(m=>m.name===r.model);const roleSpec=config.roles.find(spec=>spec.id===role);return {slug:r.slug,score:r.score,measurementKind:r.measurementKind,approximation:m.approximation??null,components:Object.fromEntries(Object.entries(roleSpec.weights??{[roleSpec.externalBenchmark]:1}).map(([key,w])=>[key,{weight:w,value:m.benchmarks[key]??null,contribution:m.benchmarks[key]==null?null:w*m.benchmarks[key]}]))};})};
}
const rankings=Object.fromEntries(config.roles.map(r=>[r.id,{sameObservedCohort:comparison(scenarios['aligned-v9'],scenarios['aligned-v10'],r.id),publishedToExpanded:comparison(baseline,candidate,r.id)}]));
for(const role of config.roles)rankings[role.id].byMode=Object.fromEntries(['balanced','budget'].map(mode=>[mode,{sameObservedCohort:comparison(scenarios['aligned-v9'],scenarios['aligned-v10'],role.id,mode),publishedToExpanded:comparison(baseline,candidate,role.id,mode)}]));
const portfolioChanges={};
for(const mode of Object.keys(policy.modes)){
  portfolioChanges[mode]={};
  for(const [label,from,to]of [['methodology','aligned-v9','aligned-v10'],['expandedRankingCohort','aligned-v10','observed-v10'],['approximation','observed-v10','expanded-v10'],['publishedToCandidate','published','expanded-v10']]){
    const a=lineups[from].modes[mode],b=lineups[to].modes[mode];
    portfolioChanges[mode][label]={from,to,oldFloor:a.effectiveIntelligenceFloor,newFloor:b.effectiveIntelligenceFloor,oldIntelligenceBaseline:a.bestEligibleIntelligenceIndex,newIntelligenceBaseline:b.bestEligibleIntelligenceIndex,oldCost:a.totalPlanAdjustedCostPerPortfolioUsd,newCost:b.totalPlanAdjustedCostPerPortfolioUsd,oldFamilies:a.familyCount,newFamilies:b.familyCount,oldPriceFilter:a.priceFilter,newPriceFilter:b.priceFilter,selections:config.roles.map(r=>({role:r.id,from:a.selections[r.id].model,to:b.selections[r.id].model,changed:a.selections[r.id].model!==b.selections[r.id].model,oldQuality:a.selections[r.id].quality,newQuality:b.selections[r.id].quality,intelligence:b.selections[r.id].intelligenceIndex,cost:b.selections[r.id].planAdjustedCostPerTaskUsd,provenance:b.selections[r.id].benchmarkProvenance}))};
  }
}
const sensitivity={};
for(const role of config.roles.filter(r=>r.weights)){
  const reference=ranked(candidate,role.id),top=new Set(reference.slice(0,5).map(r=>r.slug));
  sensitivity[role.id]=[];
  for(const key of Object.keys(role.weights))for(const delta of [-.05,.05]){
    const w=role.weights[key]+delta;
    const weights=Object.fromEntries(Object.entries(role.weights).map(([k,value])=>[k,k===key?w:value*(1-w)/(1-role.weights[key])]));
    const order=candidate.models.filter(m=>m.aaModel&&m.generationEligibility?.eligible!==false).flatMap(m=>{const s=scoreRole({...role,weights},m.benchmarks);return s.rankingQuality==null?[]:[{slug:m.aaModel.slug,score:s.rankingQuality}];});
    const unique=[...new Map(order.map(r=>[r.slug,r])).values()].sort((a,b)=>b.score-a.score||a.slug.localeCompare(b.slug));
    sensitivity[role.id].push({component:key,delta,top5Overlap:unique.slice(0,5).filter(r=>top.has(r.slug)).length/5,top5:unique.slice(0,5).map(r=>r.slug)});
  }
}
const correlations={};
const keys=[...new Set(config.roles.flatMap(r=>Object.keys(r.weights??{})))];
const identityRows=[...new Map(candidate.models.filter(m=>m.aaModel&&m.generationEligibility?.eligible!==false).map(m=>[m.aaModel.slug,m])).values()];
for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const rows=identityRows.filter(m=>Number.isFinite(m.benchmarks[keys[i]])&&Number.isFinite(m.benchmarks[keys[j]]));correlations[keys[i]+' / '+keys[j]]={n:rows.length,spearman:pearson(rank(rows.map(m=>m.benchmarks[keys[i]])),rank(rows.map(m=>m.benchmarks[keys[j]])))};}
const ablations={};
for(const role of config.roles.filter(r=>r.weights))ablations[role.id]=Object.keys(role.weights).map(removed=>{
  const weights=Object.fromEntries(Object.entries(role.weights).filter(([k])=>k!==removed).map(([k,w])=>[k,w/(1-role.weights[removed])]));
  const reference=ranked(candidate,role.id),top=new Set(reference.slice(0,5).map(r=>r.slug));
  const order=identityRows.flatMap(m=>{const s=scoreRole({...role,weights},m.benchmarks);return s.rankingQuality==null?[]:[{slug:m.aaModel.slug,score:s.rankingQuality}];}).sort((a,b)=>b.score-a.score||a.slug.localeCompare(b.slug));
  return {removed,completeIdentities:order.length,top5Overlap:order.slice(0,5).filter(r=>top.has(r.slug)).length/5,top5:order.slice(0,5).map(r=>r.slug)};
});
const report={sourceCommit:inputs.sourceCommit,date:inputs.generatedAt,activation:'not activated; published artifacts unchanged',intelligenceEstimator:{enabled:false},policySha256:crypto.createHash('sha256').update(fs.readFileSync(policyFile)).digest('hex'),baselineSha256:crypto.createHash('sha256').update(fs.readFileSync(baselinePath)).digest('hex'),comparisonDesign:{methodology:`aligned-v9 versus aligned-v10: same ${new Set(candidate.models.filter(m=>observedNames.has(m.name)).map(m=>m.aaModel.slug)).size} active observed v5 identities with prior v9 role scores, exact existing task costs, unchanged base policy`,coverage:'aligned-v10 versus observed-v10: expanded active observed role scoring universe; unknown Intelligence remains excluded from portfolios',approximation:'observed-v10 versus expanded-v10: separately labeled role analogies, conservative role/Intelligence values, one estimated seat maximum. Proxies do not define observed percentiles, Intelligence references or cost cutoffs',price:'Existing per-offer task cost copied exactly. Newly scored offers use the frozen reference workload and frozen rates; no new task telemetry.',baseline:'Published v9 scores retain their existing historical/proxy provenance; partial old scores are labeled in rank moves.'},counts:candidate.counts,generationPolicy:config.generationPolicy,historicalOffers:candidate.models.filter(m=>m.generationEligibility?.eligible===false).map(m=>({model:m.name,...m.generationEligibility})),approximationPolicy:config.approximations,approximations:candidate.models.filter(m=>m.approximation).map(m=>({model:m.name,...m.approximation,roles:m.roleScores})),remainingGaps:candidate.models.filter(m=>m.generationEligibility?.eligible!==false&&!Object.values(m.roleScores).some(s=>Number.isFinite(s.rankingQuality))).map(m=>({model:m.name,mapping:m.mapping})),roleCoverage:candidate.roleCoverage,rankings,portfolioChanges,sensitivity,ablations,correlations};
fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n');
const metricsOnly=({contributions,moves,...stats})=>stats;
const summary={...report,rankings:Object.fromEntries(Object.entries(rankings).map(([role,r])=>[role,{
  sameObservedCohort:{...metricsOnly(r.sameObservedCohort),moves:r.sameObservedCohort.moves},
  publishedToExpanded:metricsOnly(r.publishedToExpanded),
  byMode:Object.fromEntries(Object.entries(r.byMode).map(([mode,v])=>[mode,{sameObservedCohort:metricsOnly(v.sameObservedCohort),publishedToExpanded:metricsOnly(v.publishedToExpanded)}]))
}]))};
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
const n=x=>x==null?'n/a':x.toFixed(3);
const markdown=['# Selective methodology comparison','',`Frozen inputs: ${inputs.generatedAt}. Statistical Intelligence estimators disabled; conservative role analogies enabled in isolated v10. No published artifacts changed.`,'',report.comparisonDesign.methodology+'.',report.comparisonDesign.price,'','## Rankings on the same observed Intelligence cohort','','| Role | Common identities | Spearman | Kendall tau-b | Top-5 overlap |','| --- | ---: | ---: | ---: | ---: |',...Object.entries(rankings).map(([r,v])=>`| ${r} | ${v.sameObservedCohort.commonIdentities} | ${n(v.sameObservedCohort.spearman)} | ${n(v.sameObservedCohort.kendallTauB)} | ${n(v.sameObservedCohort.top5Overlap)} |`),'','## Portfolio changes','','| Mode | Requested floor | Effective floor | Old adjusted cost | Candidate adjusted cost | Changed seats |','| --- | ---: | ---: | ---: | ---: | ---: |',...Object.entries(portfolioChanges).map(([mode,v])=>`| ${mode} | ${policy.modes[mode].requestedIntelligenceFloor} | ${v.publishedToCandidate.newFloor} | ${n(v.publishedToCandidate.oldCost)} | ${n(v.publishedToCandidate.newCost)} | ${v.publishedToCandidate.selections.filter(s=>s.changed).length} |`),''];
fs.writeFileSync(path.join(output,'comparison.md'),markdown.join('\n'));
console.log(markdown.join('\n'));
