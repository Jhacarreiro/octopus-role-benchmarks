import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opencliHome = path.join(root, '.opencli-home');
const bin = path.join(root, 'node_modules', '.bin', 'opencli');
const roles = JSON.parse(fs.readFileSync(path.join(root, 'config', 'roles.json'), 'utf8'));
const aliases = JSON.parse(fs.readFileSync(path.join(root, 'config', 'model-aliases.json'), 'utf8')).aliases;

function runOpenCLI(args) {
  const r = spawnSync(bin, args, {
    cwd: root,
    env: {...process.env, HOME: opencliHome},
    encoding: 'utf8', maxBuffer: 30 * 1024 * 1024
  });
  if (r.status !== 0) throw new Error(`opencli ${args.join(' ')} failed\n${r.stderr}\n${r.stdout}`);
  try { return JSON.parse(r.stdout.trim()); }
  catch (e) { throw new Error(`Invalid JSON from opencli ${args.join(' ')}: ${e.message}\n${r.stdout.slice(0,1200)}`); }
}
function normalize(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+\(latest\)$/,'').replace(/\s+\(exp\)$/,'')
    .replace(/\s+contributor$/,'').replace(/\s+highspeed$/,'').replace(/\s+fast$/,'')
    .replace(/[^a-z0-9]+/g,'');
}
function round(n, d = 4) { const p = 10 ** d; return Math.round((n + Number.EPSILON) * p) / p; }
function scaleBenchmark(key, model) {
  const v = model[roles.benchmarks[key].sourceField];
  return v == null ? null : round(v * 100, 4);
}
function costBases(m) {
  const input = m.inputPerM, output = m.outputPerM;
  return {
    input,
    output,
    blended50: input == null || output == null ? null : round((input + output) / 2, 6)
  };
}

const installer = spawnSync(process.execPath, [path.join(root, 'scripts', 'install-opencli-adapters.mjs')], {
  cwd: root, env: {...process.env, OPENCLI_HOME: opencliHome}, encoding: 'utf8'
});
if (installer.status !== 0) throw new Error(installer.stderr || installer.stdout || 'Adapter install failed');

const maxRows = runOpenCLI(['commandcode', 'max', '-f', 'json']);
const catalog = runOpenCLI(['artificial-analysis', 'catalog', '-f', 'json']);
const byNorm = new Map();
for (const row of catalog) {
  const k = normalize(row.slug), list = byNorm.get(k) || [];
  list.push(row.slug); byNorm.set(k, list);
}

const mapped = maxRows.map(row => {
  const override = aliases[row.name];
  if (override) {
    if (override.status === 'unscored') return {...row, mapping:{status:'unscored', reason:override.reason}};
    return {...row, mapping:{status:override.status, slug:override.slug, reason:override.reason}};
  }
  const candidates = byNorm.get(normalize(row.name)) || [];
  if (candidates.length === 1) return {...row, mapping:{status:'exact', slug:candidates[0], reason:'Unique normalized match to AA canonical slug.'}};
  return {...row, mapping:{status:'unscored', reason:candidates.length ? `Ambiguous AA identity: ${candidates.join(', ')}` : 'No verified AA identity.'}};
});

const slugs = [...new Set(mapped.filter(x => x.mapping.slug).map(x => x.mapping.slug))].sort();
const aaRows = runOpenCLI(['artificial-analysis', 'models', slugs.join(','), '-f', 'json']);
const aa = new Map(aaRows.map(x => [x.slug, x]));
if (aa.size !== slugs.length) throw new Error(`AA returned ${aa.size}/${slugs.length} requested families`);

const activeBenchmarks = [...new Set(roles.roles.flatMap(r => Object.keys(r.weights)))];
const coverage = {};
for (const key of activeBenchmarks) {
  const field = roles.benchmarks[key].sourceField;
  const missing = slugs.filter(slug => aa.get(slug)?.[field] == null);
  coverage[key] = {field, total:slugs.length, present:slugs.length-missing.length, ratio:round((slugs.length-missing.length)/slugs.length, 6), missing};
  if (missing.length) throw new Error(`Coverage failure ${key}/${field}: ${slugs.length-missing.length}/${slugs.length}; missing ${missing.join(', ')}`);
}

const models = mapped.map(row => {
  const source = row.mapping.slug ? aa.get(row.mapping.slug) : null;
  const benchmarks = {};
  if (source) for (const key of activeBenchmarks) benchmarks[key] = scaleBenchmark(key, source);
  const costs = costBases(row);
  const roleScores = {};
  if (source) {
    for (const role of roles.roles) {
      let score = 0;
      for (const [key,w] of Object.entries(role.weights)) score += benchmarks[key] * w;
      score = round(score, 3);
      const value = {};
      for (const [basis,cost] of Object.entries(costs)) value[basis] = cost == null || cost === 0 ? null : round(score / cost, 3);
      roleScores[role.id] = {score, value};
    }
  }
  return {...row, costs, benchmarks, roleScores, aaModel:source ? {slug:source.slug, sourceUrl:source.sourceUrl} : null};
});

const unexpectedUnscored = models.filter(x => !x.aaModel && !aliases[x.name]);
if (unexpectedUnscored.length) throw new Error(`Unexpected unscored models: ${unexpectedUnscored.map(x=>x.name).join(', ')}`);

const now = new Date(), date = now.toISOString().slice(0,10);
const snapshot = {
  schemaVersion: 2, methodologyVersion: roles.schemaVersion, date, generatedAt: now.toISOString(),
  sources: {
    commandCodeMax: {url:'https://commandcode.ai/docs/plans/max', rows:maxRows.length},
    artificialAnalysis: {url:'https://artificialanalysis.ai/', scoredFamilies:slugs.length}
  },
  coveragePolicy: roles.coveragePolicy, coverage,
  counts: {
    commandCodeRows:maxRows.length,
    scoredRows:models.filter(x=>x.aaModel).length,
    unscoredRows:models.filter(x=>!x.aaModel).length,
    scoredFamilies:slugs.length
  },
  benchmarks: roles.benchmarks,
  roles: roles.roles,
  models
};

for (const dir of [path.join(root,'data'), path.join(root,'site','data')]) fs.mkdirSync(dir,{recursive:true});
const json = JSON.stringify(snapshot,null,2)+'\n';
fs.writeFileSync(path.join(root,'data',`${date}.json`), json);
fs.writeFileSync(path.join(root,'data','latest.json'), json);
fs.writeFileSync(path.join(root,'site','data','latest.json'), json);
console.log(JSON.stringify({date,...snapshot.counts,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,`${v.present}/${v.total}`])),unscored:models.filter(x=>!x.aaModel).map(x=>x.name)},null,2));
