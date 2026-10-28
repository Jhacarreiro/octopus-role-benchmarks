// Parse complete source objects, keeping each reasoning effort independent.
function objectAt(text,start){
  let depth=0,string=false,escape=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}
    if(c==='"')string=true;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return JSON.parse(text.slice(start,i+1));
  }
  return null;
}
export function flightText(html){
  const parts=[];
  for(const match of html.matchAll(/self\.__next_f\.push\((\[1,.*?\])\)<\/script>/gs)){
    const item=JSON.parse(match[1]);if(typeof item[1]==='string')parts.push(item[1]);
  }
  return parts.join('');
}
const fields=['intelligenceIndex','intelligenceIndexIsEstimated','scicode','hle','gpqa','lcr','gdpval','briefcaseElo','automationBenchPartialScore','gdpPdfAllPass','terminalBench40','frontierCode20','hleDiamond','terminalBenchScience','critptAgenticHard','omniscience'];
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
function resolveMetadata(row,slug){
  const briefcase=[row.briefcaseElo,row.briefcaseBreakdown?.overall?.elo,row.briefcaseBreakdown?.elo].filter(v=>v!=null);
  if(briefcase.some(v=>!Number.isFinite(v))||briefcase.some(v=>Math.abs(v-briefcase[0])>1e-8))throw new Error(`Conflicting Briefcase scales for ${slug}`);
  const evaluations=row.intelligenceIndexEvaluations??[];
  if(!Array.isArray(evaluations)||evaluations.some(e=>typeof e?.slug!=='string'))throw new Error(`Invalid Intelligence evaluation metadata for ${slug}`);
  const ordered=[...new Map(evaluations.map(e=>{const c=canonical(e);return [JSON.stringify(c),c];})).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {briefcaseElo:briefcase[0]??null,intelligenceIndexEvaluations:ordered,release:row.release?.slug??null,effort:row.effort?.slug??null,deprecated:row.deprecated===true};
}
export function parseModelObservations(html,slug){
  const text=flightText(html);
  const quoted=JSON.stringify(slug).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('\\{(?:"id":"[^"]+",)?"slug":'+quoted,'g');
  const found=[];
  for(const match of text.matchAll(pattern)){
    const row=objectAt(text,match.index);
    if(row?.slug===slug&&Object.hasOwn(row,'scicode')&&Object.hasOwn(row,'intelligenceIndex'))found.push(row);
  }
  if(!found.length)return {slug,sourceUrl:`https://artificialanalysis.ai/models/${slug}`,sourceUnavailableReason:'Exact model/effort object unavailable'};
  const row=found[0];
  const metadata=resolveMetadata(row,slug);
  for(const other of found.slice(1)){
    if(other.id!==row.id||fields.filter(k=>k!=='briefcaseElo').some(key=>(other[key]??null)!==(row[key]??null))||JSON.stringify(resolveMetadata(other,slug))!==JSON.stringify(metadata))throw new Error(`Conflicting AA observations for ${slug}`);
  }
  const evaluations=metadata.intelligenceIndexEvaluations;
  const v5=evaluations.some(e=>e.slug==='frontiercode-2-0')&&evaluations.some(e=>e.slug==='hle-diamond');
  return {slug,id:row.id,name:row.name,release:row.release?.slug??null,effort:row.effort?.slug??null,deprecated:row.deprecated===true,
    ...Object.fromEntries(fields.map(k=>[k,row[k]??null])),...metadata,
    intelligenceIndexVersion:v5?'5.0':null,intelligenceIndexEvaluations:evaluations,
    sourceUrl:`https://artificialanalysis.ai/models/${slug}`};
}
