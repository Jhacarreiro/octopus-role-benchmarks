// Explicit analogies, not AA measurements or statistically calibrated predictions.
const finite=Number.isFinite;
const clamp=n=>Math.max(0,Math.min(100,n));
const round=n=>Math.round(n*1e6)/1e6;
export function validateApproximationPolicy(policy,roles){
  if(!policy?.enabled)return;
  if(policy.maxSeatsPerPortfolio!==1||policy.method!=='anchor-envelope-v1')throw new Error('Invalid conservative approximation policy');
  const names=new Set();
  for(const recipe of policy.recipes){
    if(names.has(recipe.model)||!recipe.sources?.length||recipe.sources.some(s=>!/^https:\/\//.test(s.url))||!recipe.anchors?.length||!recipe.roles?.length||recipe.roles.some(r=>r==='security-reviewer'||!roles.some(x=>x.id===r)))throw new Error('Invalid approximation evidence or role');
    names.add(recipe.model);
    const minimum=recipe.kind==='serving-variant'?5:recipe.kind==='related-architecture'?15:20;
    if(!finite(recipe.margin)||recipe.margin<minimum||recipe.margin>100||!/^\d{4}-\d{2}-\d{2}$/.test(recipe.reviewAfter))throw new Error('Insufficient approximation margin or review date');
    if(recipe.targetSlug&&(!recipe.requiredObserved?.length||recipe.requiredObserved.length<2))throw new Error('Partial AA analogies require observed target evidence');
  }
}
export function applyRoleApproximations(models,policy,generatedAt,roles=[]){
  if(!policy?.enabled)return models;
  for(const m of models){
    const recipe=policy.recipes.find(r=>r.model===m.name);
    // An AA/source extraction failure must never silently become a proxy.
    if(!recipe||m.generationEligibility?.eligible===false)continue;
    const partial=!!recipe.targetSlug;
    if(partial){
      if(m.aaModel?.slug!==recipe.targetSlug||m.mapping?.slug!==recipe.targetSlug||recipe.requiredObserved.some(key=>!finite(m.benchmarks[key])||m.benchmarkProvenance[key]?.measurementKind!=='observed'))continue;
    }else if(m.aaModel||m.mapping?.slug)continue;
    if(generatedAt.slice(0,10)>recipe.reviewAfter){m.approximationUnavailableReason='Evidence review expired';continue;}
    const anchors=recipe.anchors.map(slug=>models.find(a=>a.aaModel?.slug===slug&&!a.approximation&&a.generationEligibility?.eligible!==false));
    if(anchors.some(a=>!a)) {m.approximationUnavailableReason='An observed anchor is unavailable or historical';continue;}
    const intel=anchors.map(a=>a.aaModel.intelligenceIndex);
    const completeIntelligence=intel.every(finite);
    const lower=completeIntelligence?round(clamp(Math.min(...intel)-recipe.margin)):null;
    m.approximation={status:'estimated',method:policy.method,kind:recipe.kind,anchors:recipe.anchors,evidenceIds:[...(partial?['aa:'+m.aaModel.slug]:[]),...recipe.anchors.map(s=>'aa:'+s)],...(recipe.evidenceFamilies?{evidenceFamilies:recipe.evidenceFamilies}:{}),margin:recipe.margin,sources:recipe.sources,reviewAfter:recipe.reviewAfter,scope:recipe.roles,reason:recipe.reason,portfolioAllowed:true,intelligence:{status:completeIntelligence?'estimated':'unavailable',referenceVersion:'5.0',estimate:completeIntelligence?round(Math.min(...intel)):null,cutoffLowerBound:lower,reason:completeIntelligence?'Minimum observed anchor Intelligence minus policy margin; heuristic, not a confidence bound':'All anchor Intelligence observations must be available; no residual estimator or cross-version substitution'}};
    for(const role of recipe.roles){
      const scores=anchors.map(a=>a.roleScores[role]);
      if(scores.some(s=>s?.completeness!=='complete'||!finite(s.rankingQuality)))continue;
      if(partial){
        if(m.roleScores[role]?.completeness==='complete')continue;
        const spec=roles.find(r=>r.id===role);if(!spec?.weights)continue;
        let central=0,low=0,high=0;const observed=[],estimated={};
        for(const [key,weight]of Object.entries(spec.weights)){
          if(finite(m.benchmarks[key])){central+=weight*m.benchmarks[key];low+=weight*m.benchmarks[key];high+=weight*m.benchmarks[key];observed.push(key);}
          else{
            const values=anchors.map(a=>a.benchmarks[key]);if(values.some(v=>!finite(v)))throw new Error('Incomplete analogue component');
            const reference=Math.min(...values),lowerValue=clamp(reference-recipe.margin),upperValue=clamp(Math.max(...values)+recipe.margin);
            central+=weight*reference;low+=weight*lowerValue;high+=weight*upperValue;
            estimated[key]={reference,lower:lowerValue,upper:upperValue,weight};
          }
        }
        if(!observed.length)continue;
        const measurement=m.roleScores[role];
        m.roleScores[role]={status:'estimated',completeness:'estimated',measurementKind:'estimated',score:round(central),rankingQuality:round(low),rankingValue:null,coverageWeight:measurement.coverageWeight,missingComponents:Object.keys(estimated),scoreRange:{lower:round(low),upper:round(high)},observedRole:structuredClone(measurement),provenance:{method:'observed-plus-anchor-envelope-v1',anchors:recipe.anchors,sources:recipe.sources,margin:recipe.margin,observedComponents:observed,estimatedComponents:estimated,interpretation:'Observed contributions are preserved exactly; only missing contributions use heuristic anchor values. No raw benchmark is imputed and the range is not a confidence interval.'}};
        continue;
      }
      const values=scores.map(s=>s.rankingQuality),central=round(Math.min(...values));
      const range={lower:round(clamp(central-recipe.margin)),upper:round(clamp(Math.max(...values)+recipe.margin))};
      m.roleScores[role]={status:'estimated',completeness:'estimated',measurementKind:'estimated',score:central,rankingQuality:range.lower,rankingValue:null,scoreRange:range,missingComponents:[],provenance:{method:policy.method,anchors:recipe.anchors,sources:recipe.sources,margin:recipe.margin,interpretation:'Heuristic role analogy. Ranking uses the lower policy value. No raw benchmark is imputed; range is not a confidence interval.'}};
    }
    if(Object.values(m.roleScores).some(s=>s.status==='estimated')){m.mapping.status=partial?'partial_approximated':'approximated';m.mapping.reason=recipe.reason;}
    else {delete m.approximation;m.approximationUnavailableReason='No complete observed anchor role';}
  }
  return models;
}
export function portfolioIntelligence(m){
  if(!m.aaModel?.estimated&&finite(m.aaModel?.intelligenceIndex))return m.aaModel.intelligenceIndex;
  if(m.approximation)return m.approximation.portfolioAllowed===true&&m.approximation.intelligence.status==='estimated'?m.approximation.intelligence.cutoffLowerBound:NaN;
  const n=m.aaModel?.estimated?m.aaModel.cutoffLowerBound:m.aaModel?.intelligenceIndex;
  return finite(n)?n:NaN;
}
export function portfolioRoleQuality(m,role){
  const s=m.roleScores?.[role];
  if(s?.completeness==='estimated')return m.approximation?.portfolioAllowed===true&&m.approximation.scope.includes(role)&&role!=='security-reviewer'&&s.measurementKind==='estimated'&&s.rankingQuality===s.scoreRange?.lower?s.rankingQuality:NaN;
  return s?.completeness&&s.completeness!=='complete'?NaN:finite(s?.rankingQuality)?s.rankingQuality:NaN;
}
export const approximationSeats=assign=>[...assign].filter(([role,m])=>m.roleScores?.[role]?.status==='estimated'||m.approximation&&!finite(m.aaModel?.intelligenceIndex)).length;
export function independentEvidence(a,b){
  const ids=m=>m.approximation?.evidenceIds??[m.aaModel?.slug?'aa:'+m.aaModel.slug:'model:'+m.name];
  const family=m=>/^Claude\b/.test(m.name)?'Claude':/^GPT-/.test(m.name)?'GPT':/^Gemini\b/.test(m.name)?'Gemini':null;
  if(a.approximation?.evidenceFamilies?.includes(family(b))||b.approximation?.evidenceFamilies?.includes(family(a)))return false;
  return !ids(a).some(id=>ids(b).includes(id));
}
