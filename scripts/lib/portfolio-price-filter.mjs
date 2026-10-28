// Price tiers are removed before computing the statistical cutoff. Prices
// share the six-decimal USD precision used by the published task-cost data.
export function filterPortfolioPrices(models,referencePool,{highestPriceLevels=0,standardDeviations=2},costOf){
  if(!Number.isInteger(highestPriceLevels)||highestPriceLevels<0)throw new Error('Invalid number of excluded price levels');
  if(!Number.isFinite(standardDeviations)||standardDeviations<0)throw new Error('Invalid price filter standard deviations');
  const prices=new Map([...models,...referencePool].map(m=>{
    const cost=costOf(m);
    if(!Number.isFinite(cost)||cost<0)throw new Error('Price filter requires a non-negative finite task cost');
    return [m,Math.round(cost*1e6)/1e6];
  }));
  const cost=m=>prices.get(m);
  const levels=[...new Set(models.map(cost))].sort((a,b)=>b-a);
  const excludedPriceLevels=levels.slice(0,highestPriceLevels),banned=new Set(excludedPriceLevels);
  const rankedOut=models.filter(m=>banned.has(cost(m)));
  const reference=referencePool.filter(m=>!banned.has(cost(m)));
  if(!reference.length)throw new Error('Price exclusions leave no latest-generation reference models');
  const values=reference.map(cost),mean=values.reduce((sum,n)=>sum+n,0)/values.length;
  const sd=Math.sqrt(values.reduce((sum,n)=>sum+(n-mean)**2,0)/values.length);
  const cutoff=mean+standardDeviations*sd;
  const afterRank=models.filter(m=>!banned.has(cost(m)));
  const outliers=afterRank.filter(m=>cost(m)>cutoff+1e-12);
  return {models:afterRank.filter(m=>cost(m)<=cutoff+1e-12),latestSurvivors:reference.filter(m=>cost(m)<=cutoff+1e-12),referencePool:reference,rankedOut,outliers,excludedPriceLevels,referencePriceLevels:levels.length,mean,sd,cutoff};
}
