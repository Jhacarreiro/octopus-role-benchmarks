const URL='https://www.benchleader.com/benchmarks/aa_gdpval';
const ANCHORS=[['claude-opus-5-5',68.3135],['muse-wonder',63.517]];
export async function secondaryGdpvalObservations(){
  const res=await fetch(URL,{signal:AbortSignal.timeout(14000),headers:{Accept:'text/html'}});
  if(!res.ok)throw new Error(`GDPval mirror HTTP ${res.status}`);
  const html=await res.text();
  const parsed=[];
  // Values are JSON-escaped fields in the server-rendered leaderboard.
  const rx=/\\"id\\":\\"([^\\]+)\\",\\"modelId\\":\\"([^\\]+)\\".{0,450}?\\"value\\":([0-9]+(?:\.[0-9]+)?)/g;
  for(const m of html.matchAll(rx))parsed.push({configuration:m[1],slug:m[2],value:Number(m[3])});
  if(parsed.length<200)throw new Error(`GDPval mirror incomplete: ${parsed.length} rows`);
  for(const [slug,value] of ANCHORS){
    if(!parsed.some(r=>r.slug===slug&&Math.abs(r.value-value)<0.1))throw new Error(`GDPval mirror scale mismatch for ${slug}`);
  }
  const result=new Map();
  // Explicit, independently verified configuration mapping. Do not infer from substrings.
  for(const [slug,configuration] of [['claude-sonnet-4-6','claude-sonnet-4-6@max']]){
    const matches=parsed.filter(r=>r.slug===slug&&r.configuration===configuration);
    if(matches.length===1&&Number.isFinite(matches[0].value)&&matches[0].value>=0&&matches[0].value<=100){
      result.set(slug,{value:matches[0].value,configuration,sourceUrl:URL});
    }
  }
  return result;
}
