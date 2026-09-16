export const SCICODE_LKG_LIMITS={minOverlap:20,maeMax:3,maxErrorMax:8,maxAgeDays:14};

function median(values){
  const a=[...values].sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

export function calibrateScicodeLkg(pairs,limits=SCICODE_LKG_LIMITS){
  const usable=(pairs||[]).filter(x=>Number.isFinite(x?.previous)&&x.previous>0&&Number.isFinite(x?.current));
  const rawMedianRatio=median(usable.map(x=>x.current/x.previous));
  const factor=rawMedianRatio==null?null:Math.min(1,rawMedianRatio);
  const errors=factor==null?[]:usable.map(x=>({...x,predicted:x.previous*factor,error:Math.abs(x.previous*factor-x.current)}));
  const mae=errors.length?errors.reduce((s,x)=>s+x.error,0)/errors.length:null;
  const maxError=errors.length?Math.max(...errors.map(x=>x.error)):null;
  const failures=[];
  if(usable.length<limits.minOverlap)failures.push(`overlap ${usable.length} < ${limits.minOverlap}`);
  if(!Number.isFinite(factor)||factor<=0)failures.push(`invalid factor ${factor}`);
  if(!Number.isFinite(mae)||mae>limits.maeMax)failures.push(`MAE ${mae} > ${limits.maeMax}`);
  if(!Number.isFinite(maxError)||maxError>limits.maxErrorMax)failures.push(`max error ${maxError} > ${limits.maxErrorMax}`);
  return {valid:failures.length===0,method:"median_overlap_ratio_capped_at_1",rawMedianRatio,factor,overlap:usable.length,mae,maxError,errors,failures,limits};
}

export function applyScicodeLkg(anchor,calibration){
  if(!Number.isFinite(anchor?.value)||!calibration?.valid||!Number.isFinite(calibration.factor))return null;
  return anchor.value*calibration.factor;
}
