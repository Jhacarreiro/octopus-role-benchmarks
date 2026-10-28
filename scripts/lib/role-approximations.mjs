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
  }
}
export function applyRoleApproximations(models,policy,generatedAt){
  if(!policy?.enabled)return models;
  for(const m of models){
    const recipe=policy.recipes.find(r=>r.model===m.name);
    // An AA/source extraction failure must never silently become a proxy.
    if(!recipe||m.aaModel||m.mapping?.slug||m.generationEligibility?.eligible===false)continue;
    if(generatedAt.slice(0,10)>recipe.reviewAfter){m.approximationUnavailableReason='Evidence review expired';continue;}
    const anchors=recipe.anchors.map(slug=>models.find(a=>a.aaModel?.slug===slug&&!a.approximation&&a.generationEligibility?.eligible!==false));
    if(anchors.some(a=>!a)) {m.approximationUnavailableReason='An observed anchor is unavailable or historical';continue;}
    const intel=anchors.map(a=>a.aaModel.intelligenceIndex);
    const completeIntelligence=intel.every(finite);
    const lower=completeIntelligence?round(clamp(Math.min(...intel)-recipe.margin)):null;
    m.approximation={status:'estimated',method:policy.method,kind:recipe.kind,anchors:recipe.anchors,evidenceIds:recipe.anchors.map(s=>'aa:'+s),margin:recipe.margin,sources:recipe.sources,reviewAfter:recipe.reviewAfter,scope:recipe.roles,reason:recipe.reason,portfolioAllowed:true,intelligence:{status:completeIntelligence?'estimated':'unavailable',referenceVersion:'5.0',estimate:completeIntelligence?round(Math.min(...intel)):null,cutoffLowerBound:lower,reason:completeIntelligence?'Minimum observed anchor Intelligence minus policy margin; heuristic, not a confidence bound':'All anchor Intelligence observations must be available; no residual estimator or cross-version substitution'}};
    for(const role of recipe.roles){
      const scores=anchors.map(a=>a.roleScores[role]);
      if(scores.some(s=>s?.completeness!=='complete'||!finite(s.rankingQuality)))continue;
      const values=scores.map(s=>s.rankingQuality),central=round(Math.min(...values));
      const range={lower:round(clamp(central-recipe.margin)),upper:round(clamp(Math.max(...values)+recipe.margin))};
      m.roleScores[role]={status:'estimated',completeness:'estimated',measurementKind:'estimated',score:central,rankingQuality:range.lower,rankingValue:null,scoreRange:range,missingComponents:[],provenance:{method:policy.method,anchors:recipe.anchors,sources:recipe.sources,margin:recipe.margin,interpretation:'Heuristic role analogy. Ranking uses the lower policy value. No raw benchmark is imputed; range is not a confidence interval.'}};
    }
    if(Object.values(m.roleScores).some(s=>s.status==='estimated')){m.mapping.status='approximated';m.mapping.reason=recipe.reason;}
    else {delete m.approximation;m.approximationUnavailableReason='No complete observed anchor role';}
  }
  return models;
}
export function portfolioIntelligence(m){
  if(m.approximation)return m.approximation.portfolioAllowed===true&&m.approximation.intelligence.status==='estimated'?m.approximation.intelligence.cutoffLowerBound:NaN;
  const n=m.aaModel?.estimated?m.aaModel.cutoffLowerBound:m.aaModel?.intelligenceIndex;
  return finite(n)?n:NaN;
}
export function portfolioRoleQuality(m,role){
  const s=m.roleScores?.[role];
  if(s?.completeness==='estimated')return m.approximation?.portfolioAllowed===true&&m.approximation.scope.includes(role)&&role!=='security-reviewer'&&s.measurementKind==='estimated'&&s.rankingQuality===s.scoreRange?.lower?s.rankingQuality:NaN;
  return s?.completeness&&s.completeness!=='complete'?NaN:finite(s?.rankingQuality)?s.rankingQuality:NaN;
}
export const approximationSeats=assign=>[...assign.values()].filter(m=>m.approximation).length;
export function independentEvidence(a,b){
  const ids=m=>m.approximation?.evidenceIds??[m.aaModel?.slug?'aa:'+m.aaModel.slug:'model:'+m.name];
  return !ids(a).some(id=>ids(b).includes(id));
}
