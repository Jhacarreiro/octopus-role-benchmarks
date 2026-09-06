import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchCyberBench, resolveCyberBenchBySlug } from './cyberbench.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opencliHome=path.join(root,'.opencli-home');
const bin=path.join(root,'node_modules','.bin','opencli');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
const cyberConfig=JSON.parse(fs.readFileSync(path.join(root,'config','cyberbench-models.json'),'utf8'));
const snapshotPath=path.join(root,'data','latest.json');
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));

function round(n,d=4){const p=10**d;return Math.round((n+Number.EPSILON)*p)/p}
function runOpenCLI(args){
  const r=spawnSync(bin,args,{cwd:root,env:{...process.env,HOME:opencliHome},encoding:'utf8',maxBuffer:40*1024*1024});
  if(r.status!==0)throw new Error(`opencli ${args.join(' ')} failed\n${r.stderr}\n${r.stdout}`);
  return JSON.parse(r.stdout.trim());
}

const installer=spawnSync(process.execPath,[path.join(root,'scripts','install-opencli-adapters.mjs')],{cwd:root,env:{...process.env,OPENCLI_HOME:opencliHome},encoding:'utf8'});
if(installer.status!==0)throw new Error(installer.stderr||installer.stdout||'Adapter install failed');

const slugs=[...new Set((snapshot.models||[]).map(m=>m.aaModel?.slug).filter(Boolean))].sort();
const aaRows=runOpenCLI(['artificial-analysis','models',slugs.join(','),'-f','json']);
const aaBySlug=new Map(aaRows.map(x=>[x.slug,x]));
if(aaBySlug.size!==slugs.length)throw new Error(`AA Intelligence refresh returned ${aaBySlug.size}/${slugs.length} families`);

const cyber=await fetchCyberBench({url:cyberConfig.sourceUrl});
const resolved=resolveCyberBenchBySlug(slugs,cyberConfig.slugToLabel,cyber);
let intelligenceUpdated=0,securityUpdated=0;
for(const m of snapshot.models||[]){
  const slug=m.aaModel?.slug;
  if(!slug)continue;
  const aa=aaBySlug.get(slug);
  if(Number.isFinite(aa?.intelligenceIndex)){
    m.aaModel.intelligenceIndex=round(aa.intelligenceIndex,4);
    intelligenceUpdated++;
  }else{
    delete m.aaModel.intelligenceIndex;
  }
  const cb=resolved.values.get(slug);
  m.benchmarks=m.benchmarks||{};
  m.benchmarkProvenance=m.benchmarkProvenance||{};
  m.roleScores=m.roleScores||{};
  if(cb && m.mapping?.status!=='source_incomplete'){
    const score=round(cb.value,3);
    m.benchmarks.cyberbench=score;
    m.benchmarkProvenance.cyberbench=cb.provenance;
    const cost=m.taskEfficiency?.commandCodeCostPerTaskUsd;
    m.roleScores['security-reviewer']={score,rankingQuality:score,rankingValue:cost==null||cost===0?null:round(score/cost,3)};
    securityUpdated++;
  }else{
    delete m.benchmarks.cyberbench;
    delete m.benchmarkProvenance.cyberbench;
    delete m.roleScores['security-reviewer'];
  }
}

const now=new Date();
const date=now.toISOString().slice(0,10);
snapshot.schemaVersion=6;
snapshot.methodologyVersion=roles.schemaVersion;
snapshot.date=date;
snapshot.generatedAt=now.toISOString();
snapshot.benchmarks=roles.benchmarks;
snapshot.roles=roles.roles;
snapshot.sources=snapshot.sources||{};
snapshot.sources.cyberbench={url:cyber.sourceUrl,fetchedAt:cyber.fetchedAt,benchmarkUpdatedAt:cyber.benchmarkUpdatedAt,directFamilies:resolved.values.size,missingMappings:resolved.missing};
snapshot.sources.artificialAnalysis={...(snapshot.sources.artificialAnalysis||{}),intelligenceIndexFamilies:intelligenceUpdated};
snapshot.counts={...(snapshot.counts||{}),cyberbenchDirectFamilies:resolved.values.size};

for(const dir of [path.join(root,'data'),path.join(root,'site','data')])fs.mkdirSync(dir,{recursive:true});
const json=JSON.stringify(snapshot,null,2)+'\n';
fs.writeFileSync(path.join(root,'data',`${date}.json`),json);
fs.writeFileSync(path.join(root,'data','latest.json'),json);
fs.writeFileSync(path.join(root,'site','data','latest.json'),json);
console.log(JSON.stringify({date,intelligenceUpdated,securityUpdated,cyberbenchDirectFamilies:resolved.values.size,cyberbenchMissing:resolved.missing.length},null,2));
