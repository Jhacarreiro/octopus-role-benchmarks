
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
const rankButtons=['quality','balanced'].map(mode=>{const e=new El(`rank-${mode}`);e.dataset.mode=mode;return e});

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
  return {ok:true,status:200,json:async()=>JSON.parse(body)};
};

const code=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
eval(code);

await new Promise(r=>setTimeout(r,25));

if(rawCalls!==0) throw new Error(`same-origin was not preferred; raw calls=${rawCalls}`);
if(!one('#lineup').innerHTML.includes('Claude Opus 5')) throw new Error('default Balanced lineup did not render');
if(one('#rows').innerHTML.length<100) throw new Error('ranking table did not render');

const before=one('#lineup').innerHTML;
const qualityButton={dataset:{lineupMode:'quality'}};
one('.lineup-modes').trigger('click',{target:{closest:()=>qualityButton}});
const after=one('#lineup').innerHTML;
if(after===before) throw new Error('lineup mode button did not change rendered lineup');
if(!after.includes('Claude Fable 5.1')) throw new Error('Quality lineup did not render after button click');

const rankButton={dataset:{mode:'quality'}};
one('.ranking-modes').trigger('click',{target:{closest:()=>rankButton}});
if(one('#metricHeading').textContent!=='Role Quality ↑') throw new Error('ranking mode button did not switch to Quality');

console.log('ok: site renders from same-origin data with raw GitHub unavailable, and mode buttons work');
