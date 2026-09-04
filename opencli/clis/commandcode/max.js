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
function textOf($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}
function normalizeHeader(text) {
  return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildRecord(rawName, context, inputText, outputText, cacheReadText, cacheWriteText, rowText) {
  const discount = rowText.match(/-(\d+)%/);
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
    free: /\bFREE\b/i.test(rawName) || effectivePrice(inputText) === 0,
    dataTraining: /\bContributor\b/i.test(rawName),
    offPeakShown: /Off-peak shown/i.test(rowText),
    sourceUrl: URL
  };
}

export function parseMax(html) {
  const $ = cheerio.load(html);

  // Current CommandCode markup (Aug/Sep 2026): standard HTML table.
  // Identify it by semantic headers so table ordering can change safely.
  const requiredHeaders = ['model', 'input', 'output', 'cache read', 'cache write'];
  const table = $('table').toArray().find(el => {
    const headers = $(el).find('thead th').toArray().map(th => normalizeHeader(textOf($, th)));
    return requiredHeaders.every(header => headers.includes(header));
  });

  if (table) {
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
      const rowText = cells.join(' ');

      out.push(buildRecord(
        rawName,
        null,
        inputText,
        outputText,
        cacheReadText,
        cacheWriteText,
        rowText
      ));
    }
    return out;
  }

  // Legacy CommandCode markup: accessibility rows with a Context column.
  const rows = $('[role="row"]').toArray();
  const out = [];
  for (const row of rows.slice(1)) {
    const cells = $(row).children().toArray().map(el => textOf($, el));
    if (cells.length < 6) continue;
    const rawName = cells[0];
    out.push(buildRecord(
      rawName,
      cells[1],
      cells[2],
      cells[3],
      cells[4],
      cells[5],
      cells.join(' ')
    ));
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
