import {calibrateScicodeLkg,applyScicodeLkg,SCICODE_LKG_LIMITS} from './lib/scicode-lkg.mjs';

const stable=Array.from({length:24},(_,i)=>({slug:'m'+i,previous:40+i,current:(40+i)*0.99}));
const c=calibrateScicodeLkg(stable);
if(!c.valid)throw new Error('stable calibration invalid: '+c.failures.join('; '));
if(Math.abs(c.factor-0.99)>1e-12)throw new Error('expected factor 0.99, got '+c.factor);
if(Math.abs(applyScicodeLkg({value:50},c)-49.5)>1e-12)throw new Error('calibrated LKG application failed');

const improving=Array.from({length:24},(_,i)=>({slug:'u'+i,previous:40+i,current:(40+i)*1.02}));
const capped=calibrateScicodeLkg(improving);
if(!capped.valid)throw new Error('capped calibration invalid: '+capped.failures.join('; '));
if(capped.factor!==1)throw new Error('improving overlap must cap factor at 1, got '+capped.factor);

const tooSmall=calibrateScicodeLkg(stable.slice(0,SCICODE_LKG_LIMITS.minOverlap-1));
if(tooSmall.valid)throw new Error('insufficient overlap must fail closed');

console.log(JSON.stringify({ok:true,factor:c.factor,cappedFactor:capped.factor,minOverlap:SCICODE_LKG_LIMITS.minOverlap}));
