import assert from 'node:assert/strict';
import {optimizePostSelectionCost,scorePriceExchange} from './lib/post-selection-cost.mjs';
import {portfolioRoleQuality} from './lib/role-approximations.mjs';

const roles=['architect','strategist','security-reviewer','code-reviewer','implementer','implementer-heavy','synthesizer','researcher'];
function model(name,role,{cost=1,quality=80,intelligence=80,family=name}={}){
  const roleScores=Object.fromEntries(roles.map(r=>[r,{status:'valid',completeness:'complete',rankingQuality:r===role?quality:0,scoreRange:{lower:r===role?quality:0,upper:r===role?quality:0}}]));
  if(role==='implementer-heavy')roleScores.implementer={status:'valid',completeness:'complete',rankingQuality:85,scoreRange:{lower:85,upper:85}};
  return {name,family,cost,aaModel:{slug:name,intelligenceIndex:intelligence,intelligenceIndexVersion:'5.0'},benchmarkProvenance:{intelligenceIndex:{status:'observed'}},roleScores};
}
function setup(modeId='budget'){
  const originals=roles.map(r=>model('initial-'+r,r));
  const assign=new Map(roles.map((r,i)=>[r,originals[i]]));
  const summarizeAssign=assign=>({totalPlanAdjustedCost:[...assign.values()].reduce((sum,m)=>sum+m.cost,0),totalQuality:[...assign].reduce((sum,[r,m])=>sum+portfolioRoleQuality(m,r),0),placementInversionCost:0,signature:roles.map(r=>assign.get(r)?.name??'').join('|')});
  const settings={enabled:true,objective:'minimize-plan-adjusted-cost',exchangeRule:'price-saving-percent-per-quality-point',savingPercentPerPoint:modeId==='budget'?5:10,measuredReplacementsOnly:true,maxIntelligenceExceptions:null,maxSwaps:null,maxSearchNodes:100000};
  const policy={minFamilies:5,maxFamilies:8,maxSeatsPerFamily:2,codingConstraints:{heavyDifferentFromImplementer:true,reviewerDifferentFromImplementer:true,reviewerDifferentFromHeavy:true,heavyMinimumImplementerQualityDelta:2},modes:{[modeId]:{minFamilies:5,postSelectionOptimization:settings}}};
  return {roles,originals,initial:{...summarizeAssign(assign),assign,familyCount:8},pool:originals.slice(),policy,modeId,intelligenceThreshold:60,generationEligibleForRole:()=>true,costOf:m=>m.cost,familyOf:m=>m.family,summarizeAssign,estimatedLimit:1};
}

// Points are absolute role-score points, with continuous proportional savings.
for(const rate of [5,10]){
  for(const loss of [.5,1,10]){
    const minimum=rate*loss;
    assert.equal(scorePriceExchange(80,80-loss,100,100-minimum,rate).allowed,true);
    assert.equal(scorePriceExchange(80,80-loss,100,100-minimum+.001,rate).allowed,false);
  }
  assert.equal(scorePriceExchange(80,90,1,1.01,rate).allowed,false,'Quality gains do not authorize a more expensive swap');
  assert.equal(scorePriceExchange(80,80,0,0,rate).allowed,true);
  assert.equal(scorePriceExchange(80,81,0,0,rate).allowed,true);
  assert.equal(scorePriceExchange(80,79,0,0,rate).allowed,false,'A free initial role cannot finance a quality loss');
  assert.equal(scorePriceExchange(80,90,0,.01,rate).allowed,false);
}
assert.equal(scorePriceExchange(80,60,1,0,5).allowed,true);
assert.equal(scorePriceExchange(80,59.99,1,0,5).allowed,false);
assert.equal(scorePriceExchange(80,70,1,0,10).allowed,true);
assert.equal(scorePriceExchange(80,69.99,1,0,10).allowed,false);

for(const mode of ['budget','balanced']){
  const input=setup(mode),rate=mode==='budget'?5:10;
  input.pool.push(model('just-short','architect',{cost:1-(rate-.1)/100,quality:79,intelligence:20}));
  assert.equal(optimizePostSelectionCost(input).result,input.initial,'A near miss cannot pass the mode-specific exchange rate');
  input.pool.push(model('exact-exchange','architect',{cost:1-rate/100,quality:79,intelligence:20}));
  assert.equal(optimizePostSelectionCost(input).result.assign.get('architect').name,'exact-exchange');
}

const input=setup();
for(const role of roles)input.pool.push(model('cheap-'+role,role,{cost:.05,quality:70,intelligence:20,family:'initial-'+role}));
const actual=optimizePostSelectionCost(input);
assert.equal(actual.report.status,'applied');
assert.equal(actual.report.intelligenceExceptions.length,8,'All eight measured seats can pass below the initial cutoff');
assert.equal(actual.report.changes.length,8,'There is no swap-count ceiling');
assert.equal(actual.report.optimizedCostUsd,.4);
assert.equal(actual.report.positivePointLoss,80,'Losses beyond the old per-role and mean caps are permitted when paid for');
assert.deepEqual([...input.initial.assign.values()].map(m=>m.name),roles.map(r=>'initial-'+r),'Optimization must not move its initial reference');
assert.deepEqual(optimizePostSelectionCost(input).report,actual.report,'Repeating against the same initial reference must not accumulate losses');

const tiny=setup();tiny.pool.push(model('tiny-saving','architect',{cost:.975,quality:79.5,intelligence:20}));
const small=optimizePostSelectionCost(tiny);
assert.equal(small.report.status,'applied','The per-role exchange can qualify below the old total-savings threshold');
assert.equal(small.report.optimizedCostUsd,7.975);

const unmeasured=setup();
const estimate=model('estimated-specialist','architect',{cost:0,intelligence:20});estimate.roleScores.architect.status='estimated';
const oldIndex=model('old-index','architect',{cost:0,intelligence:20});oldIndex.aaModel.intelligenceIndexVersion='4.3';
const unknown=model('unknown-index','architect',{cost:0,intelligence:20});unknown.benchmarkProvenance.intelligenceIndex.status='estimated';
unmeasured.pool.push(estimate,oldIndex,unknown);
assert.equal(optimizePostSelectionCost(unmeasured).result,unmeasured.initial,'New exceptions still require measured role quality and observed Intelligence v5');

const bounded=setup();bounded.pool.push(...input.pool.slice(8));bounded.policy.modes.budget.postSelectionOptimization.maxSearchNodes=1;
const aborted=optimizePostSelectionCost(bounded);
assert.equal(aborted.report.status,'search-limit');assert.equal(aborted.result,bounded.initial,'An incomplete search must preserve the initial portfolio');

// Two cheaper swaps must be solved together to stay within family seat limits.
const coupled=setup();
const families=['A','A','E','D','B','B','C','C'];coupled.originals.forEach((m,i)=>m.family=families[i]);
coupled.pool.push(model('cheaper-architect','architect',{cost:.9,quality:79.5,family:'C'}),model('free-researcher','researcher',{cost:0,family:'A',intelligence:20}));
const joint=optimizePostSelectionCost(coupled);
assert.equal(joint.report.optimizedCostUsd,6.9);
assert.equal(joint.result.assign.get('architect').name,'cheaper-architect');
assert.equal(joint.result.assign.get('researcher').name,'free-researcher');

const structural=setup();
const weakHeavy=model('weak-heavy','implementer-heavy',{cost:0});weakHeavy.roleScores.implementer.rankingQuality=0;
structural.pool.push(weakHeavy,model('dependent-reviewer','code-reviewer',{cost:0,family:'initial-implementer'}));
assert.equal(optimizePostSelectionCost(structural).result,structural.initial,'Cost cannot bypass coding independence or the Heavy improvement rule');
const historical=setup();historical.pool.push(model('old-generation','architect',{cost:0}));historical.generationEligibleForRole=m=>m.name!=='old-generation';
assert.equal(optimizePostSelectionCost(historical).result,historical.initial,'Cheap historical generations remain excluded');
console.log('ok: proportional 5%/10% exchanges, fractional and free-price boundaries, unlimited swaps, measured exceptions, joint family constraints and fixed-reference fallback');
