import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync(new URL('../site/data/lineups.json',import.meta.url),'utf8'));
for(const [mode,p] of Object.entries(d.modes||{})){
  if(!Number.isFinite(p.placementInversionCost)||p.placementInversionCost<0)throw new Error(`${mode}: invalid placement inversion cost`);
  if(!Number.isInteger(p.placementInversionCount)||p.placementInversionCount<0)throw new Error(`${mode}: invalid placement inversion count`);
}
const b=d.modes?.balanced;
if(!b||!Number.isFinite(b.pureBalancedOptimum)||!Number.isFinite(b.balancedObjectiveLossPercent))throw new Error('balanced placement metadata missing');
if(b.balancedObjectiveLossPercent>1+1e-6)throw new Error(`balanced placement exceeds 1% objective tolerance: ${b.balancedObjectiveLossPercent}`);
console.log('ok: premium placement metadata and Balanced tolerance');
