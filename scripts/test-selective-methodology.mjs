import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseModelObservations} from './lib/aa-observations.mjs';
import {buildRoleSnapshot,normalizeObservation,validateRoleSnapshot} from './lib/role-scoring.mjs';
import {isolatedOutput} from './selective-update.mjs';
const root=path.resolve(import.meta.dirname,'..');
const inputs=JSON.parse(fs.readFileSync(path.join(root,'methodology/fixtures/2026-10-28-selective-inputs.json')));
const config=JSON.parse(fs.readFileSync(path.join(root,'config/roles-v10.json')));
const policy=JSON.parse(fs.readFileSync(path.join(root,'config/lineup-policy.json')));
const build=(data=inputs,c=config)=>buildRoleSnapshot({...data,config:c,policy});
const snapshot=build();
validateRoleSnapshot(snapshot,config);
const hy3=snapshot.models.find(m=>m.aaModel?.slug==='hy3');
assert.equal(hy3.roleScores.implementer.status,'valid','Missing factuality must not erase independently observed implementation capability');
assert.equal(hy3.roleScores.strategist.rankingQuality,null,'Incomplete factuality role has no point ranking');
assert.equal(hy3.roleScores.strategist.rankingValue,null,'Incomplete roles must not enter percentile ranking');
assert.equal(hy3.roleScores.strategist.scoreRange.upper-hy3.roleScores.strategist.scoreRange.lower,20,'Missing 20% component retains its full uncertainty');
assert.equal(hy3.aaModel.intelligenceIndex,null,'No model Intelligence imputation');

const diagnosticOnly=structuredClone(inputs);for(const r of diagnosticOnly.observations){r.frontierCode20=null;r.hleDiamond=null;}
assert.deepEqual(build(diagnosticOnly).models.map(m=>m.roleScores),snapshot.models.map(m=>m.roleScores),'Experimental coverage must not affect core ranks');
const withOtherEffort=inputs.observations.find(r=>r.slug==='claude-opus-5-5');
const target={...withOtherEffort,slug:'fixture-low',id:'fixture-low-id',scicode:null,name:'name with {braces}'};
const other={...withOtherEffort,slug:'fixture-high',id:'fixture-high-id',scicode:.99};
const flight=JSON.stringify([1,JSON.stringify({models:[target,other]})]);
const html=`<script>self.__next_f.push(${flight})</script>`;
assert.equal(parseModelObservations(html,'fixture-low').scicode,null,'Do not borrow an adjacent effort score');
assert.equal(parseModelObservations(html,'fixture-low').name,'name with {braces}','String braces do not end source objects');
const conflict=`<script>self.__next_f.push(${JSON.stringify([1,JSON.stringify({models:[target,{...target,scicode:.2}]})])})</script>`;
assert.throws(()=>parseModelObservations(conflict,'fixture-low'),/Conflicting AA/);
assert.equal(normalizeObservation(1500,config.benchmarks.briefcase),50);
assert.equal(normalizeObservation(-100,config.benchmarks.omniscience),0);
assert.equal(normalizeObservation(0,config.benchmarks.omniscience),50);
assert.throws(()=>normalizeObservation(45,config.benchmarks.terminalBench40),/Out-of-scale/);
const corrupt=structuredClone(inputs);corrupt.observations[0].terminalBench40=45;
assert.throws(()=>build(corrupt),/Out-of-scale/,'Scale corruption is an integrity failure');
const olderIndex=structuredClone(inputs);const older=olderIndex.observations.find(r=>Number.isFinite(r.intelligenceIndex));older.intelligenceIndexVersion='4.3';
assert.equal(build(olderIndex).models.find(m=>m.aaModel?.slug===older.slug).aaModel.intelligenceIndex,null,'Old Intelligence cannot enter v5 eligibility');
const estimatedIndex=structuredClone(inputs);const estimated=estimatedIndex.observations.find(r=>Number.isFinite(r.intelligenceIndex));estimated.intelligenceIndexIsEstimated=true;
assert.equal(build(estimatedIndex).models.find(m=>m.aaModel?.slug===estimated.slug).aaModel.intelligenceIndex,null,'Source estimates cannot be relabeled observed');
const incompatible=structuredClone(snapshot);incompatible.models.find(m=>m.aaModel&&m.benchmarks.briefcase!=null).benchmarkProvenance.briefcase.metricVersion='1.0';
assert.throws(()=>validateRoleSnapshot(incompatible,config),/provenance/);
assert.throws(()=>build({...inputs,observations:inputs.observations.map(r=>({slug:r.slug,sourceUnavailableReason:'offline'}))}),/Global AA/);
const isolatedFailure=structuredClone(inputs);isolatedFailure.observations[0]={slug:inputs.observations[0].slug,sourceUnavailableReason:'timeout'};
assert.ok(build(isolatedFailure).models.some(m=>m.roleScores.implementer?.status==='valid'),'One source failure must not abort independent models');
assert.equal(snapshot.models.filter(m=>m.name==='MiniMax M3.1 Flash').length,1,'Free offer supersedes paid duplicate');
assert.equal(snapshot.models.find(m=>m.name==='MiniMax M3.1 Flash').free,true);
assert.equal(snapshot.models.find(m=>m.name==='Qwen 3.8 Max Prime').aaModel,null,'Synthetic AA proxies are not observations');
assert.throws(()=>isolatedOutput(root,path.join(root,'site/data')),/outside/);
assert.throws(()=>isolatedOutput(root,null),/requires/);
const changed=structuredClone(config);changed.intelligenceEstimator.enabled=true;
assert.throws(()=>build(inputs,changed),/disabled/);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'octopus-v10-'));
try{
  const file=path.join(temp,'snapshot.json');fs.writeFileSync(file,JSON.stringify(snapshot));
  const output=path.join(temp,'lineups.json');
  const run=spawnSync(process.execPath,[path.join(root,'scripts/build-lineups.mjs'),'--snapshot',file,'--output',output],{encoding:'utf8',timeout:45000});
  assert.equal(run.status,0,run.stderr);
  const lineups=JSON.parse(fs.readFileSync(output));
  for(const mode of Object.values(lineups.modes)){
    assert.equal(Object.keys(mode.selections).length,8);
    for(const [role,pick]of Object.entries(mode.selections)){
      const model=snapshot.models.find(m=>m.name===pick.model);
      assert.ok(Number.isFinite(model.aaModel.intelligenceIndex));
      assert.equal(model.aaModel.intelligenceIndexVersion,'5.0');
      assert.equal(model.roleScores[role].completeness,'complete');
    }
    assert.ok(mode.familyCount>=mode.minFamilies&&mode.familyCount<=policy.maxFamilies);
    const counts=new Map();for(const p of Object.values(mode.selections))counts.set(p.family,(counts.get(p.family)??0)+1);
    assert.ok([...counts.values()].every(n=>n<=policy.maxSeatsPerFamily));
    assert.equal(mode.selections['security-reviewer'].source,'cyberIndex');
    const picks=mode.selections;
    assert.notEqual(picks['code-reviewer'].family,picks.implementer.family);
    assert.notEqual(picks['code-reviewer'].family,picks['implementer-heavy'].family);
    assert.notEqual(picks.implementer.benchmarkIdentity,picks['implementer-heavy'].benchmarkIdentity);
    const impl=snapshot.models.find(m=>m.name===picks.implementer.model),heavy=snapshot.models.find(m=>m.name===picks['implementer-heavy'].model);
    assert.ok(heavy.roleScores.implementer.rankingQuality+1e-6>=impl.roleScores.implementer.rankingQuality+2,'Heavy must improve the Implementer score by two points');
    for(const p of Object.values(picks))assert.ok(p.intelligenceIndex+1e-4>=mode.intelligenceThreshold);
  }
}finally{assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));fs.rmSync(temp,{recursive:true,force:true});}
console.log('ok: selective per-role missingness, versions, scales, identity, disabled estimators, free offers, isolated output and portfolio eligibility');
