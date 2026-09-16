export const CAI_MIGRATION_LIMITS=Object.freeze({
  minComparableFamilies:4,
  minMedianRatio:0.5,
  maxMedianRatio:1.1,
  maxRatioMad:0.12,
  maxLooMae:6,
  maxLooError:10
});

function median(values){
  const a=[...values].sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

export function caiIndexPercent(value){
  if(!Number.isFinite(value))return null;
  return value<=1.5?value*100:value;
}

export function detectCodingAgentVersionFromRows(rows){
  const keys=new Set((rows||[]).flatMap(r=>Object.keys(r.evaluations||{})));
  if(keys.has('terminal-bench-v4')||keys.has('deep-swe-v1.1'))return 'v1.5';
  if(keys.has('terminal-bench-v2.1'))return 'v1.4';
  return 'unknown';
}

export function detectCodingAgentVersionFromSnapshot(snapshot){
  const explicit=snapshot?.sources?.codingAgentIndex?.version;
  if(explicit)return explicit;
  for(const m of snapshot?.models||[]){
    const keys=Object.keys(m.codingAgent?.evaluations||{});
    if(keys.includes('terminal-bench-v4')||keys.includes('deep-swe-v1.1'))return 'v1.5';
    if(keys.includes('terminal-bench-v2.1'))return 'v1.4';
  }
  return 'unknown';
}

export function normalizeCodingVariantLabel(label){
  return String(label??'')
    .replace(/\s*\(\{[^)]*reasoning_effort[^)]*\}\)\s*$/i,'')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

export function historicalCaiAnchor(previousModel,previousSnapshotVersion,previousObservedAt){
  const persisted=previousModel?.caiStar?.historicalAnchor;
  if(persisted?.version==='v1.4'&&Number.isFinite(persisted.value))return {...persisted};
  if(previousSnapshotVersion!=='v1.4')return null;
  const c=previousModel?.codingAgent;
  if(!Number.isFinite(c?.indexScore))return null;
  return {
    version:'v1.4',
    value:c.indexScore,
    observedAt:previousObservedAt??null,
    agent:c.agent??null,
    displayLabel:c.displayLabel??null,
    hostModelSlug:c.hostModelSlug??null
  };
}

export function calibrateHistoricalCai({currentBySlug,previousBySlug,previousSnapshotVersion,previousObservedAt,currentVersion,limits=CAI_MIGRATION_LIMITS}){
  const pairs=[];
  for(const [slug,current] of currentBySlug||[]){
    const previousModel=previousBySlug?.get(slug);
    const anchor=historicalCaiAnchor(previousModel,previousSnapshotVersion,previousObservedAt);
    const currentValue=caiIndexPercent(current?.indexScore);
    if(!anchor||!Number.isFinite(currentValue)||anchor.value<=0)continue;
    if(anchor.agent&&current.agent&&anchor.agent!==current.agent)continue;
    if(anchor.displayLabel&&current.displayLabel&&normalizeCodingVariantLabel(anchor.displayLabel)!==normalizeCodingVariantLabel(current.displayLabel))continue;
    pairs.push({slug,previous:anchor.value,current:currentValue,ratio:currentValue/anchor.value});
  }
  const ratios=pairs.map(x=>x.ratio);
  const rawMedianRatio=median(ratios);
  const factor=rawMedianRatio==null?null:Math.min(1,rawMedianRatio);
  const ratioMad=rawMedianRatio==null?null:median(ratios.map(x=>Math.abs(x-rawMedianRatio)));
  const looErrors=[];
  if(pairs.length>=2){
    for(let i=0;i<pairs.length;i++){
      const train=pairs.filter((_,j)=>j!==i).map(x=>x.ratio);
      const looFactor=Math.min(1,median(train));
      const predicted=pairs[i].previous*looFactor;
      looErrors.push({slug:pairs[i].slug,error:Math.abs(predicted-pairs[i].current)});
    }
  }
  const looMae=looErrors.length?looErrors.reduce((a,b)=>a+b.error,0)/looErrors.length:null;
  const looMaxError=looErrors.length?Math.max(...looErrors.map(x=>x.error)):null;
  const errors=[];
  if(pairs.length<limits.minComparableFamilies)errors.push(`comparable families ${pairs.length}<${limits.minComparableFamilies}`);
  if(rawMedianRatio==null||rawMedianRatio<limits.minMedianRatio||rawMedianRatio>limits.maxMedianRatio)errors.push(`median ratio ${rawMedianRatio}`);
  if(ratioMad==null||ratioMad>limits.maxRatioMad)errors.push(`ratio MAD ${ratioMad}`);
  if(looMae==null||looMae>limits.maxLooMae)errors.push(`LOO MAE ${looMae}`);
  if(looMaxError==null||looMaxError>limits.maxLooError)errors.push(`LOO max error ${looMaxError}`);
  if(currentVersion!=='v1.5')errors.push('unsupported target version '+currentVersion);
  return {valid:errors.length===0,fromVersion:'v1.4',toVersion:currentVersion,method:'median_overlap_ratio',factor,rawMedianRatio,comparableFamilies:pairs.length,ratioMad,looMae,looMaxError,pairs,errors,limits};
}

export function applyHistoricalCai(anchor,calibration){
  if(!anchor||!Number.isFinite(anchor.value)||!calibration?.valid||!Number.isFinite(calibration.factor))return null;
  return anchor.value*calibration.factor;
}
