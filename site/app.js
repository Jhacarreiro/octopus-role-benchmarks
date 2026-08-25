const DATA_REMOTE='https://raw.githubusercontent.com/Jhacarreiro/octopus-role-benchmarks/main/data/latest.json';
const state={data:null,role:'implementer',mode:'value',query:'',showUnscored:false,sort:'value',dir:-1};
const LINEUP={architect:'Claude Opus 5',strategist:'GPT-5.6 Luna','security-reviewer':'MiMo V2.5','code-reviewer':'DeepSeek V4 Flash (latest)',implementer:'Muse Spark 1.2 Contributor','implementer-heavy':'GPT-5.6 Sol',synthesizer:'Inkling Small',researcher:'Tencent Hy3'};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n==null?'—':Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
async function load(){let err;for(const url of [DATA_REMOTE,'./data/latest.json']){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status}`);state.data=await r.json();break}catch(e){err=e}}if(!state.data){$('#status').textContent='Unable to load current data: '+err;return}renderLineup();renderRoles();render()}
function renderLineup(){$('#lineup').innerHTML=state.data.roles.map(r=>{const name=LINEUP[r.id];return `<div class="lineup-item"><span class="lineup-role">${esc(r.label)}</span><strong>${esc(name)}</strong></div>`}).join('')}
function renderRoles(){$('#roles').innerHTML=state.data.roles.map(r=>`<button data-role="${esc(r.id)}">${esc(r.label)}</button>`).join('');$('#roles').addEventListener('click',e=>{const b=e.target.closest('button[data-role]');if(!b)return;state.role=b.dataset.role;state.sort='value';state.dir=-1;render()})}
function metricValue(m){const s=m.roleScores?.[state.role];return state.mode==='quality'?(s?.rankingQuality??null):(s?.rankingValue??null)}
function noteHtml(m){const a=[];if(m.discountPercent)a.push(`<span class="badge promo">-${m.discountPercent}%</span>`);if(m.dataTraining)a.push('<span class="badge warn">DATA USED FOR TRAINING</span>');if(m.mapping?.status==='unscored')a.push('<span class="badge">UNSCORED</span>');if(m.offPeakShown)a.push('<span class="badge">off-peak</span>');return a.join(' ')}
function sortedRows(){const q=state.query.toLowerCase();return state.data.models.filter(m=>{if(q&&!m.name.toLowerCase().includes(q))return false;const v=metricValue(m);return v!=null||state.showUnscored}).sort((a,b)=>{const av=metricValue(a),bv=metricValue(b);if(state.sort==='name')return state.dir*a.name.localeCompare(b.name);if(av==null&&bv==null)return a.name.localeCompare(b.name);if(av==null)return 1;if(bv==null)return -1;return state.dir*(av-bv)})}
function render(){
  document.querySelectorAll('#roles button').forEach(b=>b.classList.toggle('active',b.dataset.role===state.role));
  document.querySelectorAll('.segmented button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
  const d=state.data;$('#status').innerHTML=`Snapshot <strong>${esc(d.date)}</strong> · ${d.counts.scoredRows}/${d.counts.commandCodeRows} priced rows ranked · ranking coverage <span class="coverage">${d.caiStarCoverage.present}/${d.caiStarCoverage.total}</span> benchmark families`;
  $('#metricHeading').textContent=state.mode==='quality'?'Role Quality ↑':'Ranking Value ↑';
  $('#modeNote').innerHTML=state.mode==='quality'?'Quality mode ignores price completely and ranks only the role-quality score. Coding roles still include the validated CAI* adjustment. See <a href="./methodology.html">methodology</a>.':'Value mode ranks role quality per CommandCode Cost per Task. Quality mode ignores price entirely. See <a href="./methodology.html">methodology</a> for the exact role formula, task-cost normalization and CAI estimation validation.';
  const globalRank=new Map(state.data.models.filter(m=>metricValue(m)!=null).sort((a,b)=>metricValue(b)-metricValue(a)).map((m,i)=>[m,i+1]));
  const rs=sortedRows();$('#empty').hidden=rs.length>0;
  $('#rows').innerHTML=rs.map(m=>{const v=metricValue(m);return `<tr class="${v==null?'unscored':''}"><td class="num rank">${v==null?'—':globalRank.get(m)}</td><td><span class="model">${esc(m.name)}</span></td><td class="num value-main">${fmt(v)}</td><td>${noteHtml(m)}</td></tr>`}).join('');
}
$('#search').addEventListener('input',e=>{state.query=e.target.value;render()});
$('#showUnscored').addEventListener('change',e=>{state.showUnscored=e.target.checked;render()});
document.querySelector('.segmented').addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(!b)return;state.mode=b.dataset.mode;state.sort='value';state.dir=-1;render()});
document.querySelector('thead').addEventListener('click',e=>{const th=e.target.closest('th[data-sort]');if(!th)return;const s=th.dataset.sort;if(state.sort===s)state.dir*=-1;else{state.sort=s;state.dir=s==='name'?1:-1}render()});
load();
