import {percentileScore,applyBalancedScores} from './lib/balanced-score.mjs';
function close(a,b,label){if(!Number.isFinite(a)||Math.abs(a-b)>1e-9)throw new Error(`${label}: expected ${b}, got ${a}`)}
close(percentileScore([10,20,30],30),100,'best quality');
close(percentileScore([1,2,3],1,{higherIsBetter:false}),100,'best affordability');
const models=[
 {name:'cheap-mid',taskEfficiency:{planAdjustedCostPerTaskUsd:1},roleScores:{r:{rankingQuality:50}}},
 {name:'premium-best',taskEfficiency:{planAdjustedCostPerTaskUsd:3},roleScores:{r:{rankingQuality:70}}},
 {name:'middle',taskEfficiency:{planAdjustedCostPerTaskUsd:2},roleScores:{r:{rankingQuality:60}}},
];
applyBalancedScores(models,['r'],{qualityWeight:.75,costWeight:.25});
const by=Object.fromEntries(models.map(m=>[m.name,m.roleScores.r]));
close(by['premium-best'].balancedQualityPercentile,100,'premium quality percentile');
close(by['premium-best'].balancedAffordabilityPercentile,0,'premium affordability percentile');
close(by['premium-best'].rankingValue,75,'premium balanced');
close(by['cheap-mid'].rankingValue,25,'cheap-mid balanced');
if(!(by['premium-best'].rankingValue>by['cheap-mid'].rankingValue))throw new Error('quality leadership should survive a higher nominal price when cohort-relative trade-off warrants it');
console.log('ok: Balanced uses cohort-relative quality/affordability percentiles');
