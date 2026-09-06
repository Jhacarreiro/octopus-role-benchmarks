const FAMILY_RULES = [
  [/^Muse Spark\b/i, () => 'Muse Spark'],
  [/^Claude\b/i, () => 'Claude'],
  [/^GPT-/i, () => 'GPT'],
  [/^Gemini\b/i, () => 'Gemini'],
  [/^Qwen\b/i, () => 'Qwen'],
  [/^GLM[-\s]/i, () => 'GLM'],
  [/^DeepSeek\b/i, () => 'DeepSeek'],
  [/^Tencent\b/i, () => 'Tencent'],
  [/^Kimi\b/i, () => 'Kimi'],
  [/^MiMo\b/i, () => 'MiMo'],
  [/^MiniMax\b/i, () => 'MiniMax'],
  [/^Step\b/i, () => 'Step'],
  [/^Nemotron\b/i, () => 'Nemotron'],
  [/^Grok\b/i, () => 'Grok'],
  [/^Inkling\b/i, () => 'Inkling'],
  [/^Laguna S\b/i, () => 'Laguna S'],
  [/^LongCat\b/i, () => 'LongCat'],
  [/^Fugu\b/i, () => 'Fugu'],
  [/^Ox\b/i, () => 'Ox']
];

const GENERATION_RULES = [
  [/^Muse Spark\s+(\d+(?:\.\d+)?)/i, m => ({series:'Muse Spark', generation:m[1]})],
  [/^Claude\s+(Opus|Sonnet|Haiku|Fable)\s+(\d+(?:\.\d+)?)/i, m => ({series:`Claude ${m[1]}`, generation:m[2]})],
  [/^GPT-(\d+(?:\.\d+)?)/i, m => ({series:'GPT', generation:m[1]})],
  [/^Gemini\s+(\d+(?:\.\d+)?)/i, m => ({series:'Gemini', generation:m[1]})],
  [/^Qwen\s+(\d+(?:\.\d+)?)/i, m => ({series:'Qwen', generation:m[1]})],
  [/^GLM[-\s](\d+(?:\.\d+)?)/i, m => ({series:'GLM', generation:m[1]})],
  [/^DeepSeek\s+V(\d+(?:\.\d+)?)/i, m => ({series:'DeepSeek V', generation:m[1]})],
  [/^Tencent\s+Hy(\d+(?:\.\d+)?)/i, m => ({series:'Tencent Hy', generation:m[1]})],
  [/^Kimi\s+K(\d+(?:\.\d+)?)/i, m => ({series:'Kimi K', generation:m[1]})],
  [/^MiMo\s+V?(\d+(?:\.\d+)?)/i, m => ({series:'MiMo V', generation:m[1]})],
  [/^MiniMax\s+M(\d+(?:\.\d+)?)/i, m => ({series:'MiniMax M', generation:m[1]})],
  [/^Step\s+(\d+(?:\.\d+)?)/i, m => ({series:'Step', generation:m[1]})],
  [/^Nemotron\s+(\d+(?:\.\d+)?)/i, m => ({series:'Nemotron', generation:m[1]})],
  [/^Grok\s+(\d+(?:\.\d+)?)/i, m => ({series:'Grok', generation:m[1]})],
  [/^Laguna S\s+(\d+(?:\.\d+)?)/i, m => ({series:'Laguna S', generation:m[1]})],
  [/^LongCat\s+(\d+(?:\.\d+)?)/i, m => ({series:'LongCat', generation:m[1]})]
];

function versionParts(value){
  return String(value || '').split('.').map(part => Number.parseInt(part, 10)).map(n => Number.isFinite(n) ? n : 0);
}

export function compareGenerationStrings(a,b){
  const aa=versionParts(a), bb=versionParts(b);
  const n=Math.max(aa.length,bb.length);
  for(let i=0;i<n;i++){
    const av=aa[i]??0, bv=bb[i]??0;
    if(av!==bv) return av-bv;
  }
  return 0;
}

export function inferModelFamily(model, policy = {}) {
  const name = String(model?.name || '').trim();
  const overrides = policy.familyOverrides || {};
  if (overrides[name]) return { family: overrides[name], source: 'override', confidence: 'high' };

  for (const [re, format] of FAMILY_RULES) {
    const match = name.match(re);
    if (match) return { family: format(match), source: 'inferred-name', confidence: 'high' };
  }

  if (model?.aaModel?.slug) {
    return { family: `AA:${model.aaModel.slug}`, source: 'aa-identity-fallback', confidence: 'medium' };
  }

  if (name) return { family: name, source: 'exact-name-fallback', confidence: 'low' };
  return { family: null, source: 'missing', confidence: 'low' };
}

export function inferModelGeneration(model) {
  const name = String(model?.name || '').trim();
  for (const [re, format] of GENERATION_RULES) {
    const match = name.match(re);
    if (match) {
      const out = format(match);
      return {...out, source:'inferred-name', confidence:'high'};
    }
  }
  const family = inferModelFamily(model, {});
  return {
    series: family.family || name || null,
    generation: null,
    source: 'unversioned',
    confidence: family.confidence || 'low'
  };
}

export function latestEligibleGenerationForSeries(models, series, {scoredOnly=true} = {}) {
  let latest = null;
  for (const model of models || []) {
    if (scoredOnly && model?.mapping?.status === 'unscored') continue;
    const info = inferModelGeneration(model);
    if (info.series !== series || info.generation == null) continue;
    if (latest == null || compareGenerationStrings(info.generation, latest) > 0) latest = info.generation;
  }
  return latest;
}

export function isLatestGenerationModel(model, models, {scoredOnly=true} = {}) {
  const info = inferModelGeneration(model);
  if (info.generation == null || !info.series) return true;
  const latest = latestEligibleGenerationForSeries(models, info.series, {scoredOnly});
  if (latest == null) return true;
  return compareGenerationStrings(info.generation, latest) === 0;
}

export function modelFamily(model, policy = {}) {
  return inferModelFamily(model, policy).family;
}

export function autoApplyFamilyEligible(model, policy = {}) {
  const inferred = inferModelFamily(model, policy);
  return Boolean(inferred.family) && inferred.confidence !== 'low';
}
