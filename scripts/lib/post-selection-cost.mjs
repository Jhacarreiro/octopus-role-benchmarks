import {portfolioIntelligence,portfolioRoleQuality,approximationSeats,independentEvidence,reviewerQualityPasses} from './role-approximations.mjs';

const EPS=1e-9;
const round=n=>Math.round(n*1e6)/1e6;
export function scorePriceExchange(initialQuality,quality,initialCost,cost,savingPercentPerPoint){
  if(![initialQuality,quality,initialCost,cost,savingPercentPerPoint].every(Number.isFinite)||initialCost<0||cost<0||savingPercentPerPoint<=0)throw new Error('Invalid score/price exchange inputs');
  const pointLoss=Math.max(0,initialQuality-quality);
  const savingPercent=initialCost>0?100*(1-cost/initialCost):cost===0?0:-Infinity;
  const requiredSavingPercent=pointLoss*savingPercentPerPoint;
  return {allowed:savingPercent+EPS>=requiredSavingPercent,pointLoss,savingPercent,requiredSavingPercent};
}
export function optimizePostSelectionCost({roles,initial,pool,policy,modeId,intelligenceThreshold,generationEligibleForRole,costOf,familyOf,summarizeAssign,estimatedLimit}){
  const settings=policy.modes[modeId].postSelectionOptimization;
  if(!settings?.enabled)return {result:initial,report:null};
  const {savingPercentPerPoint,maxSearchNodes}=settings;
  if(settings.objective!=='minimize-plan-adjusted-cost'||settings.exchangeRule!=='price-saving-percent-per-quality-point'||settings.measuredReplacementsOnly!==true||settings.maxIntelligenceExceptions!==null||settings.maxSwaps!==null||!Number.isFinite(savingPercentPerPoint)||savingPercentPerPoint<=0||!Number.isInteger(maxSearchNodes)||maxSearchNodes<1)throw new Error('Invalid post-selection cost optimization policy');
  const minFamilies=policy.modes[modeId].minFamilies??policy.minFamilies,maxFamilies=policy.maxFamilies,maxSeats=policy.maxSeatsPerFamily;
  const constraints=policy.codingConstraints;
  const reference=new Map(roles.map(role=>[role,{model:initial.assign.get(role),quality:portfolioRoleQuality(initial.assign.get(role),role),cost:costOf(initial.assign.get(role))}]));
  const candidates=Object.fromEntries(roles.map(role=>{
    const baseline=reference.get(role);
    const rows=pool.filter(m=>m===baseline.model||(m.roleScores[role]?.status==='valid'&&m.benchmarkProvenance?.intelligenceIndex?.status==='observed'&&m.aaModel?.intelligenceIndexVersion==='5.0'&&Number.isFinite(m.aaModel.intelligenceIndex)&&generationEligibleForRole(m,role)));
    if(!rows.includes(baseline.model))rows.push(baseline.model);
    return [role,rows.map(m=>({model:m,cost:costOf(m),quality:portfolioRoleQuality(m,role),loss:Math.max(0,baseline.quality-portfolioRoleQuality(m,role)),changed:m.name!==baseline.model.name})).filter(r=>Number.isFinite(r.cost)&&r.cost>=0&&Number.isFinite(r.quality)&&scorePriceExchange(baseline.quality,r.quality,baseline.cost,r.cost,savingPercentPerPoint).allowed).sort((a,b)=>a.cost-b.cost||a.loss-b.loss||a.model.name.localeCompare(b.model.name,'en'))];
  }));
  const coding=['implementer','implementer-heavy','code-reviewer'];
  const order=[...coding,...roles.filter(r=>!coding.includes(r)).sort((a,b)=>candidates[a].length-candidates[b].length||a.localeCompare(b,'en'))];
  const tail=Array(order.length+1).fill(0);
  for(let i=order.length-1;i>=0;i--)tail[i]=tail[i+1]+Math.min(...candidates[order[i]].map(r=>r.cost));
  const assign=new Map(),counts=new Map();let best=null,nodes=0,completed=true;
  function codingValid(){
    const impl=assign.get('implementer'),heavy=assign.get('implementer-heavy'),reviewer=assign.get('code-reviewer');
    if(impl&&heavy){
      if(constraints.heavyDifferentFromImplementer!==false&&!independentEvidence(heavy,impl,'implementer-heavy','implementer'))return false;
      const upper=impl.approximation?impl.roleScores.implementer.scoreRange.upper:portfolioRoleQuality(impl,'implementer');
      if(!(portfolioRoleQuality(heavy,'implementer')+EPS>=upper+constraints.heavyMinimumImplementerQualityDelta))return false;
    }
    if(reviewer&&!reviewerQualityPasses(reviewer,[impl,heavy],constraints.reviewerMinimumReviewerQualityDelta))return false;
    for(const [other,role,flag]of [[impl,'implementer','reviewerDifferentFromImplementer'],[heavy,'implementer-heavy','reviewerDifferentFromHeavy']])if(reviewer&&other){
      if(!independentEvidence(reviewer,other,'code-reviewer',role))return false;
      if(constraints[flag]!==false&&familyOf(reviewer)===familyOf(other))return false;
    }
    return true;
  }
  function better(candidate){
    if(!best)return true;
    for(const [a,b]of [[candidate.totalPlanAdjustedCost,best.totalPlanAdjustedCost],[candidate.loss,best.loss],[candidate.changes,best.changes],[-candidate.totalQuality,-best.totalQuality],[candidate.placementInversionCost,best.placementInversionCost]])if(Math.abs(a-b)>EPS)return a<b;
    return candidate.signature<best.signature;
  }
  function search(index,cost,loss,changes){
    if(++nodes>maxSearchNodes){completed=false;return;}
    if(best&&cost+tail[index]>best.totalPlanAdjustedCost+EPS||counts.size+order.length-index<minFamilies)return;
    if(index===order.length){
      if(counts.size<minFamilies||counts.size>maxFamilies)return;
      const candidate={...summarizeAssign(assign),assign:new Map(assign),familyCount:counts.size,loss,changes};
      if(better(candidate))best=candidate;
      return;
    }
    const role=order[index];
    for(const r of candidates[role]){
      const family=familyOf(r.model);if((counts.get(family)??0)>=maxSeats)continue;
      assign.set(role,r.model);counts.set(family,(counts.get(family)??0)+1);
      if(counts.size<=maxFamilies&&approximationSeats(assign)<=estimatedLimit&&codingValid())search(index+1,cost+r.cost,loss+r.loss,changes+Number(r.changed));
      counts.set(family,counts.get(family)-1);if(!counts.get(family))counts.delete(family);assign.delete(role);
      if(!completed)return;
    }
  }
  search(0,0,0,0);
  const saving=best&&initial.totalPlanAdjustedCost>0?100*(1-best.totalPlanAdjustedCost/initial.totalPlanAdjustedCost):0;
  const applied=completed&&best&&best.totalPlanAdjustedCost+EPS<initial.totalPlanAdjustedCost;
  const chosen=applied?{...best,...(Number.isFinite(initial.pureBalancedOptimum)?{pureBalancedOptimum:initial.pureBalancedOptimum,balancedObjectiveLossPercent:100*(initial.pureBalancedOptimum-best.totalBalanced)/initial.pureBalancedOptimum}:{})}:initial;
  const changes=roles.flatMap(role=>{
    const previous=reference.get(role),m=chosen.assign.get(role);
    const exchange=scorePriceExchange(previous.quality,portfolioRoleQuality(m,role),previous.cost,costOf(m),savingPercentPerPoint);
    return m.name===previous.model.name?[]:[{role,from:previous.model.name,to:m.name,initialQuality:round(previous.quality),quality:round(portfolioRoleQuality(m,role)),pointLoss:round(exchange.pointLoss),initialCostUsd:round(previous.cost),costUsd:round(costOf(m)),savingPercent:round(exchange.savingPercent),requiredSavingPercent:round(exchange.requiredSavingPercent),observedIntelligence:portfolioIntelligence(m)}];
  });
  const exceptions=roles.flatMap(role=>{const m=chosen.assign.get(role);return portfolioIntelligence(m)+EPS<intelligenceThreshold?[{role,model:m.name,observedIntelligence:portfolioIntelligence(m),initialThreshold:intelligenceThreshold}]:[];});
  return {result:chosen,report:{enabled:true,status:!completed?'search-limit':applied?'applied':'no-qualifying-savings',reference:'fixed-initial-portfolio-per-snapshot',exchangeRule:settings.exchangeRule,savingPercentPerPoint,maxSwaps:null,measuredReplacementsOnly:true,maxIntelligenceExceptions:null,searchCompleted:completed,visitedNodes:nodes,initialCostUsd:round(initial.totalPlanAdjustedCost),optimizedCostUsd:round(chosen.totalPlanAdjustedCost),savingPercent:round(applied?saving:0),positivePointLoss:round(applied?best.loss:0),meanPositivePointLoss:round(applied?best.loss/roles.length:0),...(Number.isFinite(initial.balancedObjectiveLossPercent)?{initialBalancedObjectiveLossPercent:round(initial.balancedObjectiveLossPercent)}:{}),intelligenceExceptions:exceptions,changes,initialSelections:Object.fromEntries([...reference].map(([role,r])=>[role,{model:r.model.name,quality:round(r.quality),costUsd:round(r.cost)}]))}};
}
