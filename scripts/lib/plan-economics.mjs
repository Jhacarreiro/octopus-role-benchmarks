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

export function effectiveUsage(row){
  const multiplier=Number(row?.dealMultiplier??1);
  if(!Number.isFinite(multiplier)||multiplier<=0)throw new Error(`${row?.name||row?.rawName||'model'}: invalid CommandCode deal multiplier`);
  const max10=Number(row?.max10MonthlyUsageLimitUsd);
  const max20=Number(row?.max20MonthlyUsageLimitUsd);
  return {dealMultiplier:multiplier,max10EffectiveUsageUsd:max10*multiplier,max20EffectiveUsageUsd:max20*multiplier};
}

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
  const baseCredits=Number(row.max10MonthlyUsageLimitUsd);
  const usage=effectiveUsage(row);
  if(row.max10EffectiveUsageUsd!=null&&!close(row.max10EffectiveUsageUsd,usage.max10EffectiveUsageUsd))throw new Error(`${row?.name||row?.rawName||'model'}: inconsistent Max 10 effective usage`);
  if(row.max20EffectiveUsageUsd!=null&&!close(row.max20EffectiveUsageUsd,usage.max20EffectiveUsageUsd))throw new Error(`${row?.name||row?.rawName||'model'}: inconsistent Max 20 effective usage`);
  // creditBurn is already priced at CommandCode's effective deal rate. Dividing by base plan credits
  // therefore captures the deal exactly once. Multiplying the allowance by dealMultiplier here would double-count it.
  return creditBurn*economics.monthlyPriceUsd/baseCredits;
}

export function monthlyUtilization(standardBurn,premiumBurn,economics){
  return Math.max(
    standardBurn/economics.standardMonthlyUsageLimitUsd,
    premiumBurn/economics.premiumMonthlyUsageLimitUsd
  );
}
