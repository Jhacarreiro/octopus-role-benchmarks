export function balancedScore(rankingQuality,planAdjustedCostPerTaskUsd,penaltyPerUsd){
  if(rankingQuality==null||planAdjustedCostPerTaskUsd==null||penaltyPerUsd==null)return null;
  const q=Number(rankingQuality),cost=Number(planAdjustedCostPerTaskUsd),lambda=Number(penaltyPerUsd);
  if(!Number.isFinite(q)||!Number.isFinite(cost)||cost<0||!Number.isFinite(lambda)||lambda<0)return null;
  return q-lambda*cost;
}
