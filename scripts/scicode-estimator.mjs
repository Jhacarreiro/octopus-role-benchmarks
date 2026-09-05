export const SCICODE_FEATURES = ['gpqa','hle','lcr','gdpval','omniscienceIndex'];
export const SCICODE_RIDGE_LAMBDA = 2;
export const SCICODE_VALIDATION_LIMITS = { mae: 3, maxError: 8, minObserved: 20 };

function mean(values){ return values.reduce((a,b)=>a+b,0)/values.length; }
function std(values, mu){
  const v=Math.sqrt(values.reduce((a,b)=>a+(b-mu)**2,0)/values.length);
  return v < 1e-9 ? 1 : v;
}
function featureStats(rows){
  return SCICODE_FEATURES.map(feature=>{
    const values=rows.map(r=>r[feature]);
    const mu=mean(values);
    return {feature, mean:mu, std:std(values,mu)};
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

export function fitScicodeEstimator(rows){
  if(rows.length < SCICODE_VALIDATION_LIMITS.minObserved) throw new Error(`Need at least ${SCICODE_VALIDATION_LIMITS.minObserved} observed SciCode families, got ${rows.length}`);
  const stats=featureStats(rows);
  const X=rows.map(r=>[1,...vector(r,stats)]);
  const y=rows.map(r=>r.scicode);
  const p=X[0].length;
  const xtx=Array.from({length:p},()=>Array(p).fill(0));
  const xty=Array(p).fill(0);
  for(let i=0;i<X.length;i++){
    for(let a=0;a<p;a++){
      xty[a]+=X[i][a]*y[i];
      for(let c=0;c<p;c++) xtx[a][c]+=X[i][a]*X[i][c];
    }
  }
  for(let j=1;j<p;j++) xtx[j][j]+=SCICODE_RIDGE_LAMBDA;
  return {stats,beta:solveLinear(xtx,xty),observedCount:rows.length};
}

export function predictScicode(model,row){
  const x=[1,...vector(row,model.stats)];
  const estimate=x.reduce((sum,v,i)=>sum+v*model.beta[i],0);
  return Math.max(0,Math.min(100,estimate));
}

export function validateScicodeEstimator(rows){
  const errors=[];
  for(let i=0;i<rows.length;i++){
    const train=rows.filter((_,j)=>j!==i);
    const model=fitScicodeEstimator(train);
    const predicted=predictScicode(model,rows[i]);
    errors.push({slug:rows[i].slug,actual:rows[i].scicode,predicted,error:Math.abs(predicted-rows[i].scicode)});
  }
  const mae=mean(errors.map(x=>x.error));
  const maxError=Math.max(...errors.map(x=>x.error));
  return {mae,maxError,errors};
}

export function scicodeRowFromAa(model){
  const omni=model.omniscience;
  return {
    slug:model.slug,
    scicode:model.scicode==null?null:model.scicode*100,
    gpqa:model.gpqa==null?null:model.gpqa*100,
    hle:model.hle==null?null:model.hle*100,
    lcr:model.lcr==null?null:model.lcr*100,
    gdpval:model.gdpvalNormalized==null?null:model.gdpvalNormalized*100,
    omniscienceIndex:omni==null?null:50+omni/2,
  };
}

export function isCompleteScicodeFeatureRow(row){
  return SCICODE_FEATURES.every(f=>Number.isFinite(row[f]));
}
