import assert from "node:assert/strict";
import { parseMax, parsePricingDeals, parseDealDiscounts, applyDealMetadata } from "../opencli/clis/commandcode/max.js";
import { planEconomics, planAdjustedTaskCost, monthlyUtilization, effectiveUsage } from "./lib/plan-economics.mjs";

const html=`<!doctype html><table><thead><tr>
<th>Model</th><th>Context</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Cache Write</th><th>Max 10× Credits</th><th>Max 20× Credits</th>
</tr></thead><tbody>
<tr><td>Standard Deal -50%</td><td>128K</td><td>$10 $5</td><td>$20 $10</td><td>$2 $1</td><td>$10 $5</td><td>$150</td><td>$300</td></tr>
<tr><td>Premium Model</td><td>200K</td><td>$5</td><td>$25</td><td>$0.50</td><td>$5</td><td>$100</td><td>$200</td></tr>
<tr><td>Free Model FREE</td><td>64K</td><td>Free</td><td>Free</td><td>Free</td><td>Free</td><td>Free</td><td>Free</td></tr>
</tbody></table>`;

const rows=parseMax(html);
assert.equal(rows.length,3);
const standard=rows[0];
assert.equal(standard.name,"Standard Deal");
assert.equal(standard.discountPercent,50);
assert.equal(standard.inputListPerM,10);
assert.equal(standard.inputPerM,5);
assert.equal(standard.outputListPerM,20);
assert.equal(standard.outputPerM,10);
assert.equal(standard.billingCategory,"standard");
assert.equal(standard.max10MonthlyUsageLimitUsd,150);
assert.equal(standard.max20MonthlyUsageLimitUsd,300);

const premium=rows[1];
assert.equal(premium.billingCategory,"premium");
assert.equal(premium.max10MonthlyUsageLimitUsd,100);
assert.equal(premium.max20MonthlyUsageLimitUsd,200);

const free=rows[2];
assert.equal(free.name,"Free Model");
assert.equal(free.free,true);
assert.equal(free.inputPerM,0);
assert.equal(free.outputPerM,0);
assert.equal(free.billingCategory,"free");
assert.equal(free.max10MonthlyUsageLimitUsd,0);
assert.equal(free.max20MonthlyUsageLimitUsd,0);


const economics=planEconomics({
  planEconomics:{
    monthlyPriceUsd:100,
    standardMonthlyUsageLimitUsd:150,
    premiumMonthlyUsageLimitUsd:100,
    max20Scale:2
  }
});
assert.equal(planAdjustedTaskCost(3,standard,economics),2);
assert.equal(planAdjustedTaskCost(3,premium,economics),3);
assert.equal(planAdjustedTaskCost(3,free,economics),0);
assert.equal(monthlyUtilization(75,25,economics),0.5);
assert.throws(
  ()=>planAdjustedTaskCost(1,{...standard,max10MonthlyUsageLimitUsd:140},economics),
  /allowance drift/
);

const pricingHtml=`<div><div><span><a href="/docs/resources/pricing-limits#minimax-m3-2x-usage">MiniMax M3 effective usage</a></span><span>Credits go up to 2× further</span></div><div><span><a href="/docs/resources/pricing-limits#mimo-v2.5-pro-99-off">MiMo V2.5 effective usage</a></span><span>Credits go up to 5× further</span></div></div>`;
const limitsHtml=`<div><a href="#minimax-m3-2x-usage" aria-label="View MiniMax M3 deal details">-50%</a><a href="#mimo-v2.5-pro-99-off" aria-label="View MiMo V2.5 deal details">-98%</a><a href="#mimo-v2.5-pro-99-off" aria-label="View MiMo V2.5 Pro deal details">-99%</a></div>`;
const augmented=applyDealMetadata(rows,parsePricingDeals(pricingHtml),parseDealDiscounts(limitsHtml));
const groupedPro=applyDealMetadata([{...rows[0],name:'MiMo V2.5 Pro'}],parsePricingDeals(pricingHtml),parseDealDiscounts(limitsHtml))[0];
assert.equal(groupedPro.dealMultiplier,5);
assert.equal(groupedPro.dealDiscountPercent,99);
assert.equal(groupedPro.max10EffectiveUsageUsd,750);
const dealStd={...augmented[0],name:'MiniMax M3',dealMultiplier:2,max10MonthlyUsageLimitUsd:150,max20MonthlyUsageLimitUsd:300,max10EffectiveUsageUsd:300,max20EffectiveUsageUsd:600};
assert.equal(effectiveUsage(dealStd).max10EffectiveUsageUsd,300);
assert.equal(planAdjustedTaskCost(3,dealStd,economics),2); // deal already lives in effective token price; no double count
const mimo={...dealStd,name:'MiMo V2.5',dealMultiplier:5,max10EffectiveUsageUsd:750,max20EffectiveUsageUsd:1500};
assert.equal(effectiveUsage(mimo).max10EffectiveUsageUsd,750);
assert.equal(planAdjustedTaskCost(3,mimo,economics),2);

console.log("ok: CommandCode Max parser handles discounts, deal multipliers, effective usage, plan adjustment, and FREE rows");
