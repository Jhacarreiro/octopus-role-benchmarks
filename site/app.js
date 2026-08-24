const DATA_REMOTE='https://raw.githubusercontent.com/Jhacarreiro/octopus-role-benchmarks/main/data/latest.json';
const state={data:null,role:'implementer',basis:'blended50',query:'',minScore:null,showUnscored:false,sort:'value',dir:-1};
const $=s=>document.querySelector(s);
const fmt=n=>n==null?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:3});
const money=n=>n==null?'—':'$'+Number(n).toLocaleString(undefined,{maximumFractionDigits:4});
async function load(){
  const urls=[DATA_REMOTE,'./data/latest.json']; let err;
  for(const url of urls){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status}`);state.data=await r.json();break}catch(e){err=e}}
  if(!state.data){$('#status').textContent='Unable to load current data: '+err;return}
  renderRoles(); setDefaultThreshold(); render();
}
function role(){return state.data.roles.find(r=>r.id===state.role)||state.data.roles[0]}
function renderRoles(){
  $('#roles').innerHTML=state.data.roles.map(r=>`<button data-role="${r.id}">${r.label}</button>`).join('');
  $('#roles').addEventListener('click',e=>{const b=e.target.closest('button[data-role]');if(!b)return;state.role=b.dataset.role;setDefaultThreshold();render()});
}
function setDefaultThreshold(){
  const scores=state.data.models.map(m=>m.roleScores?.[state.role]?.score).filter(Number.isFinite);const max=Math.max(...scores);
  state.minScore=Number((max*.9).toFixed(1)); $('#minScore').value=state.minScore;
}
function noteHtml(m){
  const notes=[];
  if(m.discountPercent)notes.push(`<span class="badge promo">-${m.discountPercent}%</span>`);
  if(m.dataTraining)notes.push('<span class="badge warn">DATA USED FOR TRAINING</span>');
  if(m.mapping?.status==='unscored')notes.push('<span class="badge">UNSCORED</span>');
  if(m.offPeakShown)notes.push('<span class="badge">off-peak</span>');
  return notes.join(' ');
}
function priceHtml(effective,list){return list!=null&&effective!=null&&list!==effective?`<span class="struck">${money(list)}</span>${money(effective)}`:money(effective)}
function rows(){
  const q=state.query.toLowerCase();
  return state.data.models.filter(m=>{
    if(q&&!m.name.toLowerCase().includes(q))return false;
    const score=m.roleScores?.[state.role]?.score;
    if(score==null)return state.showUnscored;
    return score>=state.minScore;
  }).sort((a,b)=>{
    const ra=a.roleScores?.[state.role],rb=b.roleScores?.[state.role];
    const va={name:a.name,score:ra?.score??-Infinity,input:a.inputPerM??Infinity,output:a.outputPerM??Infinity,cost:a.costs?.[state.basis]??Infinity,value:ra?.value?.[state.basis]??-Infinity};
    const vb={name:b.name,score:rb?.score??-Infinity,input:b.inputPerM??Infinity,output:b.outputPerM??Infinity,cost:b.costs?.[state.basis]??Infinity,value:rb?.value?.[state.basis]??-Infinity};
    if(state.sort==='name')return state.dir*va.name.localeCompare(vb.name);
    return state.dir*(va[state.sort]-vb[state.sort]);
  });
}
function render(){
  document.querySelectorAll('#roles button').forEach(b=>b.classList.toggle('active',b.dataset.role===state.role));
  const d=state.data,r=role();
  $('#status').innerHTML=`Snapshot <strong>${d.date}</strong> · ${d.counts.scoredRows}/${d.counts.commandCodeRows} priced rows scored · ${d.counts.scoredFamilies} benchmark families · <span class="coverage">active components 100% covered</span>`;
  const rs=rows(); $('#empty').hidden=rs.length>0;
  $('#rows').innerHTML=rs.map(m=>{const rr=m.roleScores?.[state.role];const un=!rr;return `<tr class="${un?'unscored':''}"><td><span class="model">${m.name}</span><span class="sub">${m.aaModel?.slug||m.mapping?.reason||''}</span></td><td class="num">${un?'—':fmt(rr.score)}</td><td class="num">${priceHtml(m.inputPerM,m.inputListPerM)}</td><td class="num">${priceHtml(m.outputPerM,m.outputListPerM)}</td><td class="num">${money(m.costs?.[state.basis])}</td><td class="num">${un?'—':fmt(rr.value?.[state.basis])}</td><td>${noteHtml(m)}</td></tr>`}).join('');
  renderMethodology(r);
}
function renderMethodology(r){
  const d=state.data;
  const weights=Object.entries(r.weights).map(([k,w])=>`<span class="weight">${d.benchmarks[k].label} <strong>${Math.round(w*100)}%</strong></span>`).join('');
  const details=Object.keys(r.weights).map(k=>`<li><strong>${d.benchmarks[k].label}</strong> — ${d.benchmarks[k].description} Coverage: ${d.coverage[k].present}/${d.coverage[k].total}.</li>`).join('');
  $('#methodology').innerHTML=`<h2>${r.label} methodology</h2><p>${r.purpose}</p><div class="weights">${weights}</div><p>${r.note}</p><p><strong>Role score</strong> is the weighted mean of the components above, each normalized to 0–100. <strong>Score/$</strong> divides that role score by the selected effective CommandCode Max cost basis. Active discounts are used.</p><details><summary>Benchmark definitions and coverage</summary><ul>${details}</ul></details><details><summary>Coverage and identity rules</summary><p>Every active component must cover 100% of the scored AA model-family universe. Missing values are never imputed and weights are never renormalized. Stealth or unresolved CommandCode models remain visible as UNSCORED. Commercial variants share a verified underlying AA benchmark but retain their own CommandCode price and policy flags.</p></details>`;
}
$('#costBasis').addEventListener('change',e=>{state.basis=e.target.value;render()});
$('#minScore').addEventListener('input',e=>{state.minScore=Number(e.target.value)||0;render()});
$('#search').addEventListener('input',e=>{state.query=e.target.value;render()});
$('#showUnscored').addEventListener('change',e=>{state.showUnscored=e.target.checked;render()});
document.querySelector('thead').addEventListener('click',e=>{const th=e.target.closest('th[data-sort]');if(!th)return;const s=th.dataset.sort;if(state.sort===s)state.dir*=-1;else{state.sort=s;state.dir=s==='cost'||s==='input'||s==='output'?1:-1}render()});
load();
