const DATA_REMOTE='https://raw.githubusercontent.com/Jhacarreiro/octopus-role-benchmarks/main/data/latest.json';
const state={data:null,role:'implementer',query:'',showUnscored:false,sort:'value',dir:-1};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n==null?'—':Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
async function load(){let err;for(const url of [DATA_REMOTE,'./data/latest.json']){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status}`);state.data=await r.json();break}catch(e){err=e}}if(!state.data){$('#status').textContent='Unable to load current data: '+err;return}renderRoles();render()}
function renderRoles(){$('#roles').innerHTML=state.data.roles.map(r=>`<button data-role="${esc(r.id)}">${esc(r.label)}</button>`).join('');$('#roles').addEventListener('click',e=>{const b=e.target.closest('button[data-role]');if(!b)return;state.role=b.dataset.role;state.sort='value';state.dir=-1;render()})}
function rankingValue(m){return m.roleScores?.[state.role]?.rankingValue??null}
function noteHtml(m){const a=[];if(m.discountPercent)a.push(`<span class="badge promo">-${m.discountPercent}%</span>`);if(m.dataTraining)a.push('<span class="badge warn">DATA USED FOR TRAINING</span>');if(m.mapping?.status==='unscored')a.push('<span class="badge">UNSCORED</span>');if(m.offPeakShown)a.push('<span class="badge">off-peak</span>');return a.join(' ')}
function sortedRows(){const q=state.query.toLowerCase();return state.data.models.filter(m=>{if(q&&!m.name.toLowerCase().includes(q))return false;const v=rankingValue(m);return v!=null||state.showUnscored}).sort((a,b)=>{const av=rankingValue(a),bv=rankingValue(b);if(state.sort==='name')return state.dir*a.name.localeCompare(b.name);if(av==null&&bv==null)return a.name.localeCompare(b.name);if(av==null)return 1;if(bv==null)return -1;return state.dir*(av-bv)})}
function render(){
  document.querySelectorAll('#roles button').forEach(b=>b.classList.toggle('active',b.dataset.role===state.role));
  const d=state.data;$('#status').innerHTML=`Snapshot <strong>${esc(d.date)}</strong> · ${d.counts.scoredRows}/${d.counts.commandCodeRows} priced rows ranked · ranking coverage <span class="coverage">${d.caiStarCoverage.present}/${d.caiStarCoverage.total}</span> benchmark families`;
  const globalRank=new Map(state.data.models.filter(m=>rankingValue(m)!=null).sort((a,b)=>rankingValue(b)-rankingValue(a)).map((m,i)=>[m,i+1]));
  const rs=sortedRows();$('#empty').hidden=rs.length>0;
  $('#rows').innerHTML=rs.map(m=>{const v=rankingValue(m);return `<tr class="${v==null?'unscored':''}"><td class="num rank">${v==null?'—':globalRank.get(m)}</td><td><span class="model">${esc(m.name)}</span></td><td class="num value-main">${fmt(v)}</td><td>${noteHtml(m)}</td></tr>`}).join('');
}
$('#search').addEventListener('input',e=>{state.query=e.target.value;render()});
$('#showUnscored').addEventListener('change',e=>{state.showUnscored=e.target.checked;render()});
document.querySelector('thead').addEventListener('click',e=>{const th=e.target.closest('th[data-sort]');if(!th)return;const s=th.dataset.sort;if(state.sort===s)state.dir*=-1;else{state.sort=s;state.dir=s==='name'?1:-1}render()});
load();
