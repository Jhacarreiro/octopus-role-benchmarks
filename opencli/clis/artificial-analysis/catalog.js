import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const URL = 'https://artificialanalysis.ai/sitemap.xml';
const UA = 'Mozilla/5.0 (compatible; OctopusRoleBenchmarks/1.0; +https://github.com/Jhacarreiro/octopus-role-benchmarks)';

export function parseCatalog(xml) {
  const seen = new Set();
  const rows = [];
  for (const m of xml.matchAll(/<loc>(https:\/\/artificialanalysis\.ai\/models\/([^<\/]+)\/?)<\/loc>/g)) {
    const [, url, slug] = m;
    if (seen.has(slug)) continue;
    seen.add(slug);
    rows.push({slug, url});
  }
  return rows.sort((a,b)=>a.slug.localeCompare(b.slug));
}

cli({
  site:'artificial-analysis', name:'catalog',
  description:'List canonical Artificial Analysis model slugs from the public sitemap',
  access:'read', example:'opencli artificial-analysis catalog -f json', domain:'artificialanalysis.ai',
  strategy:Strategy.PUBLIC, browser:false, columns:['slug','url'],
  func:async()=>{
    const response=await fetch(URL,{headers:{'User-Agent':UA,'Accept':'application/xml,text/xml'},signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new CommandExecutionError(`Artificial Analysis sitemap returned HTTP ${response.status}`);
    const rows=parseCatalog(await response.text());
    if(rows.length<100) throw new EmptyResultError(`Unexpected AA model catalogue size: ${rows.length}`);
    return rows;
  }
});
