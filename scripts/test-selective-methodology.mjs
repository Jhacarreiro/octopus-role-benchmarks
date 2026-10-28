import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseModelObservations} from './lib/aa-observations.mjs';
import {buildRoleSnapshot,normalizeObservation,validateRoleSnapshot} from './lib/role-scoring.mjs';
import {isolatedOutput} from './selective-update.mjs';
import {generationWindows,generationEligibility} from './lib/generation-window.mjs';
import {portfolioIntelligence,portfolioRoleQuality,independentEvidence} from './lib/role-approximations.mjs';
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
const duplicateHtml=rows=>`<script>self.__next_f.push(${JSON.stringify([1,JSON.stringify({models:rows})])})</script>`;
const breakdown={...target,briefcaseElo:null,briefcaseBreakdown:{overall:{elo:1200}}};
assert.throws(()=>parseModelObservations(duplicateHtml([breakdown,{...breakdown,briefcaseBreakdown:{overall:{elo:1400}}}]),target.slug),/Conflicting AA/,'Fallback-only duplicates must not depend on stream order');
assert.equal(parseModelObservations(duplicateHtml([breakdown,{...breakdown,briefcaseElo:1200,briefcaseBreakdown:null}]),target.slug).briefcaseElo,1200,'Equivalent supported source shapes resolve to the same observation');
assert.throws(()=>parseModelObservations(duplicateHtml([{...breakdown,briefcaseBreakdown:{overall:{elo:1200},elo:1400}}]),target.slug),/Conflicting Briefcase/);
const bound={...target,intelligenceIndexEvaluations:[{slug:'frontiercode-2-0'},{slug:'hle-diamond'}]};
assert.equal(parseModelObservations(duplicateHtml([bound,{...bound,intelligenceIndexEvaluations:[...bound.intelligenceIndexEvaluations].reverse()}]),target.slug).intelligenceIndexVersion,'5.0');
assert.throws(()=>parseModelObservations(duplicateHtml([bound,{...bound,intelligenceIndexEvaluations:[{slug:'hle-diamond'}]}]),target.slug),/Conflicting AA/,'Conflicting version bindings cannot select Intelligence eligibility by stream order');
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

// New, unmeasured releases must advance the age window too. Scores cannot
// rescue a release outside it; Claude tiers have independent release series.
const catalog=[{name:'GPT-5.4'},{name:'GPT-6 Sol'},{name:'GPT-6.1 Terra'},{name:'GPT-6.1 Sol'},{name:'Claude Haiku 4.5'},{name:'Claude Opus 5.5'}];
const windows=generationWindows(catalog);
assert.equal(generationEligibility(catalog[0],windows).eligible,false);
assert.equal(generationEligibility(catalog[1],windows).eligible,true);
assert.equal(generationEligibility(catalog[4],windows).eligible,true);
assert.equal(generationEligibility(catalog[1],generationWindows([...catalog,{name:'GPT-6.2 Unmeasured',mapping:{status:'unscored'}}])).eligible,false);
assert.equal(generationEligibility({name:'Unversioned public model'},windows).eligible,true);
const old=snapshot.models.find(m=>m.name==='GPT-5.4');
assert.equal(old.generationEligibility.eligible,false);
assert.ok(Object.values(old.roleScores).every(s=>s.rankingValue==null),'Historical scores cannot define active percentiles');

const prime=snapshot.models.find(m=>m.name==='Qwen 3.8 Max Prime');
assert.equal(prime.aaModel,null,'An approximation must not create an AA identity');
assert.deepEqual(prime.benchmarks,{},'No raw AA benchmark may be invented');
assert.ok(portfolioIntelligence(prime)<prime.approximation.intelligence.estimate);
assert.ok(portfolioRoleQuality(prime,'implementer')<prime.roleScores.implementer.score);
assert.ok(Number.isNaN(portfolioRoleQuality(prime,'security-reviewer')));
assert.equal(independentEvidence(prime,snapshot.models.find(m=>m.name==='Qwen 3.8 Max')),false,'A proxy and its anchor are not independent coding evidence');
const omni=snapshot.models.find(m=>m.name==='Qwen 3.8 Omni Flash');
assert.ok(Number.isNaN(portfolioIntelligence(omni)),'Missing anchor Intelligence cannot become zero or use the residual estimator');
const withoutApproximations=structuredClone(config);withoutApproximations.approximations.enabled=false;
const measuredOnly=build(inputs,withoutApproximations);
for(const model of measuredOnly.models.filter(m=>m.aaModel)){
  const actual=snapshot.models.find(m=>m.name===model.name);
  assert.deepEqual(actual.benchmarks,model.benchmarks,'Analogies must preserve observed raw components');
  assert.deepEqual(actual.benchmarkProvenance,model.benchmarkProvenance,'Analogies must preserve measurement provenance');
  for(const [role,score]of Object.entries(model.roleScores))if(score.completeness==='complete')assert.deepEqual(actual.roleScores[role],score,'Adding analogies must not move complete measured scores or percentiles');
}
for(const name of ['Step 3.7 Flash','Claude Haiku 4.5']){
  const hybrid=snapshot.models.find(m=>m.name===name),measured=measuredOnly.models.find(m=>m.name===name);
  assert.ok(hybrid.aaModel,'Partial measured identity must remain intact');
  assert.equal(hybrid.aaModel.intelligenceIndex,null,'Analogy Intelligence must not be stored as an AA observation');
  assert.equal(hybrid.benchmarks.terminalBench40,undefined,'Missing observed benchmark stays missing');
  assert.deepEqual(hybrid.roleScores.implementer.observedRole,measured.roleScores.implementer,'Original partial score remains recoverable');
  assert.ok(hybrid.roleScores.implementer.rankingQuality>=measured.roleScores.implementer.scoreRange.lower,'Known observed contribution cannot be erased by the haircut');
}
const completedTarget=structuredClone(inputs);completedTarget.observations.find(r=>r.slug==='step-3-7-flash').terminalBench40=.2;
assert.equal(build(completedTarget).models.find(m=>m.name==='Step 3.7 Flash').roleScores.implementer.status,'valid','A new complete observed role supersedes its analogy');
const failedPartial=structuredClone(inputs);failedPartial.observations.find(r=>r.slug==='step-3-7-flash').hle=null;
assert.equal(build(failedPartial).models.find(m=>m.name==='Step 3.7 Flash').approximation,undefined,'Loss of required target evidence blocks the partial analogy');
const beam=snapshot.models.find(m=>m.name==='Beam 1.0');
assert.equal(beam.aaModel.slug,'reflection-beam');
assert.equal(beam.mapping.identityStatus,'public_verified');
assert.equal(beam.approximation,undefined,'Exact verified Beam observations take priority over analogies');
assert.equal(beam.roleScores.implementer.status,'valid');
const wrongBeam=structuredClone(inputs);wrongBeam.observations.find(r=>r.slug==='reflection-beam').id='wrong-source-uuid';
assert.throws(()=>build(wrongBeam),/Unverified source identity/,'A verified catalog alias must bind the exact AA UUID');
const unavailableBeam=structuredClone(inputs);unavailableBeam.observations=unavailableBeam.observations.filter(r=>r.slug!=='reflection-beam');
assert.equal(build(unavailableBeam).models.find(m=>m.name==='Beam 1.0').approximation,undefined,'Source failures must not turn a verified identity into a proxy');
assert.ok(Number.isNaN(portfolioIntelligence(snapshot.models.find(m=>m.name==='Fugu Ultra'))),'Unverified Fugu revision cannot invent Intelligence');
assert.equal(independentEvidence(snapshot.models.find(m=>m.name==='Fugu Ultra'),snapshot.models.find(m=>m.name==='Claude Sonnet 5.5')),false,'A multi-agent worker family is not independent coding evidence');
const expired=build({...inputs,generatedAt:'2026-11-28T00:00:00.000Z'});
assert.equal(expired.models.find(m=>m.name===prime.name).approximation,undefined,'Expired evidence fails closed');
const missingAnchor=structuredClone(inputs);missingAnchor.observations=missingAnchor.observations.filter(r=>r.slug!=='qwen3-8-max');
assert.equal(build(missingAnchor).models.find(m=>m.name===prime.name).approximation,undefined,'Missing source is not another proxy opportunity');
const badEstimate=structuredClone(snapshot);badEstimate.models.find(m=>m.name===prime.name).roleScores.implementer.rankingQuality=99;
assert.throws(()=>validateRoleSnapshot(badEstimate,config),/approximation/);
const fakeRaw=structuredClone(snapshot);fakeRaw.models.find(m=>m.name===prime.name).benchmarks.terminalBench40=90;
assert.throws(()=>validateRoleSnapshot(fakeRaw,config),/approximation/);
const badSecurity=structuredClone(config);badSecurity.approximations.recipes[0].roles.push('security-reviewer');
assert.throws(()=>build(inputs,badSecurity),/evidence or role/);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'octopus-v10-'));
try{
  const file=path.join(temp,'snapshot.json');fs.writeFileSync(file,JSON.stringify(snapshot));
  const output=path.join(temp,'lineups.json');
  const run=spawnSync(process.execPath,[path.join(root,'scripts/build-lineups.mjs'),'--snapshot',file,'--output',output],{encoding:'utf8',timeout:45000});
  assert.equal(run.status,0,run.stderr);
  const lineups=JSON.parse(fs.readFileSync(output));
  assert.equal(lineups.methodologyVersion,10);
  assert.equal(lineups.snapshotGeneratedAt,snapshot.generatedAt);
  for(const mismatch of [false,true]){
    const env={...process.env,SELECTIVE_SNAPSHOT:file,SELECTIVE_LINEUPS:output};
    if(mismatch)env.SELECTIVE_MISMATCH='1';else delete env.SELECTIVE_MISMATCH;
    const site=spawnSync(process.execPath,[path.join(root,'scripts/test-site-runtime.mjs')],{encoding:'utf8',timeout:15000,env});
    assert.equal(site.status,0,site.stderr);
  }
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
  // A deliberately strong hypothetical candidate proves that estimates can
  // actually be selected, while a second attractive estimate cannot take a
  // second seat. These values are test inputs, not published model claims.
  const stress=structuredClone(snapshot);
  for(const [i,name] of ['Hypothetical candidate A','Hypothetical candidate B'].entries()){
    const m=structuredClone(prime);m.name=name;m.free=true;m.billingCategory='free';
    m.max10MonthlyUsageLimitUsd=0;m.max20MonthlyUsageLimitUsd=0;m.max10EffectiveUsageUsd=0;m.max20EffectiveUsageUsd=0;
    m.taskEfficiency.commandCodeCostPerTaskUsd=0;m.taskEfficiency.planAdjustedCostPerTaskUsd=0;
    m.approximation.intelligence.cutoffLowerBound=58;
    m.approximation.scope=['architect','strategist','synthesizer','researcher'];
    m.approximation.evidenceIds=['test-independent-evidence-'+i];
    m.roleScores=Object.fromEntries(m.approximation.scope.map(role=>[role,{status:'estimated',completeness:'estimated',measurementKind:'estimated',rankingQuality:95,rankingValue:100,balancedQualityPercentile:100,balancedAffordabilityPercentile:100,scoreRange:{lower:95,upper:100}}]));
    stress.models.push(m);
  }
  const stressFile=path.join(temp,'hypothetical.json'),stressOutput=path.join(temp,'hypothetical-lineups.json');
  fs.writeFileSync(stressFile,JSON.stringify(stress));
  const stressRun=spawnSync(process.execPath,[path.join(root,'scripts/build-lineups.mjs'),'--snapshot',stressFile,'--output',stressOutput],{encoding:'utf8',timeout:45000});
  assert.equal(stressRun.status,0,stressRun.stderr);
  for(const mode of Object.values(JSON.parse(fs.readFileSync(stressOutput)).modes)){
    const picks=Object.values(mode.selections).filter(s=>s.measurementKind==='estimated');
    assert.equal(picks.length,1,'A qualifying estimate can win, but never two seats');
    assert.equal(picks[0].source,'conservative-role-approximation');
    assert.equal(picks[0].intelligenceIndex,58,'Portfolio uses the conservative value');
    assert.ok(mode.selections['security-reviewer'].measurementKind!=='estimated');
  }
}finally{assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));fs.rmSync(temp,{recursive:true,force:true});}
console.log('ok: selective per-role missingness, versions, scales, identity, disabled estimators, free offers, isolated output and portfolio eligibility');
