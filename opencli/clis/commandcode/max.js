import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
import * as cheerio from 'cheerio';

const URL = 'https://commandcode.ai/docs/plans/max';
const UA = 'Mozilla/5.0 (compatible; OctopusRoleBenchmarks/1.0; +https://github.com/Jhacarreiro/octopus-role-benchmarks)';

function dollars(text) {
  return [...String(text).matchAll(/\$([0-9]+(?:\.[0-9]+)?)/g)].map(m => Number(m[1]));
}
function effectivePrice(text) {
  if (/\bFree\b/i.test(text)) return 0;
  const nums = dollars(text);
  return nums.length ? nums.at(-1) : null;
}
function originalPrice(text) {
  const nums = dollars(text);
  return nums.length > 1 ? nums[0] : (nums[0] ?? null);
}
function cleanName(raw) {
  return String(raw).replace(/FREE$/i, '').replace(/-\d+%$/i, '').trim();
}

export function parseMax(html) {
  const $ = cheerio.load(html);
  const rows = $('[role="row"]').toArray();
  const out = [];
  for (const row of rows.slice(1)) {
    const cells = $(row).children().toArray().map(el => $(el).text().replace(/\s+/g, ' ').trim());
    if (cells.length < 6) continue;
    const rawName = cells[0];
    const rowText = cells.join(' ');
    const discount = rowText.match(/-(\d+)%/);
    out.push({
      name: cleanName(rawName), rawName, context: cells[1],
      inputPerM: effectivePrice(cells[2]), outputPerM: effectivePrice(cells[3]),
      cacheReadPerM: effectivePrice(cells[4]), cacheWritePerM: effectivePrice(cells[5]),
      inputListPerM: originalPrice(cells[2]), outputListPerM: originalPrice(cells[3]),
      cacheReadListPerM: originalPrice(cells[4]), cacheWriteListPerM: originalPrice(cells[5]),
      discountPercent: discount ? Number(discount[1]) : null,
      free: /\bFREE\b/i.test(rawName) || effectivePrice(cells[2]) === 0,
      dataTraining: /\bContributor\b/i.test(rawName),
      offPeakShown: /Off-peak shown/i.test(rowText), sourceUrl: URL
    });
  }
  return out;
}

cli({
  site: 'commandcode', name: 'max',
  description: 'Read the current CommandCode Max catalogue and effective prices',
  access: 'read', example: 'opencli commandcode max -f json', domain: 'commandcode.ai',
  strategy: Strategy.PUBLIC, browser: false,
  columns: ['name','inputPerM','outputPerM','cacheReadPerM','discountPercent','dataTraining'],
  func: async () => {
    const response = await fetch(URL, {headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'}, signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new CommandExecutionError(`CommandCode Max returned HTTP ${response.status}`);
    const rows = parseMax(await response.text());
    if (rows.length < 40) throw new EmptyResultError(`Unexpected CommandCode Max row count: ${rows.length}`);
    return rows;
  }
});
