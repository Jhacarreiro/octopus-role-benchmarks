import assert from 'node:assert/strict';
import {optimizePostSelectionCost} from './lib/post-selection-cost.mjs';
import {portfolioRoleQuality} from './lib/role-approximations.mjs';

const roles=['architect','strategist','security-reviewer','code-reviewer','implementer','implementer-heavy','synthesizer','researcher'];
function model(name,role,{cost=1,quality=80,intelligence=80,family=name}={}){
  const roleScores=Object.fromEntries(roles.map(r=>[r,{status:'valid',completeness:'complete',rankingQuality:r===role?quality:50,scoreRange:{lower:r===role?quality:50,upper:r===role?quality:50}}]));
  if(role==='implementer-heavy')roleScores.implementer={status:'valid',completeness:'complete',rankingQuality:85,scoreRange:{lower:85,upper:85}};
  return {name,family,cost,aaModel:{slug:name,intelligenceIndex:intelligence,intelligenceIndexVersion:'5.0'},benchmarkProvenance:{intelligenceIndex:{status:'observed'}},roleScores};
}
function setup(){
  const originals=roles.map(r=>model('initial-'+r,r));
  const assign=new Map(roles.map((r,i)=>[r,originals[i]]));
  const summarizeAssign=assign=>({totalPlanAdjustedCost:[...assign.values()].reduce((sum,m)=>sum+m.cost,0),totalQuality:[...assign].reduce((sum,[r,m])=>sum+portfolioRoleQuality(m,r),0),placementInversionCost:0,signature:roles.map(r=>assign.get(r)?.name??'').join('|')});
  const settings={enabled:true,objective:'minimize-plan-adjusted-cost',maxRolePointLoss:1,maxMeanPointLoss:.25,minSavingsPercent:10,measuredReplacementsOnly:true,maxIntelligenceExceptions:null,maxSearchNodes:100000};
  const policy={minFamilies:5,maxFamilies:8,maxSeatsPerFamily:2,codingConstraints:{heavyDifferentFromImplementer:true,reviewerDifferentFromImplementer:true,reviewerDifferentFromHeavy:true,heavyMinimumImplementerQualityDelta:2},modes:{budget:{minFamilies:5,postSelectionOptimization:settings}}};
  return {roles,originals,initial:{...summarizeAssign(assign),assign,familyCount:8},pool:originals.slice(),policy,modeId:'budget',intelligenceThreshold:60,generationEligibleForRole:()=>true,costOf:m=>m.cost,familyOf:m=>m.family,summarizeAssign,estimatedLimit:1};
}
const input=setup();
for(const role of ['architect','security-reviewer','researcher'])input.pool.push(model('cheap-'+role,role,{cost:.05,quality:79.5,intelligence:20,family:'initial-'+role}));
const actual=optimizePostSelectionCost(input);
assert.equal(actual.report.status,'applied');
assert.equal(actual.report.intelligenceExceptions.length,3,'Three measured specialists can pass below the initial cutoff');
assert.equal(actual.report.optimizedCostUsd,5.15);
assert.equal(actual.report.positivePointLoss,1.5);
assert.deepEqual([...input.initial.assign.values()].map(m=>m.name),roles.map(r=>'initial-'+r),'The initial reference must not move after optimization');

const tooWeak=setup();tooWeak.pool.push(model('too-weak','architect',{cost:0,quality:78.99,intelligence:20}));
assert.equal(optimizePostSelectionCost(tooWeak).result,tooWeak.initial,'A cheap score outside the one-point role bound is rejected');

const global=setup();
for(const role of ['architect','security-reviewer','researcher'])global.pool.push(model('loss-'+role,role,{cost:.05,quality:79.1,intelligence:20,family:'initial-'+role}));
global.pool.push(model('gain-synthesizer','synthesizer',{cost:.05,quality:90,intelligence:20,family:'initial-synthesizer'}));
const guarded=optimizePostSelectionCost(global);
assert.equal(guarded.report.optimizedCostUsd,5.15,'A ten-point gain cannot cancel three separate 0.9-point losses');
assert.equal(guarded.report.positivePointLoss,1.8);

const unmeasured=setup();
const estimate=model('estimated-specialist','architect',{cost:0,quality:80,intelligence:20});estimate.roleScores.architect.status='estimated';
const oldIndex=model('old-index','architect',{cost:0,quality:80,intelligence:20});oldIndex.aaModel.intelligenceIndexVersion='4.3';
unmeasured.pool.push(estimate,oldIndex);
assert.equal(optimizePostSelectionCost(unmeasured).result,unmeasured.initial,'New exceptions require measured role quality and observed Intelligence v5');

const immaterial=setup();immaterial.pool.push(model('tiny-saving','architect',{cost:.9,quality:80,intelligence:20}));
assert.equal(optimizePostSelectionCost(immaterial).report.status,'no-material-savings');

const bounded=setup();bounded.pool.push(...input.pool.slice(8));bounded.policy.modes.budget.postSelectionOptimization.maxSearchNodes=1;
const aborted=optimizePostSelectionCost(bounded);
assert.equal(aborted.report.status,'search-limit');assert.equal(aborted.result,bounded.initial,'An incomplete search must preserve the original portfolio');

// The cheapest complete assignment needs a locally more expensive swap to
// free a family seat. Independent greedy cost swaps cannot find this result.
const coupled=setup();
const families=['A','A','E','D','B','B','C','C'];coupled.originals.forEach((m,i)=>m.family=families[i]);
coupled.pool.push(model('paid-architect','architect',{cost:1.1,family:'C'}),model('free-researcher','researcher',{cost:0,family:'A',intelligence:20}));
const joint=optimizePostSelectionCost(coupled);
assert.equal(joint.report.optimizedCostUsd,7.1);
assert.equal(joint.result.assign.get('architect').name,'paid-architect');
assert.equal(joint.result.assign.get('researcher').name,'free-researcher');
console.log('ok: unlimited measured Intelligence exceptions, joint optimization, fixed quality bounds, no compensation, material savings and search-limit fallback');
