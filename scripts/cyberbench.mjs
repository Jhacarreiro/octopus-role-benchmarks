import fs from 'node:fs';

export const CYBERBENCH_URL='https://www.vals.ai/benchmarks/cyber';

function decodeHtml(value){
  return String(value)
    .replace(/&quot;/g,'"')
    .replace(/&#x27;|&#39;/g,"'")
    .replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>');
}

function toIso(raw){
  const n=Number(raw);
  if(!Number.isFinite(n)) return null;
  const ms=n>1e12?n:n*1000;
  const d=new Date(ms);
  return Number.isNaN(d.getTime())?null:d.toISOString();
}

export function parseCyberBenchHtml(html){
  const decoded=decodeHtml(html);
  const pattern=/"label":\[0,"([^"]+)"\],"time":\[0,([0-9]+)\],"score":\[0,([0-9.]+)\]/g;
  const byLabel=new Map();
  for(const match of decoded.matchAll(pattern)){
    const [,label,timeRaw,scoreRaw]=match;
    if(label.startsWith('Projected ')) continue;
    const score=Number(scoreRaw);
    const time=Number(timeRaw);
    if(!Number.isFinite(score)||score<0||score>100) continue;
    const current=byLabel.get(label);
    if(!current||time>=current.timeRaw){
      byLabel.set(label,{label,score,timeRaw:time,benchmarkUpdatedAt:toIso(time)});
    }
  }
  if(!byLabel.size) throw new Error('CyberBench parser found no direct leaderboard rows');
  return byLabel;
}

export async function fetchCyberBench({url=CYBERBENCH_URL,timeoutMs=15000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{headers:{'user-agent':'octopus-role-benchmarks/1.0'},signal:controller.signal});
    if(!response.ok) throw new Error(`CyberBench fetch failed HTTP ${response.status}`);
    const html=await response.text();
    const byLabel=parseCyberBenchHtml(html);
    const benchmarkUpdatedAt=[...byLabel.values()].map(x=>x.benchmarkUpdatedAt).filter(Boolean).sort().at(-1)??null;
    return{sourceUrl:url,fetchedAt:new Date().toISOString(),benchmarkUpdatedAt,byLabel};
  } finally {
    clearTimeout(timer);
  }
}

export function resolveCyberBenchBySlug(slugs, mapping, dataset){
  const values=new Map();
  const missing=[];
  for(const slug of slugs){
    const label=mapping[slug];
    if(!label){missing.push({slug,reason:'no_explicit_mapping'});continue}
    const row=dataset.byLabel.get(label);
    if(!row){missing.push({slug,label,reason:'label_not_found'});continue}
    values.set(slug,{
      value:row.score,
      provenance:{
        status:'direct',
        benchmark:'Vals AI CyberBench Overall',
        sourceUrl:dataset.sourceUrl,
        sourceLabel:label,
        fetchedAt:dataset.fetchedAt,
        benchmarkUpdatedAt:row.benchmarkUpdatedAt??dataset.benchmarkUpdatedAt??null
      }
    });
  }
  return{values,missing};
}
