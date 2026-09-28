export const GPQA_FEATURES=['hle','lcr','scicode','omniscienceIndex'];
export const GPQA_K=3;
export const GPQA_VALIDATION_LIMITS={minObserved:20,maxMae:2.5,maxError:8};

function mean(v){return v.reduce((a,b)=>a+b,0)/v.length}
function std(v,m){const s=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);return s<1e-9?1:s}
function stats(rows){return GPQA_FEATURES.map(f=>{const v=rows.map(r=>r[f]);const m=mean(v);return {feature:f,mean:m,std:std(v,m)}})}
function vector(row,s){return s.map(x=>(row[x.feature]-x.mean)/x.std)}
export function fitGpqaEstimator(rows){
  if(rows.length<GPQA_VALIDATION_LIMITS.minObserved)throw new Error(`Need at least ${GPQA_VALIDATION_LIMITS.minObserved} observed GPQA families, got ${rows.length}`);
  return {rows:rows.map(r=>({...r})),stats:stats(rows),observedCount:rows.length};
}
export function predictGpqa(model,row){
  const t=vector(row,model.stats);
  const n=model.rows.map(r=>{const x=vector(r,model.stats);return {value:r.gpqa,distance:Math.sqrt(x.reduce((a,v,i)=>a+(v-t[i])**2,0))}}).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(GPQA_K,model.rows.length));
  if(n[0]?.distance<1e-12)return n[0].value;
  let num=0,den=0;for(const x of n){const w=1/Math.max(x.distance,1e-6)**2;num+=x.value*w;den+=w}return Math.max(0,Math.min(100,num/den));
}
export function validateGpqaEstimator(rows){
  const errors=[];
  for(let i=0;i<rows.length;i++){
    const target=rows[i];const model=fitGpqaEstimator(rows.filter((_,j)=>j!==i));const pred=predictGpqa(model,target);errors.push({slug:target.slug,actual:target.gpqa,predicted:pred,error:Math.abs(pred-target.gpqa)});
  }
  const mae=mean(errors.map(x=>x.error));const maxError=Math.max(...errors.map(x=>x.error));
  return {method:'knn',k:GPQA_K,features:GPQA_FEATURES,observedCount:rows.length,mae,maxError,valid:rows.length>=GPQA_VALIDATION_LIMITS.minObserved&&mae<=GPQA_VALIDATION_LIMITS.maxMae&&maxError<=GPQA_VALIDATION_LIMITS.maxError,limits:GPQA_VALIDATION_LIMITS};
}
