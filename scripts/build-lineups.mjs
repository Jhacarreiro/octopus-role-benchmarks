import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {portfolioIntelligence,portfolioRoleQuality,approximationSeats,independentEvidence,reviewerQualityPasses} from './lib/role-approximations.mjs';
import { isLatestGenerationModel, isLatestGenerationOrBeatsLatest, modelFamily } from './lib/model-family.mjs';
import { planEconomics, billingCategory as validatedBillingCategory, planAdjustedTaskCost, monthlyUtilization as planMonthlyUtilization } from './lib/plan-economics.mjs';
import {filterPortfolioPrices} from './lib/portfolio-price-filter.mjs';
import {optimizePostSelectionCost} from './lib/post-selection-cost.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]};
const snapshotPath=option('--snapshot');
const outputPath=option('--output');
if(snapshotPath&&!outputPath)throw new Error('--snapshot requires --output for an isolated comparison');
const latest=JSON.parse(fs.readFileSync(snapshotPath??path.join(root,'data','latest.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const roles=latest.roles.map(r=>r.id);
const EPS=1e-12;

function fail(msg){throw new Error(`lineup policy: ${msg}`)}
function round(n,d=6){const p=10**d;return Math.round((n+Number.EPSILON)*p)/p}
function benchmarkIdentity(m){return m.aaModel?.slug?`aa:${m.aaModel.slug}`:`model:${m.name}`}
const intelligence=portfolioIntelligence;
function creditBurn(m){return Number(m.taskEfficiency?.commandCodeCostPerTaskUsd)}
const roleQuality=portfolioRoleQuality;
const estimatedLimit=latest.approximationPolicy?.enabled?latest.approximationPolicy.maxSeatsPerPortfolio:0;
if(latest.methodologyVersion>=10&&estimatedLimit!==0&&estimatedLimit!==1)fail('Invalid approximation seat limit');
const withinApproximationLimit=assign=>approximationSeats(assign)<=estimatedLimit;
const stateKey=(counts,assign)=>counts.join(',')+(estimatedLimit?'|'+approximationSeats(assign):'');
const implementerUpper=m=>m.approximation?m.roleScores?.implementer?.scoreRange?.upper:roleQuality(m,'implementer');
function roleBalanced(m,role){const n=m.roleScores?.[role]?.rankingValue;return Number.isFinite(n)?n:NaN}
function roleBudget(m,role){const s=m.roleScores?.[role];return Number.isFinite(s?.balancedQualityPercentile)&&Number.isFinite(s?.balancedAffordabilityPercentile)?0.4*s.balancedQualityPercentile+0.6*s.balancedAffordabilityPercentile:NaN}
function familyOf(m){return modelFamily(m,policy)}
function familyCount(models){return new Set(models.map(familyOf).filter(Boolean)).size}
function signature(assign){return roles.map(r=>`${r}:${assign.get(r)?.name||''}`).join('|')}

const placementPriority=policy.premiumPlacement?.rolePriority??[];
const placementRank=new Map(placementPriority.map((role,index)=>[role,placementPriority.length-index]));
function placementStats(assign){
  let inversionCost=0,inversionCount=0;
  const entries=[...assign.entries()].filter(([role,m])=>placementRank.has(role)&&m&&Number.isFinite(planAdjustedCost(m)));
  for(const [higherRole,higherModel] of entries){
    for(const [lowerRole,lowerModel] of entries){
      if((placementRank.get(higherRole)??0)<=(placementRank.get(lowerRole)??0))continue;
      const higherCost=planAdjustedCost(higherModel),lowerCost=planAdjustedCost(lowerModel);
      if(lowerCost>higherCost+EPS){inversionCost+=lowerCost-higherCost;inversionCount++;}
    }
  }
  return {placementInversionCost:inversionCost,placementInversionCount:inversionCount};
}
function betterPlacement(a,b){
  if(!b)return true;
  if(Math.abs(a.placementInversionCost-b.placementInversionCost)>EPS)return a.placementInversionCost<b.placementInversionCost;
  if(a.placementInversionCount!==b.placementInversionCount)return a.placementInversionCount<b.placementInversionCount;
  if(Math.abs(a.totalQuality-b.totalQuality)>EPS)return a.totalQuality>b.totalQuality;
  return a.signature<b.signature;
}

const economics=planEconomics(policy);

function billingCategory(m){
  return validatedBillingCategory(m,economics);
}
function planAdjustedCost(m){
  const adjusted=planAdjustedTaskCost(creditBurn(m),m,economics);
  return adjusted==null?NaN:adjusted;
}
function burnVector(m){
  const raw=creditBurn(m);
  if(!Number.isFinite(raw)||raw<0)fail(`${m.name}: invalid CommandCode credit burn`);
  const c=billingCategory(m);
  if(c==='standard')return {standard:raw,premium:0};
  if(c==='premium')return {standard:0,premium:raw};
  return {standard:0,premium:0};
}
function portfolioUtilization(standardBurn,premiumBurn){
  return planMonthlyUtilization(standardBurn,premiumBurn,economics);
}

const base=latest.models.filter(m=>
  m.generationEligibility?.eligible!==false &&
  m.modelEligibility?.eligible!==false &&
  m.mapping?.status!=='unscored' &&
  m.mapping?.status!=='source_incomplete' &&
  Number.isFinite(intelligence(m)) &&
  m.roleScores
);
const referenceBase=base.filter(m=>!m.approximation||Number.isFinite(m.aaModel?.intelligenceIndex));
const generationEligible=policy.latestGenerationOnly
  ? referenceBase.filter(m=>isLatestGenerationModel(m,referenceBase,{scoredOnly:true}))
  : referenceBase.slice();

function generationEligibleForRole(model,role){
  if(!policy.latestGenerationOnly)return true;
  return isLatestGenerationOrBeatsLatest(model,referenceBase,m=>roleQuality(m,role),{scoredOnly:true});
}

if(!generationEligible.length)fail('no scored models with AA Intelligence Index');
for(const m of base){
  billingCategory(m);
  if(!Number.isFinite(creditBurn(m))||creditBurn(m)<0)fail(`${m.name}: missing task credit burn`);
}
const bestIntelligence=Math.max(...generationEligible.map(intelligence));

function prepareModeUniverse(modeId,mode,requested){
  let universe=base.slice();
  let modeBestIntelligence=bestIntelligence;
  let priceFilter=null;
  if(mode.priceRankFilter&&!mode.priceOutlierFilter)fail(`${modeId}: ranked exclusions require the subsequent statistical price filter`);
  if(mode.priceOutlierFilter){
    const metric=mode.priceOutlierFilter.costMetric??'commandCodeCostPerTaskUsd';
    if(mode.priceRankFilter&&(mode.priceRankFilter.method!=='highest-distinct-cost-levels'||mode.priceRankFilter.costMetric!==metric||!Number.isInteger(mode.priceRankFilter.excludeHighestPriceLevels)||mode.priceRankFilter.excludeHighestPriceLevels<1))fail(`${modeId}: ranked price filter requires a positive level count and the same cost metric as the statistical filter`);
    const costFn=metric==='planAdjustedCostPerTaskUsd'?planAdjustedCost:creditBurn;
    const sigma=Number(mode.priceOutlierFilter.standardDeviations);
    const filtered=filterPortfolioPrices(universe,generationEligible,{highestPriceLevels:mode.priceRankFilter?.excludeHighestPriceLevels??0,standardDeviations:sigma},costFn);
    const {mean,sd,cutoff,referencePool,latestSurvivors}=filtered;
    universe=filtered.models;
    const requiredFamilies=Number(policy.poolPrecheck?.minFamilies??5);
    if(familyCount(latestSurvivors)<requiredFamilies)fail(`${modeId}: price filter leaves only ${familyCount(latestSurvivors)} latest-generation families (precheck requires ${requiredFamilies})`);
    modeBestIntelligence=Math.max(...latestSurvivors.map(intelligence));
    priceFilter={
      method:mode.priceOutlierFilter.method,
      costMetric:metric,
      standardDeviations:sigma,
      filterOrder:['highest-price-levels','mean-plus-population-standard-deviations'],
      rankFilter:{
        method:'highest-distinct-cost-levels',
        costMetric:metric,
        requestedPriceLevels:mode.priceRankFilter?.excludeHighestPriceLevels??0,
        tiePrecisionDecimals:6,
        referencePopulation:'portfolio-candidates-before-intelligence-floor',
        referenceModels:base.length,
        referencePriceLevels:filtered.referencePriceLevels,
        excludedPriceLevels:filtered.excludedPriceLevels,
        excluded:filtered.rankedOut.map(m=>m.name)
      },
      referencePopulation:'latest-generation-scored-universe-after-ranked-price-exclusions',
      referenceModels:referencePool.length,
      referenceFamilies:familyCount(referencePool),
      preFilterBestEligibleIntelligenceIndex:round(bestIntelligence,4),
      meanCostPerTaskUsd:round(mean,6),
      populationStdDevCostPerTaskUsd:round(sd,6),
      cutoffCostPerTaskUsd:round(cutoff,6),
      postFilterBestEligibleIntelligenceIndex:round(modeBestIntelligence,4),
      excluded:[...filtered.rankedOut,...filtered.outliers].map(m=>({
        model:m.name,
        reason:filtered.rankedOut.includes(m)?'highest-price-level':'statistical-outlier',
        family:familyOf(m),
        billingCategory:billingCategory(m),
        creditBurnPerTaskUsd:round(creditBurn(m),6),
        planAdjustedCostPerTaskUsd:round(planAdjustedCost(m),6)
      }))
    };
  }
  return {universe,bestEligibleIntelligence:modeBestIntelligence,priceFilter};
}

function summarizeAssign(assign){
  let totalQuality=0,totalBalanced=0,totalBudget=0,totalCreditBurn=0,totalPlanAdjustedCost=0,standardBurn=0,premiumBurn=0;
  for(const [role,m] of assign){
    totalQuality+=roleQuality(m,role);
    const balanced=roleBalanced(m,role);
    if(Number.isFinite(balanced))totalBalanced+=balanced;
    const budget=roleBudget(m,role);
    if(Number.isFinite(budget))totalBudget+=budget;
    totalCreditBurn+=creditBurn(m);
    totalPlanAdjustedCost+=planAdjustedCost(m);
    const b=burnVector(m);
    standardBurn+=b.standard;
    premiumBurn+=b.premium;
  }
  const utilization=portfolioUtilization(standardBurn,premiumBurn);
  return {
    totalQuality,
    totalBalanced,
    totalBudget,
    totalCreditBurn,
    totalPlanAdjustedCost,
    standardBurn,
    premiumBurn,
    monthlyUtilization:utilization,
    ...placementStats(assign),
    signature:[...assign].sort(([a],[b])=>a.localeCompare(b)).map(([r,m])=>`${r}:${m.name}`).join('|')
  };
}

function betterCandidate(modeId,a,b){
  if(!b)return true;
  if(modeId==='budget'){
    if(Math.abs(a.totalBudget-b.totalBudget)>EPS)return a.totalBudget>b.totalBudget;
    if(Math.abs(a.totalPlanAdjustedCost-b.totalPlanAdjustedCost)>EPS)return a.totalPlanAdjustedCost<b.totalPlanAdjustedCost;
    if(Math.abs(a.totalQuality-b.totalQuality)>EPS)return a.totalQuality>b.totalQuality;
    if(Math.abs(a.placementInversionCost-b.placementInversionCost)>EPS)return a.placementInversionCost<b.placementInversionCost;
    if(a.placementInversionCount!==b.placementInversionCount)return a.placementInversionCount<b.placementInversionCount;
    if(Math.abs(a.totalCreditBurn-b.totalCreditBurn)>EPS)return a.totalCreditBurn<b.totalCreditBurn;
  }else if(modeId==='balanced'){
    if(Math.abs(a.totalBalanced-b.totalBalanced)>EPS)return a.totalBalanced>b.totalBalanced;
    if(Math.abs(a.totalQuality-b.totalQuality)>EPS)return a.totalQuality>b.totalQuality;
    if(Math.abs(a.totalPlanAdjustedCost-b.totalPlanAdjustedCost)>EPS)return a.totalPlanAdjustedCost<b.totalPlanAdjustedCost;
  }else{
    if(Math.abs(a.totalQuality-b.totalQuality)>EPS)return a.totalQuality>b.totalQuality;
    if(Math.abs(a.placementInversionCost-b.placementInversionCost)>EPS)return a.placementInversionCost<b.placementInversionCost;
    if(a.placementInversionCount!==b.placementInversionCount)return a.placementInversionCount<b.placementInversionCount;
    if(Math.abs(a.totalPlanAdjustedCost-b.totalPlanAdjustedCost)>EPS)return a.totalPlanAdjustedCost<b.totalPlanAdjustedCost;
  }
  return a.signature<b.signature;
}

function budgetDominates(a,b){
  const A=a.partial,B=b.partial;
  if(A.totalBudget>B.totalBudget+EPS)return true;
  if(A.totalBudget<B.totalBudget-EPS)return false;
  if(A.totalPlanAdjustedCost<B.totalPlanAdjustedCost-EPS)return true;
  if(A.totalPlanAdjustedCost>B.totalPlanAdjustedCost+EPS)return false;
  if(A.totalQuality>B.totalQuality+EPS)return true;
  if(A.totalQuality<B.totalQuality-EPS)return false;
  if(A.placementInversionCost<B.placementInversionCost-EPS)return true;
  if(A.placementInversionCost>B.placementInversionCost+EPS)return false;
  if(A.placementInversionCount<B.placementInversionCount)return true;
  if(A.placementInversionCount>B.placementInversionCount)return false;
  if(A.totalCreditBurn<B.totalCreditBurn-EPS)return true;
  if(A.totalCreditBurn>B.totalCreditBurn+EPS)return false;
  return A.signature<=B.signature;
}
function insertBudgetState(list,state){
  for(const existing of list)if(budgetDominates(existing,state))return list;
  return [...list.filter(existing=>!budgetDominates(state,existing)),state];
}

function optimize(modeId,pool,{allowNoFeasible=false}={}){
  const minFamilies=Number(policy.modes?.[modeId]?.minFamilies??policy.minFamilies??1);
  const maxFamilies=Number(policy.maxFamilies??roles.length);
  const maxSeats=Number(policy.maxSeatsPerFamily??roles.length);
  const families=[...new Set(pool.map(familyOf).filter(Boolean))].sort();
  const familyIndex=new Map(families.map((f,i)=>[f,i]));
  const roleCandidates={};
  for(const role of roles){
    roleCandidates[role]=pool.filter(m=>
      generationEligibleForRole(m,role) &&
      Number.isFinite(roleQuality(m,role)) &&
      (modeId!=='balanced'||Number.isFinite(roleBalanced(m,role))) &&
      (modeId!=='budget'||Number.isFinite(roleBudget(m,role)))
    );
    if(!roleCandidates[role].length){
      if(allowNoFeasible)return null;
      fail(`${modeId}/${role}: no eligible candidates`);
    }
  }

  const implementers=roleCandidates['implementer'];
  const heavies=roleCandidates['implementer-heavy'];
  const reviewers=roleCandidates['code-reviewer'];
  const standardRoles=roles.filter(r=>!['implementer','implementer-heavy','code-reviewer'].includes(r));
  const heavyDelta=Number(policy.codingConstraints?.heavyMinimumImplementerQualityDelta);
  if(!Number.isFinite(heavyDelta)||heavyDelta<=0)fail("invalid heavyMinimumImplementerQualityDelta");
  let best=null;

  function buildCandidate(assign){
    const selected=roles.map(r=>assign.get(r));
    if(!withinApproximationLimit(assign))return null;
    const famCount=familyCount(selected);
    if(famCount<minFamilies||famCount>maxFamilies)return null;
    return {...summarizeAssign(assign),assign,familyCount:famCount,signature:signature(assign)};
  }

  function buildCandidatePartial(assign){return summarizeAssign(assign)}

  function fillStandard(initialCounts,initialAssign){
    if(!withinApproximationLimit(initialAssign))return;
    if(modeId==='budget'){
      let states=new Map([[stateKey(initialCounts,initialAssign),[{counts:initialCounts,assign:initialAssign,partial:buildCandidatePartial(initialAssign)}]]]);
      for(const role of standardRoles){
        const next=new Map();
        for(const list of states.values()){
          for(const st of list){
            for(const m of roleCandidates[role]){
              const idx=familyIndex.get(familyOf(m));
              if(idx==null||st.counts[idx]>=maxSeats)continue;
              const counts=st.counts.slice();
              counts[idx]++;
              const assign=new Map(st.assign);
              assign.set(role,m);
              if(!withinApproximationLimit(assign))continue;
              const key=stateKey(counts,assign);
              const state={counts,assign,partial:buildCandidatePartial(assign)};
              next.set(key,insertBudgetState(next.get(key)||[],state));
            }
          }
        }
        states=next;
        if(!states.size)return;
      }
      for(const list of states.values()){
        for(const st of list){
          const candidate=buildCandidate(st.assign);
          if(candidate&&betterCandidate(modeId,candidate,best))best=candidate;
        }
      }
      return;
    }

    let states=new Map([[stateKey(initialCounts,initialAssign),{counts:initialCounts,assign:initialAssign,partial:buildCandidatePartial(initialAssign)}]]);
    for(const role of standardRoles){
      const next=new Map();
      for(const st of states.values()){
        for(const m of roleCandidates[role]){
          const idx=familyIndex.get(familyOf(m));
          if(idx==null||st.counts[idx]>=maxSeats)continue;
          const counts=st.counts.slice();
          counts[idx]++;
          const assign=new Map(st.assign);
          assign.set(role,m);
          if(!withinApproximationLimit(assign))continue;
          const key=stateKey(counts,assign);
          const candidate=buildCandidatePartial(assign);
          const prev=next.get(key);
          const candidateMetric=modeId==='balanced'?candidate.totalBalanced:candidate.totalQuality;
          const prevMetric=prev?(modeId==='balanced'?prev.partial.totalBalanced:prev.partial.totalQuality):null;
          if(!prev || candidateMetric>prevMetric+EPS || (
            Math.abs(candidateMetric-prevMetric)<=EPS &&
            (
              candidate.totalQuality>prev.partial.totalQuality+EPS ||
              (Math.abs(candidate.totalQuality-prev.partial.totalQuality)<=EPS && (
                candidate.placementInversionCost<prev.partial.placementInversionCost-EPS ||
                (Math.abs(candidate.placementInversionCost-prev.partial.placementInversionCost)<=EPS && (
                  candidate.placementInversionCount<prev.partial.placementInversionCount ||
                  (candidate.placementInversionCount===prev.partial.placementInversionCount && (
                    candidate.totalPlanAdjustedCost<prev.partial.totalPlanAdjustedCost-EPS ||
                    (Math.abs(candidate.totalPlanAdjustedCost-prev.partial.totalPlanAdjustedCost)<=EPS && candidate.signature<prev.partial.signature)
                  ))
                ))
              ))
            )
          )){
            next.set(key,{counts,assign,partial:candidate});
          }
        }
      }
      states=next;
      if(!states.size)return;
    }
    for(const st of states.values()){
      const candidate=buildCandidate(st.assign);
      if(candidate&&betterCandidate(modeId,candidate,best))best=candidate;
    }
  }

  for(const impl of implementers){
    for(const heavy of heavies){
      if(policy.codingConstraints?.heavyDifferentFromImplementer!==false && !independentEvidence(heavy,impl,'implementer-heavy','implementer'))continue;
      if(!Number.isFinite(roleQuality(heavy,'implementer'))||roleQuality(heavy,'implementer')+EPS<implementerUpper(impl)+heavyDelta)continue;
      for(const reviewer of reviewers){
        if(!reviewerQualityPasses(reviewer,[impl,heavy],policy.codingConstraints.reviewerMinimumReviewerQualityDelta))continue;
        if(!independentEvidence(reviewer,impl,'code-reviewer','implementer')||!independentEvidence(reviewer,heavy,'code-reviewer','implementer-heavy'))continue;
        if(policy.codingConstraints?.reviewerDifferentFromImplementer!==false && familyOf(reviewer)===familyOf(impl))continue;
        if(policy.codingConstraints?.reviewerDifferentFromHeavy!==false && familyOf(reviewer)===familyOf(heavy))continue;
        const counts=Array(families.length).fill(0);
        let valid=true;
        for(const m of [impl,heavy,reviewer]){
          const idx=familyIndex.get(familyOf(m));
          if(idx==null){valid=false;break}
          counts[idx]++;
          if(counts[idx]>maxSeats){valid=false;break}
        }
        if(!valid)continue;
        fillStandard(counts,new Map([
          ['implementer',impl],
          ['implementer-heavy',heavy],
          ['code-reviewer',reviewer]
        ]));
      }
    }
  }
  if(!best){
    if(allowNoFeasible)return null;
    fail(`${modeId}: no feasible portfolio`);
  }
  if(modeId==='balanced' && policy.premiumPlacement?.balancedMaxObjectiveLossPercent!=null){
    const tolerancePct=Number(policy.premiumPlacement.balancedMaxObjectiveLossPercent);
    if(!Number.isFinite(tolerancePct)||tolerancePct<0||tolerancePct>=100)fail('premiumPlacement.balancedMaxObjectiveLossPercent must be in [0,100)');
    const minimumBalanced=best.totalBalanced*(1-tolerancePct/100);
    const maxRemaining=Object.fromEntries(standardRoles.map(role=>[role,Math.max(...roleCandidates[role].map(m=>roleBalanced(m,role)))]));
    let placementBest=null;
    function recurseStandard(index,counts,assign,partialBalanced){
      if(index===standardRoles.length){
        const candidate=buildCandidate(assign);
        if(candidate&&candidate.totalBalanced+EPS>=minimumBalanced&&betterPlacement(candidate,placementBest))placementBest=candidate;
        return;
      }
      let optimistic=partialBalanced;
      for(let i=index;i<standardRoles.length;i++)optimistic+=maxRemaining[standardRoles[i]];
      if(optimistic+EPS<minimumBalanced)return;
      const role=standardRoles[index];
      for(const m of roleCandidates[role]){
        const idx=familyIndex.get(familyOf(m));
        if(idx==null||counts[idx]>=maxSeats)continue;
        const nextCounts=counts.slice();nextCounts[idx]++;
        const nextAssign=new Map(assign);nextAssign.set(role,m);
        if(!withinApproximationLimit(nextAssign))continue;
        recurseStandard(index+1,nextCounts,nextAssign,partialBalanced+roleBalanced(m,role));
      }
    }
    for(const impl of implementers){
      for(const heavy of heavies){
        if(policy.codingConstraints?.heavyDifferentFromImplementer!==false && !independentEvidence(heavy,impl,'implementer-heavy','implementer'))continue;
        if(!Number.isFinite(roleQuality(heavy,'implementer'))||roleQuality(heavy,'implementer')+EPS<implementerUpper(impl)+heavyDelta)continue;
        for(const reviewer of reviewers){
        if(!reviewerQualityPasses(reviewer,[impl,heavy],policy.codingConstraints.reviewerMinimumReviewerQualityDelta))continue;
          if(!independentEvidence(reviewer,impl,'code-reviewer','implementer')||!independentEvidence(reviewer,heavy,'code-reviewer','implementer-heavy'))continue;
          if(policy.codingConstraints?.reviewerDifferentFromImplementer!==false && familyOf(reviewer)===familyOf(impl))continue;
          if(policy.codingConstraints?.reviewerDifferentFromHeavy!==false && familyOf(reviewer)===familyOf(heavy))continue;
          const counts=Array(families.length).fill(0);let valid=true;
          for(const m of [impl,heavy,reviewer]){const idx=familyIndex.get(familyOf(m));if(idx==null){valid=false;break}counts[idx]++;if(counts[idx]>maxSeats){valid=false;break}}
          if(!valid)continue;
          const assign=new Map([['implementer',impl],['implementer-heavy',heavy],['code-reviewer',reviewer]]);
          const partialBalanced=roleBalanced(impl,'implementer')+roleBalanced(heavy,'implementer-heavy')+roleBalanced(reviewer,'code-reviewer');
          recurseStandard(0,counts,assign,partialBalanced);
        }
      }
    }
    if(placementBest){placementBest.pureBalancedOptimum=best.totalBalanced;placementBest.balancedObjectiveLossPercent=100*(best.totalBalanced-placementBest.totalBalanced)/best.totalBalanced;best=placementBest;}
  }
  return best;
}

function solveMode(modeId,mode){
  const requested=Number(mode.requestedIntelligenceFloor);
  const step=Number(policy.poolPrecheck?.floorStep??0.005);
  const requiredFamilies=Number(policy.poolPrecheck?.minFamilies??5);
  if(!Number.isFinite(requested)||requested<=0||requested>1)fail(`${modeId}: invalid requestedIntelligenceFloor`);
  if(!Number.isFinite(step)||step<=0)fail('invalid poolPrecheck.floorStep');

  const prepared=prepareModeUniverse(modeId,mode,requested);
  let effective=requested;
  while(effective>=0){
    const threshold=prepared.bestEligibleIntelligence*effective;
    const rawPool=prepared.universe.filter(m=>intelligence(m)+EPS>=threshold);
    if(familyCount(rawPool)>=requiredFamilies){
      const poolInfo={
        requested,
        effective:round(effective,3),
        threshold:round(threshold,6),
        pool:rawPool,
        priceFilter:prepared.priceFilter,
        bestEligibleIntelligence:prepared.bestEligibleIntelligence
      };
      const result=optimize(modeId,poolInfo.pool,{allowNoFeasible:true});
      if(result){
        if(latest.methodologyVersion>=10&&mode.postSelectionOptimization?.enabled){
          const refined=optimizePostSelectionCost({roles,initial:result,pool:prepared.universe,policy,modeId,intelligenceThreshold:poolInfo.threshold,generationEligibleForRole,costOf:planAdjustedCost,familyOf,summarizeAssign,estimatedLimit});
          return {poolInfo,result:refined.result,postSelectionOptimization:refined.report};
        }
        return {poolInfo,result,postSelectionOptimization:null};
      }
    }
    effective=round(effective-step,3);
  }
  fail(`${modeId}: could not find a feasible portfolio from floor ${requested.toFixed(3)} downward in ${step.toFixed(3)} steps`);
}

const out={
  schemaVersion:policy.schemaVersion,
  snapshotDate:latest.date,
  generatedAt:latest.generatedAt,
  policy:{
    latestGenerationOnly:policy.latestGenerationOnly===true,
    previousGenerationRoleException:'allow when absolute role quality exceeds the best latest-generation peer in the same series',
    poolPrecheck:policy.poolPrecheck,
    minFamilies:policy.minFamilies,
    modeMinFamilies:Object.fromEntries(Object.entries(policy.modes).map(([id,mode])=>[id,Number(mode.minFamilies??policy.minFamilies??1)])),
    maxFamilies:policy.maxFamilies,
    maxSeatsPerFamily:policy.maxSeatsPerFamily,
    allowRepeatedModel:policy.allowRepeatedModel===true,
    allowRepeatedBenchmarkIdentity:policy.allowRepeatedBenchmarkIdentity===true,
    codingConstraints:policy.codingConstraints,
    planEconomics:policy.planEconomics
  },
  modes:{}
};
if(latest.methodologyVersion>=10){out.methodologyVersion=latest.methodologyVersion;out.snapshotGeneratedAt=latest.generatedAt;out.intelligenceIndexVersion='5.0';out.approximationPolicy=latest.approximationPolicy??{enabled:false};}

for(const [modeId,mode] of Object.entries(policy.modes)){
  const {poolInfo,result,postSelectionOptimization}=solveMode(modeId,mode);
  const selections={};
  for(const role of roles){
    const m=result.assign.get(role);
    selections[role]={
      model:m.name,
      family:familyOf(m),
      benchmarkIdentity:benchmarkIdentity(m),
      quality:round(roleQuality(m,role),3),
      costPerTaskUsd:round(creditBurn(m),6),
      creditBurnPerTaskUsd:round(creditBurn(m),6),
      planAdjustedCostPerTaskUsd:round(planAdjustedCost(m),6),
      billingCategory:billingCategory(m),
      max10MonthlyUsageLimitUsd:m.max10MonthlyUsageLimitUsd??null,
      max20MonthlyUsageLimitUsd:m.max20MonthlyUsageLimitUsd??null,
      intelligenceIndex:round(intelligence(m),4),
      ...(m.approximation?{measurementKind:m.roleScores[role].status==='estimated'?'estimated':'observed',approximation:m.approximation,roleEstimate:m.roleScores[role]}:{}),
      source:m.roleScores[role]?.status==='estimated'?'conservative-role-approximation':role==='security-reviewer'?(latest.methodologyVersion>=10?'cyberIndex':'cyberbench'):'scored',
      benchmarkProvenance:role==='security-reviewer'?(latest.methodologyVersion>=10?m.benchmarkProvenance?.cyberIndex??null:m.benchmarkProvenance?.cyberbench??null):null,
      free:m.free===true,
      discountPercent:m.discountPercent??null,
      dealDiscountPercent:m.dealDiscountPercent??null,
      dealMultiplier:m.dealMultiplier??1,
      max10EffectiveUsageUsd:m.max10EffectiveUsageUsd??m.max10MonthlyUsageLimitUsd??null,
      max20EffectiveUsageUsd:m.max20EffectiveUsageUsd??m.max20MonthlyUsageLimitUsd??null,
      mappingStatus:m.mapping?.status??null
    };
  }
  const capacity10=result.monthlyUtilization<=EPS?null:round(1/result.monthlyUtilization,3);
  const capacity20=result.monthlyUtilization<=EPS?null:round(economics.max20Scale/result.monthlyUtilization,3);
  out.modes[modeId]={
    label:mode.label??modeId,
    description:mode.description,
    objective:mode.objective,
    minFamilies:Number(mode.minFamilies??policy.minFamilies??1),
    requestedIntelligenceFloor:poolInfo.requested,
    effectiveIntelligenceFloor:poolInfo.effective,
    bestEligibleIntelligenceIndex:round(poolInfo.bestEligibleIntelligence,4),
    intelligenceThreshold:poolInfo.threshold,
    candidateModels:poolInfo.pool.length,
    candidateFamilies:familyCount(poolInfo.pool),
    priceFilter:poolInfo.priceFilter,
    ...(postSelectionOptimization?{postSelectionOptimization}:{}),
    familyCount:result.familyCount,
    totalRoleQuality:round(result.totalQuality,3),
    totalBalanced:round(result.totalBalanced,3),
    placementInversionCost:round(result.placementInversionCost,6),
    placementInversionCount:result.placementInversionCount,
    pureBalancedOptimum:result.pureBalancedOptimum==null?null:round(result.pureBalancedOptimum,3),
    balancedObjectiveLossPercent:result.balancedObjectiveLossPercent==null?null:round(result.balancedObjectiveLossPercent,4),
    totalCostPerTaskUsd:round(result.totalCreditBurn,6),
    totalCreditBurnPerPortfolioUsd:round(result.totalCreditBurn,6),
    totalPlanAdjustedCostPerPortfolioUsd:round(result.totalPlanAdjustedCost,6),
    standardCreditBurnPerPortfolioUsd:round(result.standardBurn,6),
    premiumCreditBurnPerPortfolioUsd:round(result.premiumBurn,6),
    max10MonthlyIncludedUtilization:round(result.monthlyUtilization,6),
    max10EstimatedCompletePortfoliosPerMonth:capacity10,
    max20EstimatedCompletePortfoliosPerMonth:capacity20,
    selections
  };
}

const text=JSON.stringify(out,null,2)+'\n';
const target=outputPath?path.resolve(outputPath):path.join(root,'site','data','lineups.json');
if(outputPath)for(const dir of ['site','data','config','.git']){const relative=path.relative(path.join(root,dir),target);if(relative===''||!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Comparison output cannot overwrite published/configuration files');}
if(check){
  const current=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
  if(current!==text)fail('site/data/lineups.json is stale; run node scripts/build-lineups.mjs');
  console.log('ok: generated lineup data matches current policy and snapshot');
}else{
  fs.writeFileSync(target,text);
  console.log(`wrote ${path.relative(root,target)} for snapshot ${latest.date}`);
  for(const [modeId,mode] of Object.entries(out.modes)){
    const capacity=mode.max10EstimatedCompletePortfoliosPerMonth==null?'unlimited':mode.max10EstimatedCompletePortfoliosPerMonth.toFixed(2);
    console.log(`${modeId}: floor=${mode.effectiveIntelligenceFloor.toFixed(3)} families=${mode.familyCount} creditBurn=${mode.totalCreditBurnPerPortfolioUsd.toFixed(6)} max10Capacity=${capacity}`);
    for(const role of roles)console.log(`  ${role}: ${mode.selections[role].model}`);
  }
}
