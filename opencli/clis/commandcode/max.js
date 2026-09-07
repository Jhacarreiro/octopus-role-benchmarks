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
function monthlyLimit(text) {
  if (/\bFree\b/i.test(text)) return 0;
  const nums = dollars(text);
  return nums.length ? nums.at(-1) : null;
}
function billingCategory(max10,max20,free) {
  if (free || (max10===0 && max20===0)) return 'free';
  if (max10===150 && max20===300) return 'standard';
  if (max10===100 && max20===200) return 'premium';
  return null;
}
function cleanName(raw) {
  return String(raw).replace(/FREE$/i, '').replace(/-\d+%$/i, '').trim();
}
function textOf($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}
function normalizeHeader(text) {
  return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildRecord(rawName, context, inputText, outputText, cacheReadText, cacheWriteText, rowText, max10Text='', max20Text='') {
  const discount = rowText.match(/-(\d+)%/);
  const free = /\bFREE\b/i.test(rawName) || effectivePrice(inputText) === 0;
  const max10MonthlyUsageLimitUsd = monthlyLimit(max10Text);
  const max20MonthlyUsageLimitUsd = monthlyLimit(max20Text);
  return {
    name: cleanName(rawName),
    rawName,
    context,
    inputPerM: effectivePrice(inputText),
    outputPerM: effectivePrice(outputText),
    cacheReadPerM: effectivePrice(cacheReadText),
    cacheWritePerM: effectivePrice(cacheWriteText),
    inputListPerM: originalPrice(inputText),
    outputListPerM: originalPrice(outputText),
    cacheReadListPerM: originalPrice(cacheReadText),
    cacheWriteListPerM: originalPrice(cacheWriteText),
    discountPercent: discount ? Number(discount[1]) : null,
    free,
    billingCategory: billingCategory(max10MonthlyUsageLimitUsd,max20MonthlyUsageLimitUsd,free),
    max10MonthlyUsageLimitUsd,
    max20MonthlyUsageLimitUsd,
    dataTraining: /\bContributor\b/i.test(rawName),
    offPeakShown: /Off-peak shown/i.test(rowText),
    sourceUrl: URL
  };
}

export function parseMax(html) {
  const $ = cheerio.load(html);
  const requiredHeaders = ['model', 'input', 'output', 'cache read', 'cache write', 'max 10× credits', 'max 20× credits'];
  const table = $('table').toArray().find(el => {
    const headers = $(el).find('thead th').toArray().map(th => normalizeHeader(textOf($, th)));
    return requiredHeaders.every(header => headers.includes(header));
  });
  if (!table) throw new EmptyResultError('CommandCode Max model table with monthly credit columns not found');

  const headers = $(table).find('thead th').toArray().map(th => normalizeHeader(textOf($, th)));
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const out = [];
  for (const row of $(table).find('tbody tr').toArray()) {
    const cells = $(row).find('td').toArray().map(el => textOf($, el));
    const rawName = cells[index.model];
    if (!rawName) continue;
    const inputText = cells[index.input] ?? '';
    const outputText = cells[index.output] ?? '';
    const cacheReadText = cells[index['cache read']] ?? '';
    const cacheWriteText = cells[index['cache write']] ?? '';
    const max10Text = cells[index['max 10× credits']] ?? '';
    const max20Text = cells[index['max 20× credits']] ?? '';
    out.push(buildRecord(rawName,null,inputText,outputText,cacheReadText,cacheWriteText,cells.join(' '),max10Text,max20Text));
  }
  return out;
}

cli({
  site: 'commandcode', name: 'max',
  description: 'Read the current CommandCode Max catalogue, effective prices, and billing categories',
  access: 'read', example: 'opencli commandcode max -f json', domain: 'commandcode.ai',
  strategy: Strategy.PUBLIC, browser: false,
  columns: ['name','inputPerM','outputPerM','cacheReadPerM','discountPercent','billingCategory','max10MonthlyUsageLimitUsd','max20MonthlyUsageLimitUsd'],
  func: async () => {
    const response = await fetch(URL, {headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'}, signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new CommandExecutionError(`CommandCode Max returned HTTP ${response.status}`);
    const rows = parseMax(await response.text());
    if (rows.length < 40) throw new EmptyResultError(`Unexpected CommandCode Max row count: ${rows.length}`);
    const unknown=rows.filter(r=>!r.billingCategory);
    if(unknown.length)throw new EmptyResultError(`Unknown Max billing category for: ${unknown.map(x=>x.name).join(', ')}`);
    return rows;
  }
});
