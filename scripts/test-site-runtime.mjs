
import fs from 'node:fs';

class El {
  constructor(sel){
    this.sel=sel;
    this.innerHTML='';
    this.textContent='';
    this.hidden=false;
    this.dataset={};
    this.handlers={};
    this.classList={toggle(){}};
  }
  addEventListener(type,fn){this.handlers[type]=fn}
  closest(){return null}
  trigger(type,event){this.handlers[type]?.(event)}
}

const els=new Map();
const one=s=>{if(!els.has(s))els.set(s,new El(s));return els.get(s)};
const lineupButtons=['quality','balanced','budget'].map(mode=>{const e=new El(`lineup-${mode}`);e.dataset.lineupMode=mode;return e});
const rankButtons=['quality','balanced','budget'].map(mode=>{const e=new El(`rank-${mode}`);e.dataset.mode=mode;return e});

globalThis.document={
  querySelector:one,
  querySelectorAll:(s)=>{
    if(s==='[data-lineup-mode]') return lineupButtons;
    if(s==='[data-mode]') return rankButtons;
    if(s==='#roles button') return [];
    return [];
  }
};

let rawCalls=0;
globalThis.fetch=async (url)=>{
  const u=String(url).replace(/\?v=\d+$/,'');
  if(u.startsWith('https://raw.githubusercontent.com/')){
    rawCalls++;
    throw new Error('raw GitHub deliberately unavailable in site smoke');
  }
  const rel=u.replace(/^\.\//,'');
  const p=new URL(`../site/${rel}`,import.meta.url);
  const body=fs.readFileSync(p,'utf8');
  let payload=JSON.parse(body);
  if(process.env.SELECTIVE_SNAPSHOT&&rel==='data/latest.json')payload=JSON.parse(fs.readFileSync(process.env.SELECTIVE_SNAPSHOT??new URL('../site/data/latest.json',import.meta.url),'utf8'));
  if(process.env.SELECTIVE_LINEUPS&&rel==='data/lineups.json')payload=JSON.parse(fs.readFileSync(process.env.SELECTIVE_LINEUPS,'utf8'));
  if(process.env.SELECTIVE_MISMATCH&&rel==='data/lineups.json')payload.methodologyVersion=9;
  if(rel==='data/latest.json'){
    payload.validationStatus='partial';
    payload.validationIssues=[{benchmark:'scicode',targetSlug:'fixture-model',status:'stale',reason:'fixture validation failure',lastObserved:{observedAt:'2026-09-16T12:39:00.000Z'}}];
    payload.counts={...payload.counts,partialRows:1};
  }
  if(rel==='data/refresh-status.json'){
    payload.status='partial';
    payload.message='Published with partial validation.';
    payload.validationIssues=[{benchmark:'scicode',targetSlug:'fixture-model',status:'stale',reason:'fixture validation failure',lastObserved:{observedAt:'2026-09-16T12:39:00.000Z'}}];
  }
  return {ok:true,status:200,json:async()=>payload};
};

const isSelective=JSON.parse(fs.readFileSync(process.env.SELECTIVE_SNAPSHOT??new URL('../site/data/latest.json',import.meta.url),'utf8')).methodologyVersion>=10;
const expectedLineups=JSON.parse(fs.readFileSync(process.env.SELECTIVE_LINEUPS??new URL('../site/data/lineups.json',import.meta.url),'utf8'));
const code=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
eval(code);

await new Promise(r=>setTimeout(r,25));

if(rawCalls!==0) throw new Error(`same-origin was not preferred; raw calls=${rawCalls}`);
if(process.env.SELECTIVE_MISMATCH){
  if(!one('#lineupNote').textContent.includes('do not match'))throw new Error('Mixed methodology portfolios were not rejected');
  if(one('#lineup').innerHTML)throw new Error('Mixed methodology portfolio rendered');
  console.log('ok: mismatched methodology portfolios rejected while role rankings remain available');
  process.exit(0);
}
const expectedBalanced=expectedLineups.modes.balanced.selections.architect.model;
if(!one('#lineup').innerHTML.includes(expectedBalanced)) throw new Error('default Balanced lineup did not render expected model: '+expectedBalanced);
if(one('#rows').innerHTML.length<100) throw new Error('ranking table did not render');
if(isSelective){
  if(!one('#status').innerHTML.includes('estimators disabled'))throw new Error('v10 status/provenance not shown');
  const snapshot=JSON.parse(fs.readFileSync(process.env.SELECTIVE_SNAPSHOT??new URL('../site/data/latest.json',import.meta.url),'utf8'));
  for(const m of snapshot.models.filter(m=>m.generationEligibility?.eligible===false))if(one('#rows').innerHTML.includes(`>${m.name}</span>`))throw new Error('Historical model leaked into current ranking');
  if(snapshot.models.some(m=>m.roleScores.implementer?.status==='estimated')&&(!one('#rows').innerHTML.includes('ESTIMATED')||!one('#rows').innerHTML.includes('Benchmark provenance: estimated role analogy')))throw new Error('Role approximations must retain their label and explanation');
  if(snapshot.coverageScope==='all-roles'){
    const expected=snapshot.models.filter(m=>m.modelEligibility?.eligible).length;
    for(const role of snapshot.roles){
      one('#roles').trigger('click',{target:{closest:()=>({dataset:{role:role.id}})}});
      if((one('#rows').innerHTML.match(/<tr>/g)||[]).length!==expected)throw new Error('A model disappeared when switching role: '+role.id);
    }
    one('#roles').trigger('click',{target:{closest:()=>({dataset:{role:'implementer'}})}});
  }
}else if(!one('#status').innerHTML.includes('Benchmark partially validated')) throw new Error('partial validation state not shown in status');
if(!one('#refreshAlert').innerHTML.includes('fixture-model')||!one('#refreshAlert').innerHTML.includes('stale')) throw new Error('partial validation issue details not shown');

const before=one('#lineup').innerHTML;
const qualityButton={dataset:{lineupMode:'quality'}};
one('.lineup-modes').trigger('click',{target:{closest:()=>qualityButton}});
const after=one('#lineup').innerHTML;
if(after===before) throw new Error('lineup mode button did not change rendered lineup');
const expectedQuality=expectedLineups.modes.quality.selections.architect.model;
if(!after.includes(expectedQuality)) throw new Error('Quality lineup did not render expected model after button click: '+expectedQuality);

const rankButton={dataset:{mode:'quality'}};
one('.ranking-modes').trigger('click',{target:{closest:()=>rankButton}});
if(one('#metricHeading').textContent!=='Role Quality ↑') throw new Error('ranking mode button did not switch to Quality');
const budgetButton={dataset:{mode:'budget'}};
one('.ranking-modes').trigger('click',{target:{closest:()=>budgetButton}});
if(one('#metricHeading').textContent!=='Budget Role Score ↑') throw new Error('ranking mode button did not switch to Budget');
const budgetRows=one('#rows').innerHTML;

if(isSelective){
  eval(fs.readFileSync(new URL('../site/methodology.js',import.meta.url),'utf8'));
  await new Promise(r=>setTimeout(r,25));
  if(!one('#coverage').innerHTML.includes('Estimated offers'))throw new Error('Measured and estimated coverage must remain separate');
  if(!one('#validation').innerHTML.includes('confidence intervals'))throw new Error('Heuristic uncertainty must be explained');
}

console.log('ok: site renders from same-origin data with raw GitHub unavailable, and mode buttons work');
