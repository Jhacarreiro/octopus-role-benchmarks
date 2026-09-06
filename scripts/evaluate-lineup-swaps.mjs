import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const latest=JSON.parse(fs.readFileSync(path.join(root,'data','latest.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const lineups=JSON.parse(fs.readFileSync(path.join(root,'site','data','lineups.json'),'utf8'));

function fail(msg){throw new Error(`lineup evaluation: ${msg}`)}

const out={
  schemaVersion:2,
  snapshotDate:latest.date,
  generatedAt:latest.generatedAt,
  policySchemaVersion:policy.schemaVersion,
  applyAutomatically:policy.swapEvaluation?.applyAutomatically===true,
  scope:policy.swapEvaluation?.scope||'regenerate-full-portfolio',
  repetitionRule:'models and benchmark identities may repeat subject to family seat limits and coding-independence rules',
  diversityRule:`final lineup requires ${policy.minFamilies}-${policy.maxFamilies} families with at most ${policy.maxSeatsPerFamily} seats per family`,
  modes:{}
};

for(const [modeId,mode] of Object.entries(lineups.modes||{})){
  out.modes[modeId]={
    classification:'review-only',
    objective:mode.objective??policy.modes?.[modeId]?.objective??null,
    currentFamilyCount:mode.familyCount??null,
    requestedIntelligenceFloor:mode.requestedIntelligenceFloor??null,
    effectiveIntelligenceFloor:mode.effectiveIntelligenceFloor??null,
    priceFilter:mode.priceFilter??null,
    autoSafeCandidateCount:0,
    reviewOnlyCandidateCount:0,
    lockedRoles:[],
    opportunities:[],
    note:'v6 regenerates the full constrained portfolio from current benchmark data; static single-seat swap suggestions are intentionally disabled.'
  };
}

const text=JSON.stringify(out,null,2)+'\n';
const target=path.join(root,'data','lineup-opportunities.json');
if(check){
  const current=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
  if(current!==text)fail('data/lineup-opportunities.json is stale; run node scripts/evaluate-lineup-swaps.mjs');
  console.log('ok: lineup evaluation report matches generated portfolios');
}else{
  fs.writeFileSync(target,text);
  console.log(`wrote ${path.relative(root,target)} for snapshot ${latest.date}`);
  for(const [modeId,m] of Object.entries(out.modes))console.log(`${modeId}: full-portfolio review, families=${m.currentFamilyCount}`);
}
