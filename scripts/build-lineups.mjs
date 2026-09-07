import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLatestGenerationModel, modelFamily } from './lib/model-family.mjs';
import { planEconomics, billingCategory as validatedBillingCategory, planAdjustedTaskCost, monthlyUtilization as planMonthlyUtilization } from './lib/plan-economics.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const latest=JSON.parse(fs.readFileSync(path.join(root,'data','latest.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const roles=latest.roles.map(r=>r.id);
const EPS=1e-12;

function fail(msg){throw new Error(`lineup policy: ${msg}`)}
function round(n,d=6){const p=10**d;return Math.round((n+Number.EPSILON)*p)/p}
function benchmarkIdentity(m){return m.aaModel?.slug?`aa:${m.aaModel.slug}`:`model:${m.name}`}
function intelligence(m){return Number(m.aaModel?.intelligenceIndex)}
function creditBurn(m){return Number(m.taskEfficiency?.commandCodeCostPerTaskUsd)}
function roleQuality(m,role){return Number(m.roleScores?.[role]?.rankingQuality)}
function familyOf(m){return modelFamily(m,policy)}
function familyCount(models){return new Set(models.map(familyOf).filter(Boolean)).size}
function signature(assign){return roles.map(r=>`${r}:${assign.get(r)?.name||''}`).join('|')}

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
  m.mapping?.status!=='unscored' &&
  m.mapping?.status!=='source_incomplete' &&
  Number.isFinite(intelligence(m)) &&
  m.roleScores
);
const generationEligible=policy.latestGenerationOnly
  ? base.filter(m=>isLatestGenerationModel(m,base,{scoredOnly:true}))
  : base.slice();

if(!generationEligible.length)fail('no scored models with AA Intelligence Index');
for(const m of generationEligible){
  billingCategory(m);
  if(!Number.isFinite(creditBurn(m))||creditBurn(m)<0)fail(`${m.name}: missing task credit burn`);
}
const bestIntelligence=Math.max(...generationEligible.map(intelligence));

function makePool(modeId,mode){
  const requested=Number(mode.requestedIntelligenceFloor);
  if(!Number.isFinite(requested)||requested<=0||requested>1)fail(`${modeId}: invalid requestedIntelligenceFloor`);
  const step=Number(policy.poolPrecheck?.floorStep??0.005);
  const requiredFamilies=Number(policy.poolPrecheck?.minFamilies??5);
  if(!Number.isFinite(step)||step<=0)fail('invalid poolPrecheck.floorStep');
  let effective=requested;
  let pool=[];
  while(effective>=0){
    const threshold=bestIntelligence*effective;
    pool=generationEligible.filter(m=>intelligence(m)+EPS>=threshold);
    if(familyCount(pool)>=requiredFamilies){
      return {requested,effective:round(effective,3),threshold:round(threshold,6),pool};
    }
    effective=round(effective-step,3);
  }
  fail(`${modeId}: could not reach ${requiredFamilies} eligible families`);
}

function populationStats(values){
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const variance=values.reduce((sum,x)=>sum+(x-mean)**2,0)/values.length;
  return {mean,sd:Math.sqrt(variance)};
}

function applyModeFilter(modeId,mode,poolInfo){
  let pool=poolInfo.pool.slice();
  let priceFilter=null;
  if(mode.priceOutlierFilter){
    const metric=mode.priceOutlierFilter.costMetric??'commandCodeCostPerTaskUsd';
    const costFn=metric==='planAdjustedCostPerTaskUsd'?planAdjustedCost:creditBurn;
    const values=pool.map(costFn).filter(x=>Number.isFinite(x)&&x>=0);
    if(values.length!==pool.length)fail(`${modeId}: price filter requires ${metric} for every eligible model`);
    const {mean,sd}=populationStats(values);
    const sigma=Number(mode.priceOutlierFilter.standardDeviations);
    const cutoff=mean+sigma*sd;
    const excluded=pool.filter(m=>costFn(m)>cutoff+EPS);
    pool=pool.filter(m=>costFn(m)<=cutoff+EPS);
    priceFilter={
      method:mode.priceOutlierFilter.method,
      costMetric:metric,
      standardDeviations:sigma,
      meanCostPerTaskUsd:round(mean,6),
      populationStdDevCostPerTaskUsd:round(sd,6),
      cutoffCostPerTaskUsd:round(cutoff,6),
      excluded:excluded.map(m=>({
        model:m.name,
        family:familyOf(m),
        billingCategory:billingCategory(m),
        creditBurnPerTaskUsd:round(creditBurn(m),6),
        planAdjustedCostPerTaskUsd:round(planAdjustedCost(m),6)
      }))
    };
    const requiredFamilies=Number(policy.poolPrecheck?.minFamilies??5);
    if(familyCount(pool)<requiredFamilies)fail(`${modeId}: price filter leaves only ${familyCount(pool)} families (precheck requires ${requiredFamilies})`);
  }
  return {...poolInfo,pool,priceFilter};
}

function summarizeAssign(assign){
  let totalQuality=0,totalCreditBurn=0,totalPlanAdjustedCost=0,standardBurn=0,premiumBurn=0;
  for(const [role,m] of assign){
    totalQuality+=roleQuality(m,role);
    totalCreditBurn+=creditBurn(m);
    totalPlanAdjustedCost+=planAdjustedCost(m);
    const b=burnVector(m);
    standardBurn+=b.standard;
    premiumBurn+=b.premium;
  }
  const utilization=portfolioUtilization(standardBurn,premiumBurn);
  return {
    totalQuality,
    totalCreditBurn,
    totalPlanAdjustedCost,
    standardBurn,
    premiumBurn,
    monthlyUtilization:utilization,
    signature:[...assign].sort(([a],[b])=>a.localeCompare(b)).map(([r,m])=>`${r}:${m.name}`).join('|')
  };
}

function betterCandidate(modeId,a,b){
  if(!b)return true;
  if(modeId==='budget'){
    if(Math.abs(a.monthlyUtilization-b.monthlyUtilization)>EPS)return a.monthlyUtilization<b.monthlyUtilization;
    if(Math.abs(a.totalPlanAdjustedCost-b.totalPlanAdjustedCost)>EPS)return a.totalPlanAdjustedCost<b.totalPlanAdjustedCost;
    if(Math.abs(a.totalCreditBurn-b.totalCreditBurn)>EPS)return a.totalCreditBurn<b.totalCreditBurn;
    if(Math.abs(a.totalQuality-b.totalQuality)>EPS)return a.totalQuality>b.totalQuality;
  }else{
    if(Math.abs(a.totalQuality-b.totalQuality)>EPS)return a.totalQuality>b.totalQuality;
  }
  return a.signature<b.signature;
}

function budgetDominates(a,b){
  const A=a.partial,B=b.partial;
  const stdNoWorse=A.standardBurn<=B.standardBurn+EPS;
  const premNoWorse=A.premiumBurn<=B.premiumBurn+EPS;
  if(!(stdNoWorse&&premNoWorse))return false;
  const sameStd=Math.abs(A.standardBurn-B.standardBurn)<=EPS;
  const samePrem=Math.abs(A.premiumBurn-B.premiumBurn)<=EPS;
  if(!sameStd||!samePrem)return true;
  if(Math.abs(A.totalQuality-B.totalQuality)>EPS)return A.totalQuality>B.totalQuality;
  return A.signature<=B.signature;
}
function insertBudgetState(list,state){
  for(const existing of list)if(budgetDominates(existing,state))return list;
  return [...list.filter(existing=>!budgetDominates(state,existing)),state];
}

function optimize(modeId,pool){
  const minFamilies=Number(policy.minFamilies??1);
  const maxFamilies=Number(policy.maxFamilies??roles.length);
  const maxSeats=Number(policy.maxSeatsPerFamily??roles.length);
  const families=[...new Set(pool.map(familyOf).filter(Boolean))].sort();
  const familyIndex=new Map(families.map((f,i)=>[f,i]));
  const roleCandidates={};
  for(const role of roles){
    roleCandidates[role]=pool.filter(m=>Number.isFinite(roleQuality(m,role)));
    if(!roleCandidates[role].length)fail(`${modeId}/${role}: no eligible candidates`);
  }

  const implementers=roleCandidates['implementer'];
  const heavies=roleCandidates['implementer-heavy'];
  const reviewers=roleCandidates['code-reviewer'];
  const standardRoles=roles.filter(r=>!['implementer','implementer-heavy','code-reviewer'].includes(r));
  const heavyDelta=Number(policy.codingConstraints?.heavyMinimumIntelligenceDelta??0);
  let best=null;

  function buildCandidate(assign){
    const selected=roles.map(r=>assign.get(r));
    const famCount=familyCount(selected);
    if(famCount<minFamilies||famCount>maxFamilies)return null;
    return {...summarizeAssign(assign),assign,familyCount:famCount,signature:signature(assign)};
  }

  function buildCandidatePartial(assign){return summarizeAssign(assign)}

  function fillStandard(initialCounts,initialAssign){
    if(modeId==='budget'){
      let states=new Map([[initialCounts.join(','),[{counts:initialCounts,assign:initialAssign,partial:buildCandidatePartial(initialAssign)}]]]);
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
              const key=counts.join(',');
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

    let states=new Map([[initialCounts.join(','),{counts:initialCounts,assign:initialAssign,partial:buildCandidatePartial(initialAssign)}]]);
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
          const key=counts.join(',');
          const candidate=buildCandidatePartial(assign);
          const prev=next.get(key);
          if(!prev || candidate.totalQuality>prev.partial.totalQuality+EPS || (Math.abs(candidate.totalQuality-prev.partial.totalQuality)<=EPS && candidate.signature<prev.partial.signature)){
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
      if(policy.codingConstraints?.heavyDifferentFromImplementer!==false && benchmarkIdentity(heavy)===benchmarkIdentity(impl))continue;
      if(intelligence(heavy)+EPS<intelligence(impl)+heavyDelta)continue;
      for(const reviewer of reviewers){
        if(policy.codingConstraints?.reviewerDifferentFromImplementer!==false && benchmarkIdentity(reviewer)===benchmarkIdentity(impl))continue;
        if(policy.codingConstraints?.reviewerDifferentFromHeavy!==false && benchmarkIdentity(reviewer)===benchmarkIdentity(heavy))continue;
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
  if(!best)fail(`${modeId}: no feasible portfolio`);
  return best;
}

const out={
  schemaVersion:policy.schemaVersion,
  snapshotDate:latest.date,
  generatedAt:latest.generatedAt,
  policy:{
    latestGenerationOnly:policy.latestGenerationOnly===true,
    poolPrecheck:policy.poolPrecheck,
    minFamilies:policy.minFamilies,
    maxFamilies:policy.maxFamilies,
    maxSeatsPerFamily:policy.maxSeatsPerFamily,
    allowRepeatedModel:policy.allowRepeatedModel===true,
    allowRepeatedBenchmarkIdentity:policy.allowRepeatedBenchmarkIdentity===true,
    codingConstraints:policy.codingConstraints,
    planEconomics:policy.planEconomics
  },
  modes:{}
};

for(const [modeId,mode] of Object.entries(policy.modes)){
  const poolInfo=applyModeFilter(modeId,mode,makePool(modeId,mode));
  const result=optimize(modeId,poolInfo.pool);
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
      source:role==='security-reviewer'?'cyberbench':'scored',
      benchmarkProvenance:role==='security-reviewer'?(m.benchmarkProvenance?.cyberbench??null):null,
      free:m.free===true,
      discountPercent:m.discountPercent??null,
      mappingStatus:m.mapping?.status??null
    };
  }
  const capacity10=result.monthlyUtilization<=EPS?null:round(1/result.monthlyUtilization,3);
  const capacity20=result.monthlyUtilization<=EPS?null:round(economics.max20Scale/result.monthlyUtilization,3);
  out.modes[modeId]={
    label:mode.label??modeId,
    description:mode.description,
    objective:mode.objective,
    requestedIntelligenceFloor:poolInfo.requested,
    effectiveIntelligenceFloor:poolInfo.effective,
    bestEligibleIntelligenceIndex:round(bestIntelligence,4),
    intelligenceThreshold:poolInfo.threshold,
    candidateModels:poolInfo.pool.length,
    candidateFamilies:familyCount(poolInfo.pool),
    priceFilter:poolInfo.priceFilter,
    familyCount:result.familyCount,
    totalRoleQuality:round(result.totalQuality,3),
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
const target=path.join(root,'site','data','lineups.json');
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
