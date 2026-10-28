import {applyBalancedScores} from './balanced-score.mjs';
import {planEconomics,planAdjustedTaskCost} from './plan-economics.mjs';
import {applyRoleApproximations,validateApproximationPolicy} from './role-approximations.mjs';
import {generationWindows,generationEligibility} from './generation-window.mjs';

const finite=Number.isFinite;
const round=(n,d=6)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
export function normalizeObservation(raw,spec){
  if(raw==null)return null;
  if(!finite(raw))throw new Error(`Non-numeric ${spec.label} observation`);
  const [min,max]=spec.rawRange;
  if(raw<min||raw>max)throw new Error(`Out-of-scale ${spec.label} observation`);
  if(spec.normalization==='raw-comparator')return raw;
  if(spec.normalization==='briefcase-elo-v1.1')return round(100*Math.max(0,Math.min(1,(raw-500)/2000)));
  return round(raw*(spec.multiplier??100)+(spec.offset??0));
}
export function scoreRole(role,benchmarks){
  const weights=role.externalBenchmark?{[role.externalBenchmark]:1}:role.weights;
  let lower=0,coverage=0;const missing=[];
  for(const [key,weight]of Object.entries(weights)){
    if(!finite(benchmarks[key]))missing.push(key);
    else {lower+=weight*benchmarks[key];coverage+=weight;}
  }
  const complete=missing.length===0;
  return {status:complete?'valid':'partial',completeness:complete?'complete':coverage?'partial':'unavailable',score:complete?round(lower):null,rankingQuality:complete?round(lower):null,rankingValue:null,coverageWeight:round(coverage),missingComponents:missing,scoreRange:{lower:round(lower),upper:round(lower+100*(1-coverage))}};
}
export function validateRoleConfig(config){
  if(config.schemaVersion!==10||config.roles?.length!==8)throw new Error('Expected eight v10 roles');
  if(config.intelligenceEstimator?.enabled!==false||config.ranking?.codingAgentWeight!==0)throw new Error('v10 estimators and CAI overlay must remain disabled');
  validateApproximationPolicy(config.approximations,config.roles);
  for(const r of config.roles){
    const weights=r.externalBenchmark?{[r.externalBenchmark]:1}:r.weights;
    if(!weights||Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)>1e-9||Object.values(weights).some(w=>!finite(w)||w<=0))throw new Error(`Invalid weights for ${r.id}`);
    for(const key of Object.keys(weights))if(!config.benchmarks[key])throw new Error(`Unknown benchmark ${key}`);
  }
}
export function buildRoleSnapshot({offers,observations,config,policy,generatedAt,rawOfferCount=offers.length,frozenCosts=null}){
  validateRoleConfig(config);
  const sources=new Map();
  for(const row of observations){if(sources.has(row.slug))throw new Error(`Duplicate AA identity ${row.slug}`);sources.set(row.slug,row);}
  if(!observations.length||observations.every(r=>r.sourceUnavailableReason))throw new Error('Global AA extraction failure');
  const economics=planEconomics(policy),profile=config.costBasis.normalizedTask.referenceTokenProfile;
  const freeNames=new Set(offers.filter(o=>o.free).map(o=>o.name));
  const retained=offers.filter(o=>o.free||!freeNames.has(o.name));
  const windows=config.generationPolicy?.enabled?generationWindows(retained,config.generationPolicy):null;
  const validationIssues=[];
  const models=retained.map(offer=>{
    const mapping={...offer.mapping};
    const generation=windows?generationEligibility(offer,windows,config.generationPolicy):null;
    const source=mapping.slug?sources.get(mapping.slug):null;
    const m={...offer,mapping,aaModel:source&&!source.sourceUnavailableReason?{slug:source.slug,id:source.id,variantName:source.name,release:source.release,effort:source.effort,intelligenceIndex:null,intelligenceIndexVersion:null}:null,benchmarks:{},benchmarkProvenance:{},roleScores:{},experimentalBenchmarks:{},diagnostics:{codingAgent:source?.codingAgentObserved?.status==='observed'?source.codingAgentObserved:null},taskEfficiency:null,caiStar:null,codingAgent:null};
    if(generation)m.generationEligibility=generation;
    if(!source||source.sourceUnavailableReason){
      m.mapping.status=mapping.status==='outdated_unscored'?'outdated_unscored':mapping.slug?'source_incomplete':'unscored';
      if(generation?.eligible!==false)validationIssues.push({targetModel:m.name,benchmark:'identity',status:'unavailable',reason:source?.sourceUnavailableReason??mapping.reason??'No verified AA identity'});return m;
    }
    if(!source.id||source.slug!==mapping.slug)throw new Error(`Unverified source identity for ${m.name}`);
    for(const [key,spec]of Object.entries(config.benchmarks)){
      const raw=source[spec.sourceField]??null,value=normalizeObservation(raw,spec);
      const provenance={status:value==null?'unavailable':spec.lifecycle==='legacy'?'legacy':'observed',measurementKind:value==null?'unavailable':'observed',lifecycle:spec.lifecycle,metricVersion:spec.version,implementation:spec.implementation,rawValue:raw,rawScale:spec.rawRange,normalization:spec.normalization??'linear',sourceField:spec.sourceField,sourceUrl:spec.external?spec.sourceUrl:source.sourceUrl,modelUuid:source.id,effort:source.effort,capturedAt:generatedAt,evaluatedAt:null};
      if(spec.experimental){m.experimentalBenchmarks[key]={value,provenance};continue;}
      if(value!=null)m.benchmarks[key]=value;
      m.benchmarkProvenance[key]=provenance;
    }
    const validIntelligence=finite(source.intelligenceIndex)&&source.intelligenceIndexVersion==='5.0'&&source.intelligenceIndexIsEstimated===false;
    if(validIntelligence){if(source.intelligenceIndex<0||source.intelligenceIndex>100)throw new Error(`Invalid Intelligence scale for ${source.slug}`);m.aaModel.intelligenceIndex=source.intelligenceIndex;m.aaModel.intelligenceIndexVersion='5.0';}
    m.benchmarkProvenance.intelligenceIndex={status:validIntelligence?'observed':'unavailable',metricVersion:'5.0',sourceUrl:source.sourceUrl,reason:validIntelligence?null:'Observed v5 Intelligence required; all intelligence estimators disabled'};
    if(!validIntelligence&&generation?.eligible!==false)validationIssues.push({targetSlug:source.slug,benchmark:'intelligenceIndex',status:'unavailable',reason:m.benchmarkProvenance.intelligenceIndex.reason});
    for(const role of config.roles){
      const score=scoreRole(role,m.benchmarks);m.roleScores[role.id]=score;
      if(score.status!=='valid'&&generation?.eligible!==false)validationIssues.push({targetSlug:source.slug,benchmark:role.id,status:score.completeness,missingComponents:score.missingComponents,reason:'Incomplete role; complete roles remain independently scoreable'});
    }
    const frozen=frozenCosts?.[m.name];
    if(frozen){m.taskEfficiency=structuredClone(frozen);}
    else{
      if(!finite(m.inputPerM)||!finite(m.outputPerM)||m.inputPerM<0||m.outputPerM<0)throw new Error(`Invalid task pricing for ${m.name}`);
      const burn=round((profile.nonCacheInput*m.inputPerM+profile.cacheRead*(m.cacheReadPerM??m.inputPerM)+profile.cacheWrite*(m.cacheWritePerM??m.inputPerM)+profile.output*m.outputPerM)/1e6);
      m.taskEfficiency={commandCodeCostPerTaskUsd:burn,planAdjustedCostPerTaskUsd:round(planAdjustedTaskCost(burn,m,economics)),costBasis:'normalized_reference_v1',costTokenProfile:profile,normalizedTokenProfile:profile,observedTaskTokenProfile:null};
    }
    m.mapping.status=Object.values(m.roleScores).every(s=>s.status==='valid')?'exact':Object.values(m.roleScores).some(s=>s.status==='valid')?'partial_scored':'source_incomplete';
    return m;
  });
  applyRoleApproximations(models,config.approximations,generatedAt);
  for(const m of models.filter(m=>m.approximation)){
    const burn=round((profile.nonCacheInput*m.inputPerM+profile.cacheRead*(m.cacheReadPerM??m.inputPerM)+profile.cacheWrite*(m.cacheWritePerM??m.inputPerM)+profile.output*m.outputPerM)/1e6);
    if(!finite(burn)||burn<0)throw new Error('Invalid approximation pricing');
    m.taskEfficiency=frozenCosts?.[m.name]?structuredClone(frozenCosts[m.name]):{commandCodeCostPerTaskUsd:burn,planAdjustedCostPerTaskUsd:round(planAdjustedTaskCost(burn,m,economics)),costBasis:'normalized_reference_v1',costTokenProfile:profile,normalizedTokenProfile:profile,observedTaskTokenProfile:null};
  }
  applyBalancedScores(models,config.roles.map(r=>r.id),{qualityWeight:policy.modes.balanced.percentileWeights.quality,costWeight:policy.modes.balanced.percentileWeights.affordability});
  const mapped=models.filter(m=>m.aaModel&&m.generationEligibility?.eligible!==false),unique=(rows)=>new Set(rows.map(m=>m.aaModel.slug)).size;
  const scored=mapped.filter(m=>Object.values(m.roleScores).some(s=>s.status==='valid'));
  const roleCoverage=Object.fromEntries(config.roles.map(r=>{const complete=mapped.filter(m=>m.roleScores[r.id].status==='valid');return[r.id,{total:unique(mapped),present:unique(complete),offers:complete.length,observedIntelligence:unique(complete.filter(m=>finite(m.aaModel.intelligenceIndex))),estimatedOffers:models.filter(m=>m.approximation&&m.roleScores[r.id]?.status==='estimated').length}];}));
  const coverage=Object.fromEntries(Object.keys(config.benchmarks).filter(k=>!config.benchmarks[k].experimental).map(k=>[k,{total:unique(mapped),present:unique(mapped.filter(m=>finite(m.benchmarks[k]))),missing:[...new Set(mapped.filter(m=>!finite(m.benchmarks[k])).map(m=>m.aaModel.slug))]}]));
  for(const c of Object.values(coverage))c.ratio=c.total?c.present/c.total:0;
  return {schemaVersion:7,methodologyVersion:10,date:generatedAt.slice(0,10),generatedAt,benchmarkGeneratedAt:generatedAt,benchmarkDate:generatedAt.slice(0,10),lineupInputsRefreshedAt:generatedAt,validationStatus:validationIssues.length?'partial':'valid',validationIssues,coveragePolicy:1,coverageScope:'per-role',intelligenceEstimator:{enabled:false},generationPolicy:config.generationPolicy,approximationPolicy:config.approximations?.enabled?{enabled:true,method:config.approximations.method,maxSeatsPerPortfolio:1}: {enabled:false},costBasis:{id:frozenCosts?'frozen-comparison':'normalized_reference_v1'},benchmarks:config.benchmarks,roles:config.roles,models,roleCoverage,coverage,
    sources:{commandCodeMax:{rows:rawOfferCount,url:'https://commandcode.ai/docs/plans/max'},artificialAnalysis:{parserVersion:3,intelligenceIndexVersion:'5.0',url:'https://artificialanalysis.ai/'}},
    counts:{commandCodeRows:rawOfferCount,retainedRows:models.length,activeRows:models.filter(m=>m.generationEligibility?.eligible!==false).length,historicalRows:models.filter(m=>m.generationEligibility?.eligible===false).length,approximatedRows:models.filter(m=>m.approximation).length,approximationPortfolioCandidates:models.filter(m=>m.approximation?.intelligence.status==='estimated').length,mappedRows:mapped.length,mappedFamilies:unique(mapped),scoredRows:scored.length,scoredFamilies:unique(scored),partialScoredRows:models.filter(m=>m.generationEligibility?.eligible!==false&&m.mapping.status==='partial_scored').length,partialRows:models.filter(m=>m.generationEligibility?.eligible!==false&&m.mapping.status!=='exact').length,sourceIncompleteRows:models.filter(m=>m.generationEligibility?.eligible!==false&&m.mapping.status==='source_incomplete').length,unmatchedRows:models.filter(m=>m.generationEligibility?.eligible!==false&&!m.aaModel).length,unscoredRows:models.filter(m=>m.generationEligibility?.eligible!==false&&!m.aaModel&&!m.approximation).length,unrankedRows:models.filter(m=>m.generationEligibility?.eligible!==false&&!Object.values(m.roleScores).some(s=>Number.isFinite(s.rankingQuality))).length},
    efficiencyCoverage:{total:unique(mapped),present:unique(mapped.filter(m=>m.taskEfficiency)),ratio:1},caiStarCoverage:{total:unique(mapped),present:0,observed:0,estimated:0,historicalCalibrated:0,ratio:0,required:false},caiEstimator:{enabled:false},benchmarkFallbacksApplied:[]};
}
export function validateRoleSnapshot(snapshot,config){
  validateRoleConfig(config);
  if(snapshot.methodologyVersion!==10||snapshot.intelligenceEstimator?.enabled!==false||snapshot.caiEstimator?.enabled!==false)throw new Error('Invalid v10 estimator state');
  const expectedApproximationPolicy=config.approximations?.enabled?{enabled:true,method:config.approximations.method,maxSeatsPerPortfolio:1}:{enabled:false};
  if(JSON.stringify(snapshot.approximationPolicy)!==JSON.stringify(expectedApproximationPolicy))throw new Error('Inconsistent approximation policy');
  const windows=config.generationPolicy?.enabled?generationWindows(snapshot.models,config.generationPolicy):null;
  for(const m of snapshot.models){
    if(windows&&JSON.stringify(m.generationEligibility)!==JSON.stringify(generationEligibility(m,windows,config.generationPolicy)))throw new Error('Invalid catalog generation eligibility');
    if(!m.aaModel){
      if(m.approximation){
        const expected=structuredClone(m);expected.roleScores={};delete expected.approximation;
        applyRoleApproximations([expected,...snapshot.models.filter(a=>a.aaModel)],config.approximations,snapshot.generatedAt);
        if(!expected.approximation||JSON.stringify(expected.approximation)!==JSON.stringify(m.approximation)||Object.keys(m.benchmarks).length||Object.keys(m.benchmarkProvenance).length||m.mapping.slug)throw new Error('Invalid approximation identity or policy');
        const actualRoles=Object.keys(m.roleScores),expectedRoles=Object.keys(expected.roleScores);
        if(actualRoles.length!==expectedRoles.length||actualRoles.some(role=>m.roleScores[role].rankingQuality!==expected.roleScores[role]?.rankingQuality||m.roleScores[role].status!=='estimated'||m.roleScores[role].measurementKind!=='estimated'||JSON.stringify(m.roleScores[role].provenance)!==JSON.stringify(expected.roleScores[role].provenance)||JSON.stringify(m.roleScores[role].scoreRange)!==JSON.stringify(expected.roleScores[role].scoreRange)))throw new Error('Invalid conservative role approximation');
        if(!finite(m.taskEfficiency?.planAdjustedCostPerTaskUsd)||m.taskEfficiency.planAdjustedCostPerTaskUsd<0)throw new Error('Invalid approximation cost');
      }else if(Object.keys(m.roleScores).length)throw new Error('Unmapped score');
      continue;
    }
    if(m.approximation)throw new Error('An observed AA identity cannot also be an approximation');
    if(!finite(m.taskEfficiency?.planAdjustedCostPerTaskUsd)||m.taskEfficiency.planAdjustedCostPerTaskUsd<0||!finite(m.taskEfficiency?.commandCodeCostPerTaskUsd)||m.taskEfficiency.commandCodeCostPerTaskUsd<0)throw new Error(`Invalid cost for ${m.name}`);
    if(m.mapping.slug!==m.aaModel.slug)throw new Error('Snapshot identity mismatch');
    if(m.aaModel.estimated||finite(m.aaModel.intelligenceIndex)&&m.aaModel.intelligenceIndexVersion!=='5.0')throw new Error('Mixed Intelligence versions');
    for(const role of config.roles){
      const expected=scoreRole(role,m.benchmarks),actual=m.roleScores[role.id];
      if(!actual||actual.status!==expected.status||actual.rankingQuality!==expected.rankingQuality)throw new Error(`Incorrect role score ${m.name}/${role.id}`);
      if(actual.status!=='valid'&&(actual.rankingValue!=null||actual.balancedQualityPercentile!=null))throw new Error('Partial role entered percentile ranking');
      for(const key of Object.keys(role.weights??{[role.externalBenchmark]:1}))if(finite(m.benchmarks[key])){
        const p=m.benchmarkProvenance[key];
        if(p?.measurementKind!=='observed'||p.metricVersion!==config.benchmarks[key].version||!p.sourceUrl||p.modelUuid!==m.aaModel.id)throw new Error(`Missing versioned provenance ${m.name}/${key}`);
        if(normalizeObservation(p.rawValue,config.benchmarks[key])!==m.benchmarks[key])throw new Error('Incorrect normalization');
      }
    }
  }
  return true;
}
