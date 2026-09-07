export function planEconomics(policy){
  const p=policy?.planEconomics||{};
  const monthlyPriceUsd=Number(p.monthlyPriceUsd);
  const standardMonthlyUsageLimitUsd=Number(p.standardMonthlyUsageLimitUsd);
  const premiumMonthlyUsageLimitUsd=Number(p.premiumMonthlyUsageLimitUsd);
  const max20Scale=Number(p.max20Scale);
  if(!Number.isFinite(monthlyPriceUsd)||monthlyPriceUsd<=0)throw new Error('invalid planEconomics.monthlyPriceUsd');
  if(!Number.isFinite(standardMonthlyUsageLimitUsd)||standardMonthlyUsageLimitUsd<=0)throw new Error('invalid planEconomics.standardMonthlyUsageLimitUsd');
  if(!Number.isFinite(premiumMonthlyUsageLimitUsd)||premiumMonthlyUsageLimitUsd<=0)throw new Error('invalid planEconomics.premiumMonthlyUsageLimitUsd');
  if(!Number.isFinite(max20Scale)||max20Scale<=0)throw new Error('invalid planEconomics.max20Scale');
  return {monthlyPriceUsd,standardMonthlyUsageLimitUsd,premiumMonthlyUsageLimitUsd,max20Scale};
}

function close(a,b){return Math.abs(Number(a)-Number(b))<=1e-9}

export function billingCategory(row,economics){
  const c=row?.billingCategory;
  if(!['standard','premium','free'].includes(c))throw new Error(`${row?.name||row?.rawName||'model'}: missing/unknown CommandCode billingCategory`);
  const expected10=c==='standard'?economics.standardMonthlyUsageLimitUsd:c==='premium'?economics.premiumMonthlyUsageLimitUsd:0;
  const expected20=expected10*economics.max20Scale;
  if(!close(row?.max10MonthlyUsageLimitUsd,expected10)||!close(row?.max20MonthlyUsageLimitUsd,expected20)){
    throw new Error(`${row?.name||row?.rawName||'model'}: CommandCode Max allowance drift for ${c} billing (${row?.max10MonthlyUsageLimitUsd}/${row?.max20MonthlyUsageLimitUsd}, expected ${expected10}/${expected20})`);
  }
  return c;
}

export function planAdjustedTaskCost(creditBurn,row,economics){
  if(!Number.isFinite(creditBurn)||creditBurn<0)return null;
  const c=billingCategory(row,economics);
  if(c==='free')return 0;
  const allowance=c==='standard'?economics.standardMonthlyUsageLimitUsd:economics.premiumMonthlyUsageLimitUsd;
  return creditBurn*economics.monthlyPriceUsd/allowance;
}

export function monthlyUtilization(standardBurn,premiumBurn,economics){
  return Math.max(
    standardBurn/economics.standardMonthlyUsageLimitUsd,
    premiumBurn/economics.premiumMonthlyUsageLimitUsd
  );
}
