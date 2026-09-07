import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchCyberBench, resolveCyberBenchBySlug } from './cyberbench.mjs';
import { planEconomics, planAdjustedTaskCost } from './lib/plan-economics.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opencliHome=path.join(root,'.opencli-home');
const bin=path.join(root,'node_modules','.bin','opencli');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
const lineupPolicy=JSON.parse(fs.readFileSync(path.join(root,'config','lineup-policy.json'),'utf8'));
const economics=planEconomics(lineupPolicy);
const cyberConfig=JSON.parse(fs.readFileSync(path.join(root,'config','cyberbench-models.json'),'utf8'));
const snapshotPath=path.join(root,'data','latest.json');
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));

function round(n,d=4){const p=10**d;return Math.round((n+Number.EPSILON)*p)/p}
function runOpenCLI(args){
  const r=spawnSync(bin,args,{cwd:root,env:{...process.env,HOME:opencliHome},encoding:'utf8',maxBuffer:40*1024*1024});
  if(r.status!==0)throw new Error(`opencli ${args.join(' ')} failed\n${r.stderr}\n${r.stdout}`);
  return JSON.parse(r.stdout.trim());
}
function tokenPriceBases(m){
  const input=m.inputPerM,output=m.outputPerM;
  return {
    input,
    output,
    cacheRead:m.cacheReadPerM??null,
    cacheWrite:m.cacheWritePerM??null,
    blended50:input==null||output==null?null:round((input+output)/2,6)
  };
}
function repriceTask(tokens,row){
  if(!tokens||[tokens.nonCacheInput,tokens.cacheRead,tokens.cacheWrite,tokens.output].some(v=>v==null))return null;
  const input=row.inputPerM,output=row.outputPerM;
  if(input==null||output==null)return null;
  const cacheRead=row.cacheReadPerM??input,cacheWrite=row.cacheWritePerM??input;
  return round((tokens.nonCacheInput*input+tokens.cacheRead*cacheRead+tokens.cacheWrite*cacheWrite+tokens.output*output)/1e6,6);
}

const installer=spawnSync(process.execPath,[path.join(root,'scripts','install-opencli-adapters.mjs')],{cwd:root,env:{...process.env,OPENCLI_HOME:opencliHome},encoding:'utf8'});
if(installer.status!==0)throw new Error(installer.stderr||installer.stdout||'Adapter install failed');

const maxRows=runOpenCLI(['commandcode','max','-f','json']);
const maxByRawName=new Map(maxRows.map(x=>[x.rawName,x]));
let commandCodeUpdated=0;
for(const m of snapshot.models||[]){
  const cc=maxByRawName.get(m.rawName);
  if(!cc)continue;
  m.discountPercent=cc.discountPercent;
  m.free=cc.free===true;
  m.billingCategory=cc.billingCategory;
  m.max10MonthlyUsageLimitUsd=cc.max10MonthlyUsageLimitUsd;
  m.max20MonthlyUsageLimitUsd=cc.max20MonthlyUsageLimitUsd;
  m.offPeakShown=cc.offPeakShown===true;
  m.tokenPrices=tokenPriceBases(cc);
  const cost=repriceTask(m.taskEfficiency?.tokens,cc);
  const adjusted=planAdjustedTaskCost(cost,cc,economics);
  if(m.taskEfficiency&&Number.isFinite(cost)){
    m.taskEfficiency.commandCodeCostPerTaskUsd=cost;
    m.taskEfficiency.planAdjustedCostPerTaskUsd=adjusted;
  }
  if(m.roleScores&&Number.isFinite(adjusted)){
    for(const score of Object.values(m.roleScores)){
      if(Number.isFinite(score?.rankingQuality))score.rankingValue=adjusted===0?null:round(score.rankingQuality/adjusted,3);
    }
  }
  commandCodeUpdated++;
}
if(commandCodeUpdated!==snapshot.models.length)throw new Error(`CommandCode pricing refresh updated ${commandCodeUpdated}/${snapshot.models.length} rows`);

const slugs=[...new Set((snapshot.models||[]).map(m=>m.aaModel?.slug).filter(Boolean))].sort();
const aaRows=runOpenCLI(['artificial-analysis','models',slugs.join(','),'-f','json']);
const aaBySlug=new Map(aaRows.map(model=>[model.slug,model]));
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
    const adjusted=m.taskEfficiency?.planAdjustedCostPerTaskUsd;
    m.roleScores['security-reviewer']={score,rankingQuality:score,rankingValue:adjusted==null||adjusted===0?null:round(score/adjusted,3)};
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
snapshot.sources.commandCodeMax={
  ...(snapshot.sources.commandCodeMax||{}),
  url:'https://commandcode.ai/docs/plans/max',
  rows:maxRows.length,
  refreshedAt:now.toISOString(),
  billingCategories:{
    standard:maxRows.filter(x=>x.billingCategory==='standard').length,
    premium:maxRows.filter(x=>x.billingCategory==='premium').length,
    free:maxRows.filter(x=>x.billingCategory==='free').length
  },
  planEconomics:economics
};
snapshot.sources.cyberbench={url:cyber.sourceUrl,fetchedAt:cyber.fetchedAt,benchmarkUpdatedAt:cyber.benchmarkUpdatedAt,directFamilies:resolved.values.size,missingMappings:resolved.missing};
snapshot.sources.artificialAnalysis={...(snapshot.sources.artificialAnalysis||{}),intelligenceIndexFamilies:intelligenceUpdated};
snapshot.counts={...(snapshot.counts||{}),commandCodePlanRows:commandCodeUpdated,cyberbenchDirectFamilies:resolved.values.size};

for(const dir of [path.join(root,'data'),path.join(root,'site','data')])fs.mkdirSync(dir,{recursive:true});
const json=JSON.stringify(snapshot,null,2)+'\n';
fs.writeFileSync(path.join(root,'data',`${date}.json`),json);
fs.writeFileSync(path.join(root,'data','latest.json'),json);
fs.writeFileSync(path.join(root,'site','data','latest.json'),json);
console.log(JSON.stringify({date,commandCodeUpdated,intelligenceUpdated,securityUpdated,cyberbenchDirectFamilies:resolved.values.size,cyberbenchMissing:resolved.missing.length},null,2));
