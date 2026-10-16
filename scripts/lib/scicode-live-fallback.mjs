const URL='https://artificialanalysis.ai/evaluations/scicode';
const KEYS=['slug','scicode','hle','lcr'];
const LAMBDA=1;
const field=(b,k)=>{const m=b.match(new RegExp('\\\\\\"'+k+'\\\\\\":(null|-?[0-9]+(?:\\.[0-9]+)?)'));return !m||m[1]==='null'?null:Number(m[1]);};
export async function fetchScicodeReference(){
  const response=await fetch(URL,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`AA SciCode leaderboard HTTP ${response.status}`);
  const html=await response.text();
  const starts=[...html.matchAll(/\{\\"id\\":/g)];
  const rows=new Map();
  for(const match of starts){
    const start=match.index;let depth=0,end=-1;
    for(let j=start;j<Math.min(html.length,start+50000);j++){
      if(html[j]==='{')depth++;
      else if(html[j]==='}'&&--depth===0){end=j+1;break;}
    }
    if(end<0)continue;
    const block=html.slice(start,end);
    const slug=block.match(/\\"slug\\":\\"([^\\]+)\\"/)?.[1];
    if(!slug)continue;
    const scicode=field(block,'scicode');
    const hle=field(block,'hle');
    const lcr=field(block,'lcr');
    if([scicode,hle,lcr].every(Number.isFinite)&&[scicode,hle,lcr].every(x=>x>=0&&x<=1))rows.set(slug,{slug,scicode,hle,lcr});
  }
  if(rows.size<21)throw new Error(`AA SciCode leaderboard has only ${rows.size} complete HLE/LCR observations`);
  return {rows:[...rows.values()],sourceUrl:URL};
}
function solve(a,b){
  const M=a.map((r,i)=>[...r,b[i]]);
  for(let j=0;j<b.length;j++){
    let p=j;for(let k=j+1;k<b.length;k++)if(Math.abs(M[k][j])>Math.abs(M[p][j]))p=k;
    if(Math.abs(M[p][j])<1e-12)throw new Error('Singular SciCode feature matrix');
    [M[j],M[p]]=[M[p],M[j]];
    const v=M[j][j];for(let k=j;k<=b.length;k++)M[j][k]/=v;
    for(let i=0;i<b.length;i++)if(i!==j){const c=M[i][j];for(let k=j;k<=b.length;k++)M[i][k]-=c*M[j][k];}
  }
  return M.map(r=>r[b.length]);
}
function fit(rows){
  const mean=['hle','lcr'].map(k=>rows.reduce((a,r)=>a+r[k],0)/rows.length);
  const sd=['hle','lcr'].map((k,j)=>Math.max(1e-9,Math.sqrt(rows.reduce((a,r)=>a+(r[k]-mean[j])**2,0)/rows.length)));
  const vector=r=>[1,...['hle','lcr'].map((k,j)=>(r[k]-mean[j])/sd[j])];
  const a=Array.from({length:3},()=>Array(3).fill(0)),b=Array(3).fill(0);
  for(const r of rows){const x=vector(r);for(let i=0;i<3;i++){b[i]+=x[i]*r.scicode*100;for(let j=0;j<3;j++)a[i][j]+=x[i]*x[j];}}
  a[1][1]+=LAMBDA;a[2][2]+=LAMBDA;
  const weights=solve(a,b);
  return r=>Math.max(0,Math.min(100,vector(r).reduce((sum,v,i)=>sum+v*weights[i],0)));
}
export function validatedScicodeTwoFeature(rows){
  if(rows.length<21)return {valid:false,observed:rows.length};
  const errors=rows.map((r,i)=>Math.abs(fit(rows.filter((_,j)=>i!==j))(r)-r.scicode*100));
  const mae=errors.reduce((a,b)=>a+b,0)/errors.length,maxError=Math.max(...errors);
  return {valid:mae<=3&&maxError<=8,observed:rows.length,mae,maxError,predict:fit(rows)};
}
