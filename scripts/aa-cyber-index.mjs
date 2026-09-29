export const AA_CYBER_INDEX_URL='https://artificialanalysis.ai/evaluations/artificial-analysis-cyber-index';
const UA='Mozilla/5.0 (compatible; OctopusRoleBenchmarks/1.0; +https://github.com/Jhacarreiro/octopus-role-benchmarks)';

function textField(obj,field){
  const m=obj.match(new RegExp('\\\\"'+field+'\\\\":\\\\"([^\"]*)\\\\"'));
  return m?m[1]:null;
}
function numberField(obj,field){
  const m=obj.match(new RegExp('\\\\"'+field+'\\\\":(null|-?[0-9]+(?:\\.[0-9]+)?)'));
  return !m||m[1]==='null'?null:Number(m[1]);
}
function extractObjects(html){
  const starts=[];
  const re=/\{\\"id\\":\\"[^\"]+\\",\\"slug\\":\\"/g;
  for(let m;(m=re.exec(html));)starts.push(m.index);
  const out=[];
  for(const start of starts){
    let depth=0,end=-1;
    for(let i=start;i<html.length;i++){
      if(html[i]==='{')depth++;
      else if(html[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break}
      }
    }
    if(end>start)out.push(html.slice(start,end));
  }
  return out;
}
export function parseArtificialAnalysisCyberIndex(html){
  const bySlug=new Map();
  for(const obj of extractObjects(html)){
    const slug=textField(obj,'slug');
    const score=numberField(obj,'cyberIndex');
    if(!slug||!Number.isFinite(score))continue;
    bySlug.set(slug,{
      slug,
      name:textField(obj,'name')??slug,
      value:score,
      components:{
        cweBench:numberField(obj,'cweBench'),
        deepsecBench:numberField(obj,'deepsecBench'),
        cybergymE2e:numberField(obj,'cybergymE2e')
      },
      safetyBlocks:{
        cweBench:numberField(obj,'cweBenchRefusalRate'),
        deepsecBench:numberField(obj,'deepsecBenchRefusalRate'),
        cybergymE2e:numberField(obj,'cybergymE2eRefusalRate')
      }
    });
  }
  if(!bySlug.size)throw new Error('Artificial Analysis Cyber Index parser found no scored model rows');
  return bySlug;
}
export async function fetchArtificialAnalysisCyberIndex({url=AA_CYBER_INDEX_URL,timeoutMs=20000}={}){
  const response=await fetch(url,{headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw new Error(`Artificial Analysis Cyber Index fetch failed HTTP ${response.status}`);
  const bySlug=parseArtificialAnalysisCyberIndex(await response.text());
  return {sourceUrl:url,fetchedAt:new Date().toISOString(),version:'v1',bySlug};
}
