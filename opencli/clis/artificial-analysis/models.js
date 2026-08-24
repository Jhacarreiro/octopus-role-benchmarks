import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const BASE = 'https://artificialanalysis.ai/models/';
const UA = 'Mozilla/5.0 (compatible; OctopusRoleBenchmarks/1.0; +https://github.com/Jhacarreiro/octopus-role-benchmarks)';

function numberField(block, field) {
  const i = block.indexOf(field);
  if (i < 0) return null;
  const tail = block.slice(i + field.length, i + field.length + 96);
  const m = tail.match(/:(null|-?[0-9]+(?:\.[0-9]+)?)/);
  return !m || m[1] === 'null' ? null : Number(m[1]);
}
function modelBlock(html, slug) {
  const marker = '\\"slug\\":\\"' + slug + '\\",\\"name\\":';
  const i = html.indexOf(marker);
  return i < 0 ? null : html.slice(i, i + 24000);
}
export function parseModel(html, slug) {
  const block = modelBlock(html, slug);
  if (!block) return null;
  const omni = block.match(/\\"omniscienceBreakdown\\":\{\\"accuracy\\":(null|-?[0-9.]+),\\"hallucinationRate\\":(null|-?[0-9.]+)/);
  const accuracy = !omni || omni[1] === 'null' ? null : Number(omni[1]);
  const hallucination = !omni || omni[2] === 'null' ? null : Number(omni[2]);
  return {
    slug,
    name: slug,
    intelligenceIndex: numberField(block, 'intelligenceIndex'),
    agenticIndex: numberField(block, 'agenticIndex'),
    gdpvalNormalized: numberField(block, 'gdpvalNormalized'),
    tauBanking: numberField(block, 'tauBanking'),
    terminalbenchV21: numberField(block, 'terminalbenchV21'),
    scicode: numberField(block, 'scicode'),
    hle: numberField(block, 'hle'),
    gpqa: numberField(block, 'gpqa'),
    critpt: numberField(block, 'critpt'),
    lcr: numberField(block, 'lcr'),
    omniscience: numberField(block, 'omniscience'),
    omniscienceAccuracy: accuracy,
    omniscienceHallucinationRate: hallucination,
    omniscienceReliability: hallucination == null ? null : 1 - hallucination,
    sourceUrl: BASE + slug
  };
}
async function fetchOne(slug) {
  const response = await fetch(BASE + encodeURIComponent(slug), {
    headers: {'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml'},
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new CommandExecutionError(`AA model ${slug} returned HTTP ${response.status}`);
  const model = parseModel(await response.text(), slug);
  if (!model) throw new EmptyResultError(`AA model state not found for ${slug}`);
  return model;
}
async function pooled(slugs, concurrency = 6) {
  const out = new Array(slugs.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= slugs.length) return;
      out[i] = await fetchOne(slugs[i]);
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, slugs.length)}, () => worker()));
  return out;
}

cli({
  site: 'artificial-analysis', name: 'models',
  description: 'Read benchmark state for one or more canonical Artificial Analysis model slugs',
  access: 'read', example: 'opencli artificial-analysis models "muse-spark-1-2,gpt-5-6-sol" -f json',
  domain: 'artificialanalysis.ai', strategy: Strategy.PUBLIC, browser: false,
  args: [{name:'slugs', positional:true, required:true, help:'Comma-separated AA model slugs'}],
  columns: ['slug','name','intelligenceIndex','gdpvalNormalized','scicode','hle','gpqa','lcr','omniscienceAccuracy','omniscienceReliability'],
  func: async (kwargs) => {
    const slugs = String(kwargs.slugs ?? '').split(',').map(x => x.trim()).filter(Boolean);
    if (!slugs.length) throw new ArgumentError('<slugs> must not be empty');
    if (slugs.length > 100) throw new ArgumentError('Maximum 100 model slugs per call');
    return pooled([...new Set(slugs)]);
  }
});
