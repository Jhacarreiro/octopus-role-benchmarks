import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const latest=JSON.parse(fs.readFileSync(path.join(root,'data','latest.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const roles=latest.roles.map(r=>r.id);
const modelByName=new Map(latest.models.map(m=>[m.name,m]));
const out={schemaVersion:policy.schemaVersion,snapshotDate:latest.date,generatedAt:latest.generatedAt,policy:{defaultFamilyMax:policy.defaultFamilyMax,familyMax:policy.familyMax},modes:{}};
function fail(msg){throw new Error(`lineup policy: ${msg}`)}
for(const [modeId,mode] of Object.entries(policy.modes)){
  const selected=mode.selections||{};
  if(Object.keys(selected).sort().join('|')!==[...roles].sort().join('|')) fail(`${modeId}: selections must cover exactly the canonical roles`);
  const names=Object.values(selected);
  if(new Set(names).size!==names.length) fail(`${modeId}: exact model repeated`);
  for(const req of mode.mandatoryModels||[]) if(!names.includes(req)) fail(`${modeId}: mandatory model missing: ${req}`);
  for(const rule of mode.forbiddenAssignments||[]) if(selected[rule.role]===rule.model) fail(`${modeId}: forbidden assignment ${rule.model} -> ${rule.role}`);
  const familyCounts=new Map();
  const selections={};
  for(const role of roles){
    const name=selected[role],m=modelByName.get(name); if(!m) fail(`${modeId}/${role}: model not found: ${name}`);
    const family=policy.familyByModel[name]; if(!family) fail(`${modeId}/${role}: family missing for ${name}`);
    familyCounts.set(family,(familyCounts.get(family)||0)+1);
    const override=mode.externalOverrides?.[role]||null;
    const score=m.roleScores?.[role]||null;
    if(override){
      if(override.freeRequired&&m.free!==true) fail(`${modeId}/${role}: override requires free model: ${name}`);
      if(m.mapping?.status!=='unscored') fail(`${modeId}/${role}: external override is only for unscored rows: ${name}`);
    }else{
      if(!score?.rankingQuality) fail(`${modeId}/${role}: scored selection lacks role quality: ${name}`);
      if(modeId==='balanced'&&!score?.rankingValue) fail(`${modeId}/${role}: Balanced selection lacks ranking value: ${name}`);
      if(mode.qualityFloorFraction!=null){
        const max=Math.max(...latest.models.map(x=>x.roleScores?.[role]?.rankingQuality).filter(x=>x!=null));
        const ratio=score.rankingQuality/max;
        if(ratio+1e-12<mode.qualityFloorFraction) fail(`${modeId}/${role}: ${name} quality floor ${(ratio*100).toFixed(1)}% < ${(mode.qualityFloorFraction*100).toFixed(1)}%`);
      }
    }
    selections[role]={model:name,family,source:override?'external-evidence':'scored',badges:override?.badges||[],free:m.free===true,mappingStatus:m.mapping?.status||null,quality:score?.rankingQuality??null,balancedScore:score?.rankingValue??null,costPerTaskUsd:m.taskEfficiency?.commandCodeCostPerTaskUsd??0,reason:override?.reason||null,evidenceUrls:override?.evidenceUrls||[]};
  }
  for(const [family,count] of familyCounts){const max=policy.familyMax?.[family]??policy.defaultFamilyMax??1;if(count>max)fail(`${modeId}: family ${family} appears ${count} times (max ${max})`)}
  out.modes[modeId]={description:mode.description,qualityFloorFraction:mode.qualityFloorFraction??null,mandatoryModels:mode.mandatoryModels||[],forbiddenAssignments:mode.forbiddenAssignments||[],selections};
}
const text=JSON.stringify(out,null,2)+'\n';
const target=path.join(root,'site','data','lineups.json');
if(check){
  const current=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
  if(current!==text) fail('site/data/lineups.json is stale; run node scripts/build-lineups.mjs');
  console.log('ok: generated lineup data matches policy and current snapshot');
}else{
  fs.writeFileSync(target,text);
  console.log(`wrote ${path.relative(root,target)} for snapshot ${latest.date}`);
}
