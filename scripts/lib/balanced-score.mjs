export function percentileScore(values,value,{higherIsBetter=true}={}){
  if(!Number.isFinite(value))return null;
  const finite=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!finite.length)return null;
  if(finite.length===1)return 100;
  let less=0,equal=0;
  for(const v of finite){if(v<value)less++;else if(v===value)equal++;}
  const rank=(less+(Math.max(1,equal)-1)/2)/(finite.length-1);
  return 100*(higherIsBetter?rank:1-rank);
}

export function applyBalancedScores(models,roleIds,{qualityWeight=0.75,costWeight=0.25}={}){
  if(!Number.isFinite(qualityWeight)||!Number.isFinite(costWeight)||qualityWeight<0||costWeight<0||Math.abs(qualityWeight+costWeight-1)>1e-9)throw new Error('Balanced percentile weights must be finite, non-negative and sum to 1');
  for(const roleId of roleIds){
    const eligible=models.filter(m=>Number.isFinite(m.roleScores?.[roleId]?.rankingQuality)&&Number.isFinite(m.taskEfficiency?.planAdjustedCostPerTaskUsd));
    const qualities=eligible.map(m=>m.roleScores[roleId].rankingQuality);
    const costs=eligible.map(m=>m.taskEfficiency.planAdjustedCostPerTaskUsd);
    for(const m of eligible){
      const qualityPercentile=percentileScore(qualities,m.roleScores[roleId].rankingQuality,{higherIsBetter:true});
      const affordabilityPercentile=percentileScore(costs,m.taskEfficiency.planAdjustedCostPerTaskUsd,{higherIsBetter:false});
      m.roleScores[roleId].balancedQualityPercentile=qualityPercentile;
      m.roleScores[roleId].balancedAffordabilityPercentile=affordabilityPercentile;
      m.roleScores[roleId].rankingValue=qualityWeight*qualityPercentile+costWeight*affordabilityPercentile;
    }
  }
  return models;
}
