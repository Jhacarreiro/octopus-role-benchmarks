import {fitGpqaEstimator,predictGpqa,validateGpqaEstimator} from './gpqa-estimator.mjs';
const rows=Array.from({length:24},(_,i)=>({slug:`m${i}`,hle:8+i*.8,lcr:30+(i%7)*5,scicode:25+i*.9,omniscienceIndex:45+(i%9)*2,gpqa:68+i*.55+(i%3)*.4}));
const v=validateGpqaEstimator(rows);if(!Number.isFinite(v.mae)||!Number.isFinite(v.maxError))throw new Error('invalid validation');
const e=predictGpqa(fitGpqaEstimator(rows),{hle:22,lcr:55,scicode:44,omniscienceIndex:57});if(!Number.isFinite(e)||e<0||e>100)throw new Error('invalid estimate');
console.log(JSON.stringify({ok:true,validation:v,estimate:e}));
