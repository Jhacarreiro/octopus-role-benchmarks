export const RIDGE_FEATURES = ['scicode','gpqa','hle','lcr','gdpval','omniscienceIndex','logOutputTokens'];
export const KNN_FEATURES = ['scicode','gpqa','hle','lcr'];
export const RIDGE_LAMBDA = 1;
export const KNN_K = 5;
export const CAI_BLEND = { ridge: 0.5, knn: 0.5 };
export const CODING_ROLE_CAI_WEIGHT = 1 / 3;

function mean(values){ return values.reduce((a,b)=>a+b,0)/values.length; }
function std(values, mu){
  const v=Math.sqrt(values.reduce((a,b)=>a+(b-mu)**2,0)/values.length);
  return v < 1e-9 ? 1 : v;
}
function featureStats(rows, features){
  return features.map(f=>{
    const values=rows.map(r=>r[f]);
    const mu=mean(values);
    return {feature:f, mean:mu, std:std(values,mu)};
  });
}
function vector(row, stats){ return stats.map(s=>(row[s.feature]-s.mean)/s.std); }

function solveLinear(A,b){
  const n=A.length;
  const M=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let r=col+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[pivot][col])) pivot=r;
    if(Math.abs(M[pivot][col])<1e-12) throw new Error(`Singular matrix at column ${col}`);
    if(pivot!==col) [M[col],M[pivot]]=[M[pivot],M[col]];
    const div=M[col][col];
    for(let c=col;c<=n;c++) M[col][c]/=div;
    for(let r=0;r<n;r++){
      if(r===col) continue;
      const factor=M[r][col];
      if(Math.abs(factor)<1e-15) continue;
      for(let c=col;c<=n;c++) M[r][c]-=factor*M[col][c];
    }
  }
  return M.map(row=>row[n]);
}

function fitRidge(rows){
  const stats=featureStats(rows,RIDGE_FEATURES);
  const X=rows.map(r=>[1,...vector(r,stats)]);
  const y=rows.map(r=>r.cai);
  const p=X[0].length;
  const xtx=Array.from({length:p},()=>Array(p).fill(0));
  const xty=Array(p).fill(0);
  for(let i=0;i<X.length;i++){
    for(let a=0;a<p;a++){
      xty[a]+=X[i][a]*y[i];
      for(let c=0;c<p;c++) xtx[a][c]+=X[i][a]*X[i][c];
    }
  }
  for(let j=1;j<p;j++) xtx[j][j]+=RIDGE_LAMBDA;
  return {stats,beta:solveLinear(xtx,xty)};
}
function predictRidge(model,row){
  const x=[1,...vector(row,model.stats)];
  return x.reduce((sum,v,i)=>sum+v*model.beta[i],0);
}

function fitKnn(rows){
  return {rows,stats:featureStats(rows,KNN_FEATURES)};
}
function predictKnn(model,row){
  const target=vector(row,model.stats);
  const scored=model.rows.map(r=>{
    const x=vector(r,model.stats);
    const distance=Math.sqrt(x.reduce((sum,v,i)=>sum+(v-target[i])**2,0));
    return {row:r,distance};
  }).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(KNN_K,model.rows.length));
  if(scored[0]?.distance < 1e-12) return scored[0].row.cai;
  let num=0,den=0;
  for(const item of scored){
    const w=1/Math.max(item.distance,1e-9);
    num+=item.row.cai*w; den+=w;
  }
  return num/den;
}

export function fitCaiEstimator(observedRows){
  if(observedRows.length < 8) throw new Error(`Need at least 8 observed CAI families, got ${observedRows.length}`);
  return {ridge:fitRidge(observedRows),knn:fitKnn(observedRows),observedCount:observedRows.length};
}
export function predictCai(estimator,row){
  const ridge=predictRidge(estimator.ridge,row);
  const knn=predictKnn(estimator.knn,row);
  const estimate=CAI_BLEND.ridge*ridge+CAI_BLEND.knn*knn;
  return {estimate:Math.max(0,Math.min(100,estimate)),ridge,knn};
}

export function rowFromModelFamily(slug, benchmarks, outputTokens, cai=null){
  return {
    slug,
    cai,
    scicode:benchmarks.scicode,
    gpqa:benchmarks.gpqa,
    hle:benchmarks.hle,
    lcr:benchmarks.lcr,
    gdpval:benchmarks.gdpval,
    omniscienceIndex:benchmarks.omniscienceIndex,
    logOutputTokens:Math.log1p(outputTokens),
  };
}
