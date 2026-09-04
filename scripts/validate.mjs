import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
if(roles.schemaVersion<4) throw new Error('Expected methodology schema >=4');
if(roles.coveragePolicy!==1) throw new Error('coveragePolicy must remain 1.0');
if(roles.costBasis?.default!=='task') throw new Error('Primary cost basis must be task');
if(Math.abs((roles.ranking?.codingAgentWeight??0)-1/3)>1e-12) throw new Error('Coding Agent weight must remain 1/3');
if(!Array.isArray(roles.roles)||roles.roles.length!==8) throw new Error('Expected 8 canonical Octopus roles');
for(const role of roles.roles){
  const sum=Object.values(role.weights).reduce((a,b)=>a+b,0);
  if(Math.abs(sum-1)>1e-9) throw new Error(`Weights for ${role.id} sum to ${sum}`);
  for(const key of Object.keys(role.weights)) if(!roles.benchmarks[key]) throw new Error(`Unknown benchmark ${key} in ${role.id}`);
}
const latest=JSON.parse(fs.readFileSync(path.join(root,'data','latest.json'),'utf8'));
if(latest.schemaVersion<4) throw new Error('Expected snapshot schema >=4');
for(const [key,c] of Object.entries(latest.coverage||{})) if(c.ratio!==1||c.present!==c.total) throw new Error(`Snapshot coverage <100% for ${key}`);
for(const c of [latest.efficiencyCoverage,latest.caiStarCoverage]) if(!c||c.ratio!==1||c.present!==c.total) throw new Error('Task-cost and CAI* coverage must both be 100%');
for(const m of latest.models||[]){
  if(m.mapping?.status==='unscored'&&Object.keys(m.roleScores||{}).length) throw new Error(`Unscored model has role score: ${m.name}`);
  if(!m.aaModel) continue;
  if(m.taskEfficiency?.commandCodeCostPerTaskUsd==null) throw new Error(`Scored model lacks CC task cost: ${m.name}`);
  if(m.caiStar?.value==null) throw new Error(`Scored model lacks CAI*: ${m.name}`);
  for(const role of latest.roles){
    const r=m.roleScores?.[role.id];
    if(!r) throw new Error(`Missing role score: ${m.name}/${role.id}`);
    const cost=m.taskEfficiency?.commandCodeCostPerTaskUsd;
    if(r.rankingValue==null&&cost!==0) throw new Error(`Missing ranking value: ${m.name}/${role.id}`);
    if(role.codingAdjusted&&r.rankingQuality==null) throw new Error(`Missing coding-adjusted quality: ${m.name}/${role.id}`);
  }
}
const v=JSON.parse(fs.readFileSync(path.join(root,'data','cai-validation.json'),'utf8'));
if(v.vendorHoldout.ensemble.mae>v.guardrails.ensembleMaeMax) throw new Error('CAI validation MAE guardrail failed');
if(v.vendorHoldout.ensemble.spearman<v.guardrails.ensembleSpearmanMin) throw new Error('CAI validation Spearman guardrail failed');
for(const [role,m] of Object.entries(v.finalRanking)){
  if(m.spearman<v.guardrails.finalRankingSpearmanMin) throw new Error(`${role} final ranking Spearman guardrail failed`);
  if(m.top5Hit<v.guardrails.finalRankingTop5HitMin) throw new Error(`${role} final ranking top5 guardrail failed`);
}
console.log(`ok: ${roles.roles.length} roles; universal=100%; CAI*=100%; reverse-validation guardrails pass`);
