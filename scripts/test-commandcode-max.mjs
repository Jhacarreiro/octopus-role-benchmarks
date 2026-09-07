import assert from "node:assert/strict";
import { parseMax } from "../opencli/clis/commandcode/max.js";
import { planEconomics, planAdjustedTaskCost, monthlyUtilization } from "./lib/plan-economics.mjs";

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

console.log("ok: CommandCode Max parser handles discounts, plan allowances, plan adjustment, and FREE rows");
