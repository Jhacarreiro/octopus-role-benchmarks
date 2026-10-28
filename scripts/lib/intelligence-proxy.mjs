// Calibrated Intelligence Index proxy; never represents an official AA observation.
function solve(a,b){
  const n=b.length,m=a.map((row,i)=>[...row,b[i]]);
  for(let c=0;c<n;c++){
    let pivot=c;for(let i=c+1;i<n;i++)if(Math.abs(m[i][c])>Math.abs(m[pivot][c]))pivot=i;
    if(Math.abs(m[pivot][c])<1e-9)return null;
    [m[c],m[pivot]]=[m[pivot],m[c]];
    const divisor=m[c][c];for(let j=c;j<=n;j++)m[c][j]/=divisor;
    for(let i=0;i<n;i++)if(i!==c){const factor=m[i][c];for(let j=c;j<=n;j++)m[i][j]-=factor*m[c][j]}
  }
  return m.map(row=>row[n]);
}
function fit(rows){
  const p=4,xx=Array.from({length:p},()=>Array(p).fill(0)),xy=Array(p).fill(0);
  for(const row of rows){const x=[1,...row.features];for(let i=0;i<p;i++){
    xy[i]+=x[i]*row.intelligence;for(let j=0;j<p;j++)xx[i][j]+=x[i]*x[j];
  }}
  return solve(xx,xy);
}
function predict(beta,features){return beta[0]+features.reduce((s,x,i)=>s+x*beta[i+1],0)}
export function calibrateIntelligenceProxy(rows){
  const seen=new Set();const unique=rows.filter(r=>{
    if(!r.slug||seen.has(r.slug)||!Number.isFinite(r.intelligence)||r.features?.length!==3||r.features.some(x=>!Number.isFinite(x)))return false;
    seen.add(r.slug);return true;
  });
  if(unique.length<20)return{usable:false,reason:'fewer than 20 observed families',count:unique.length};
  const errors=[];
  for(let i=0;i<unique.length;i++){
    const beta=fit(unique.filter((_,j)=>i!==j));if(!beta)return{usable:false,reason:'singular calibration'};
    errors.push(Math.abs(predict(beta,unique[i].features)-unique[i].intelligence));
  }
  const sorted=[...errors].sort((a,b)=>a-b);
  const mae=errors.reduce((a,b)=>a+b,0)/errors.length;
  const p90=sorted[Math.ceil(0.9*sorted.length)-1];
  const beta=fit(unique);
  return{usable:!!beta&&mae<=6&&p90<=10,reason:mae<=6&&p90<=10?null:'held-out error exceeds acceptance limits',count:unique.length,mae,p90,beta};
}
export function estimateIntelligence(proxy,features){
  if(!proxy.usable||features?.length!==3||features.some(x=>!Number.isFinite(x)))return null;
  const prediction=predict(proxy.beta,features);
  // Conservatively use the 90th-percentile held-out absolute error for cutoff.
  return{estimate:Math.max(0,prediction),cutoffLowerBound:Math.max(0,prediction-proxy.p90),uncertainty:proxy.p90};
}
