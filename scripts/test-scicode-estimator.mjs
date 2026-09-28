import {fitScicodeEstimator,predictScicode,validateScicodeEstimator,SCICODE_VALIDATION_LIMITS} from './scicode-estimator.mjs';

// Curated fixture with enough local/non-linear variation to exercise both the
// ridge and neighbour components. Values are deterministic, not generated from
// the estimator under test.
const rows=Array.from({length:24},(_,i)=>({
  slug:`m${i}`,
  gpqa:58+i*1.25,
  hle:4+(i%8)*3.1,
  lcr:18+(i%6)*8.5,
  omniscienceIndex:42+(i%10)*2.2,
  scicode:24+i*0.85+(i%4)*1.4-(i%3)*0.7,
}));
const validation=validateScicodeEstimator(rows);
if(!Number.isFinite(validation.mae)||!Number.isFinite(validation.maxError)) throw new Error('validation did not produce finite errors');
const model=fitScicodeEstimator(rows);
const estimate=predictScicode(model,{slug:'target',gpqa:83,hle:22,lcr:62,omniscienceIndex:54});
if(!Number.isFinite(estimate)||estimate<0||estimate>100) throw new Error(`invalid estimate ${estimate}`);
console.log(JSON.stringify({ok:true,mae:validation.mae,maxError:validation.maxError,limits:SCICODE_VALIDATION_LIMITS,estimate}));
