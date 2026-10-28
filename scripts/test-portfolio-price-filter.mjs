import assert from 'node:assert/strict';
import {filterPortfolioPrices} from './lib/portfolio-price-filter.mjs';

const offers=[{id:'A',cost:100},{id:'B',cost:100},{id:'C',cost:20},{id:'D',cost:20},...Array.from({length:12},(_,i)=>({id:'low-'+i,cost:2})),{id:'free',cost:0}];
const ids=rows=>rows.map(m=>m.id);
const run=n=>filterPortfolioPrices(offers,offers,{highestPriceLevels:n,standardDeviations:2},m=>m.cost);
const balanced=run(1),budget=run(2);
assert.deepEqual(ids(balanced.rankedOut),['A','B'],'All offers tied at the highest price are excluded');
assert.deepEqual(ids(budget.rankedOut),['A','B','C','D'],'Budget excludes both distinct highest prices, including both ties');
assert.deepEqual(ids(balanced.outliers),['C','D'],'Recomputing mean and deviation after the first exclusions must expose the remaining outlier');
assert.equal(balanced.mean,64/15,'The excluded 100-dollar offers must not inflate the statistical reference population');
assert.equal(budget.outliers.length,0);
assert.ok(balanced.models.some(m=>m.id==='free'),'Free offers remain eligible');
const ties=[{cost:7.00000001},{cost:7.00000002},{cost:1}];
assert.equal(filterPortfolioPrices(ties,ties,{highestPriceLevels:1},m=>m.cost).rankedOut.length,2,'Binary floating-point noise cannot break a published-price tie');
assert.throws(()=>filterPortfolioPrices([{cost:1}],[{cost:1}],{highestPriceLevels:1},m=>m.cost),/no latest-generation/,'An infeasible exclusion fails closed');
assert.throws(()=>filterPortfolioPrices(offers,offers,{highestPriceLevels:1.5},m=>m.cost),/Invalid number/);
console.log('ok: distinct price tiers, all ties, statistical filtering after exclusions, zero cost and fail-closed behavior');
