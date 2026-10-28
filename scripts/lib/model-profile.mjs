// Complete a model profile with explicit, conservative role analogies. The
// anchor set contains measured profiles only; predictions never train others.
const finite=Number.isFinite;
const clamp=n=>Math.max(0,Math.min(100,n));
const round=n=>Math.round(n*1e6)/1e6;
const available=s=>['valid','estimated'].includes(s?.status)&&finite(s.rankingQuality);

export function applyModelProfiles(models,config,generatedAt){
  const policy=config.profileCompletion;
  if(!policy?.enabled)return models;
  const roles=config.roles,keys=Object.keys(config.benchmarks).filter(k=>!config.benchmarks[k].experimental&&k!=='cyberIndex');
  const anchors=[...new Map(models.filter(m=>m.generationEligibility?.eligible!==false&&m.aaModel&&roles.every(r=>m.roleScores[r.id]?.status==='valid')).map(m=>[m.aaModel.slug,m])).values()].sort((a,b)=>a.aaModel.slug.localeCompare(b.aaModel.slug));
  for(const m of models){
    const active=m.generationEligibility?.eligible!==false;
    let missing=roles.filter(r=>!available(m.roleScores[r.id])).map(r=>r.id);
    if(active&&missing.length&&(m.aaModel||m.approximation)){
      // External targets must first pass their reviewed evidence recipe. Their
      // observed reference models supply a profile, never fabricated raw data.
      const seeds=m.aaModel?[m]:m.approximation.anchors.map(slug=>models.find(a=>a.aaModel?.slug===slug));
      const features=Object.fromEntries(keys.flatMap(k=>{
        const values=seeds.map(a=>a?.benchmarks[k]);
        return values.length&&values.every(finite)?[[k,Math.min(...values)]]:[];
      }));
      const candidates=anchors.filter(a=>a.aaModel.slug!==m.aaModel?.slug).flatMap(a=>{
        const shared=Object.keys(features).filter(k=>finite(a.benchmarks[k]));
        if(shared.length<policy.minSharedBenchmarks)return [];
        const distance=shared.reduce((sum,k)=>sum+Math.abs(features[k]-a.benchmarks[k]),0)/shared.length;
        return [{model:a,shared,distance:round(distance)}];
      }).sort((a,b)=>a.distance-b.distance||a.model.aaModel.slug.localeCompare(b.model.aaModel.slug)).slice(0,policy.maxAnchors);
      if(candidates.length>=policy.minAnchors){
        const sources=candidates.map(a=>({url:a.model.benchmarkProvenance.briefcase.sourceUrl,summary:'Observed complete eight-role anchor; scores are not claims about the target.',capturedAt:generatedAt.slice(0,10)}));
        const anchorIds=candidates.map(a=>a.model.aaModel.slug);
        const expires=new Date(Date.parse(generatedAt)+policy.reviewDays*86400000).toISOString().slice(0,10);
        if(!m.approximation)m.approximation={status:'estimated',method:'observed-profile-envelope-v1',kind:'partial-observed-profile',anchors:[],evidenceIds:['aa:'+m.aaModel.slug],margin:policy.margin,sources:[],reviewAfter:expires,scope:[],reason:'Missing role contributions use a conservative envelope of nearby, fully measured profiles. Cross-role transfer is heuristic.',portfolioAllowed:true,intelligence:{status:'unavailable',referenceVersion:'5.0',estimate:null,cutoffLowerBound:null,reason:'Role completion does not estimate Intelligence. Observed target Intelligence remains authoritative.'}};
        const p=m.approximation;
        p.profileCompletion={method:'observed-profile-envelope-v1',features,seedIdentities:seeds.map(a=>a.aaModel.slug),anchors:candidates.map(a=>({slug:a.model.aaModel.slug,distance:a.distance,sharedBenchmarks:a.shared})),scope:missing,margin:policy.margin,securityMargin:policy.securityMargin,externalMargin:policy.externalMargin,interpretation:'Measured-profile similarity is an analogy, not validation of cross-domain transfer or a calibrated confidence interval.'};
        // Keep a reviewed recipe's original anchors, including the provenance
        // of its Intelligence policy value. Completion has its own anchor list.
        if(!p.anchors.length)p.anchors=anchorIds;
        p.evidenceIds=[...new Set([...p.evidenceIds,...anchorIds.map(s=>'aa:'+s)])];
        p.sources=[...new Map([...p.sources,...sources].map(s=>[s.url,s])).values()];
        p.scope=[...new Set([...p.scope,...missing])];
        for(const id of missing){
          const role=roles.find(r=>r.id===id),weights=role.weights??{[role.externalBenchmark]:1};
          const original=m.roleScores[id]??{status:'partial',completeness:'unavailable',coverageWeight:0,missingComponents:Object.keys(weights),score:null,rankingQuality:null,rankingValue:null,scoreRange:{lower:0,upper:100}};
          const margin=Math.max(m.aaModel?policy.margin:policy.externalMargin,id==='security-reviewer'?policy.securityMargin:0);
          let central=0,lower=0,upper=0;const observed=[],estimated={};
          for(const [key,weight]of Object.entries(weights)){
            if(finite(m.benchmarks[key])){const value=m.benchmarks[key];central+=weight*value;lower+=weight*value;upper+=weight*value;observed.push(key);continue;}
            const values=candidates.map(a=>a.model.benchmarks[key]);
            const reference=Math.min(...values),lo=clamp(reference-margin),hi=clamp(Math.max(...values)+margin);
            central+=weight*reference;lower+=weight*lo;upper+=weight*hi;
            estimated[key]={reference,lower:lo,upper:hi,weight};
          }
          m.roleScores[id]={status:'estimated',completeness:'estimated',measurementKind:'estimated',score:round(central),rankingQuality:round(lower),rankingValue:null,coverageWeight:original.coverageWeight,missingComponents:Object.keys(estimated),scoreRange:{lower:round(lower),upper:round(upper)},observedRole:structuredClone(original),provenance:{method:'observed-profile-envelope-v1',anchors:anchorIds,sources,margin,observedComponents:observed,estimatedComponents:estimated,interpretation:'Observed contributions remain exact. Missing contributions use the minimum measured anchor minus a policy haircut for ranking; bounds are heuristic. Security is an estimated role score, never a measured Cyber Index.'}};
        }
        m.mapping.status=m.aaModel?'partial_approximated':'approximated';
      }
    }
    missing=roles.filter(r=>!available(m.roleScores[r.id])).map(r=>r.id);
    const comparable=m.mapping?.identityStatus!=='external_verified_noncomparable';
    m.modelEligibility={eligible:active&&comparable&&!missing.length,policy:'all-eight-roles-v1',missingRoles:missing,reason:!active?'Historical generation':!comparable?'Decision model; not comparable to the eight-role evaluation':missing.length?(m.approximationUnavailableReason??m.sourceUnavailableReason??'Insufficient measured evidence to complete the eight-role profile'):null};
  }
  return models;
}
