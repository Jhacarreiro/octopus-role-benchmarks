import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const latest=JSON.parse(fs.readFileSync(path.join(root,'data','latest.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const lineups=JSON.parse(fs.readFileSync(path.join(root,'site','data','lineups.json'),'utf8'));
const roles=latest.roles.map(r=>r.id);
const modelByName=new Map(latest.models.map(m=>[m.name,m]));
const eligibleNames=new Set(Object.keys(policy.familyByModel||{}));
const eligibleModels=latest.models.filter(m=>eligibleNames.has(m.name));

function benchmarkIdentity(m){
  return m.mapping?.status==='unscored'?`unscored:${m.name}`:(m.aaModel?.slug?`aa:${m.aaModel.slug}`:`model:${m.name}`);
}
function family(name){return policy.familyByModel?.[name]||null}
function fail(msg){throw new Error(`lineup swap evaluation: ${msg}`)}
function maxRoleQuality(role){return Math.max(...latest.models.map(m=>m.roleScores?.[role]?.rankingQuality).filter(v=>v!=null))}

function validateSelections(modeId,selections){
  const mode=policy.modes[modeId];
  const keys=Object.keys(selections).sort().join('|');
  if(keys!==[...roles].sort().join('|')) return {ok:false,reason:'role coverage'};
  const names=Object.values(selections);
  if(new Set(names).size!==names.length) return {ok:false,reason:'exact model repeated'};
  for(const req of mode.mandatoryModels||[]) if(!names.includes(req)) return {ok:false,reason:`mandatory model missing: ${req}`};
  for(const rule of mode.forbiddenAssignments||[]) if(selections[rule.role]===rule.model) return {ok:false,reason:`forbidden assignment: ${rule.model} -> ${rule.role}`};
  const identities=new Set();
  const famCounts=new Map();
  for(const role of roles){
    const name=selections[role],m=modelByName.get(name); if(!m) return {ok:false,reason:`model missing: ${name}`};
    const f=family(name); if(!f) return {ok:false,reason:`family missing: ${name}`};
    const id=benchmarkIdentity(m); if(identities.has(id)) return {ok:false,reason:`benchmark identity repeated: ${id}`}; identities.add(id);
    famCounts.set(f,(famCounts.get(f)||0)+1);
    const originalOverride=mode.externalOverrides?.[role]||null;
    const originalName=mode.selections[role];
    if(originalOverride && name===originalName){
      if(originalOverride.freeRequired&&m.free!==true) return {ok:false,reason:`override no longer free: ${name}`};
      if(m.mapping?.status!=='unscored') return {ok:false,reason:`override no longer unresolved: ${name}`};
      continue;
    }
    if(m.mapping?.status==='unscored') return {ok:false,reason:`unscored candidate without explicit override: ${name}`};
    const score=m.roleScores?.[role]; if(score?.rankingQuality==null) return {ok:false,reason:`missing role quality: ${name}/${role}`};
    if(modeId==='balanced'&&score.rankingValue==null) return {ok:false,reason:`missing Balanced score: ${name}/${role}`};
    if(mode.qualityFloorFraction!=null){
      const ratio=score.rankingQuality/maxRoleQuality(role);
      if(ratio+1e-12<mode.qualityFloorFraction) return {ok:false,reason:`quality floor failed: ${name}/${role}`};
    }
  }
  const fc=famCounts.size;
  if(fc<(policy.minFamilies??1)||fc>(policy.maxFamilies??roles.length)) return {ok:false,reason:`family count ${fc} outside range`};
  for(const [f,c] of famCounts) if(c>(policy.maxSeatsPerFamily??roles.length)) return {ok:false,reason:`family ${f} has ${c} seats`};
  return {ok:true,familyCount:fc};
}

const out={
  schemaVersion:1,
  snapshotDate:latest.date,
  generatedAt:latest.generatedAt,
  policySchemaVersion:policy.schemaVersion,
  applyAutomatically:policy.swapEvaluation?.applyAutomatically===true,
  scope:policy.swapEvaluation?.scope||'single-seat',
  identityRule:policy.swapEvaluation?.identityRule||'aaModel.slug for scored rows; model name for unresolved rows',
  modes:{}
};

for(const modeId of ['quality','balanced','budget']){
  const mode=policy.modes[modeId];
  const current={...mode.selections};
  const configured=policy.swapEvaluation?.modes?.[modeId]||{classification:'review-only'};
  const opportunities=[];
  const lockedRoles=[];
  for(const role of roles){
    const currentName=current[role];
    const currentModel=modelByName.get(currentName); if(!currentModel) fail(`${modeId}/${role}: current model missing`);
    if(mode.externalOverrides?.[role]){
      lockedRoles.push({role,model:currentName,classification:'review-only',reason:'external-evidence override'});
      continue;
    }
    for(const candidate of eligibleModels){
      if(candidate.name===currentName) continue;
      if(candidate.mapping?.status==='unscored') continue;
      const candidateScore=candidate.roleScores?.[role]; if(candidateScore?.rankingQuality==null) continue;
      const test={...current,[role]:candidate.name};
      const valid=validateSelections(modeId,test); if(!valid.ok) continue;
      const currentScore=currentModel.roleScores?.[role];
      if(!currentScore) continue;
      let improves=false,metric=null,delta=null;
      if(modeId==='quality'){
        metric='roleQuality'; delta=candidateScore.rankingQuality-currentScore.rankingQuality; improves=delta>1e-12;
      }else if(modeId==='balanced'){
        if(candidateScore.rankingValue==null||currentScore.rankingValue==null) continue;
        metric='balancedScore'; delta=candidateScore.rankingValue-currentScore.rankingValue; improves=delta>1e-12;
      }else{
        const cc=candidate.taskEfficiency?.commandCodeCostPerTaskUsd,cur=currentModel.taskEfficiency?.commandCodeCostPerTaskUsd;
        if(cc==null||cur==null) continue;
        metric='costPerTaskUsd'; delta=cur-cc; improves=delta>1e-12;
      }
      if(!improves) continue;
      opportunities.push({
        role,
        from:currentName,
        to:candidate.name,
        fromIdentity:benchmarkIdentity(currentModel),
        toIdentity:benchmarkIdentity(candidate),
        fromFamily:family(currentName),
        toFamily:family(candidate.name),
        classification:configured.classification,
        metric,
        improvement:delta,
        fromQuality:currentScore.rankingQuality,
        toQuality:candidateScore.rankingQuality,
        fromBalanced:currentScore.rankingValue??null,
        toBalanced:candidateScore.rankingValue??null,
        fromCostPerTaskUsd:currentModel.taskEfficiency?.commandCodeCostPerTaskUsd??null,
        toCostPerTaskUsd:candidate.taskEfficiency?.commandCodeCostPerTaskUsd??null,
        resultingFamilyCount:valid.familyCount
      });
    }
  }
  opportunities.sort((a,b)=>b.improvement-a.improvement||a.role.localeCompare(b.role)||a.to.localeCompare(b.to));
  out.modes[modeId]={
    classification:configured.classification,
    objective:configured.objective||null,
    currentFamilyCount:lineups.modes?.[modeId]?.familyCount??null,
    autoSafeCandidateCount:configured.classification==='auto-safe-candidate'?opportunities.length:0,
    reviewOnlyCandidateCount:configured.classification==='review-only'?opportunities.length:0,
    lockedRoles,
    opportunities
  };
}

const text=JSON.stringify(out,null,2)+'\n';
const target=path.join(root,'data','lineup-opportunities.json');
if(check){
  const current=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
  if(current!==text) fail('data/lineup-opportunities.json is stale; run node scripts/evaluate-lineup-swaps.mjs');
  console.log('ok: lineup swap opportunity report matches current policy and snapshot');
}else{
  fs.writeFileSync(target,text);
  console.log(`wrote ${path.relative(root,target)} for snapshot ${latest.date}`);
  for(const modeId of ['quality','balanced','budget']){
    const m=out.modes[modeId];
    console.log(`${modeId}: auto-safe=${m.autoSafeCandidateCount} review-only=${m.reviewOnlyCandidateCount} locked=${m.lockedRoles.length}`);
  }
}
