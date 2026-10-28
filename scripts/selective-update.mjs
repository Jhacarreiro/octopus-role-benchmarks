import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseModelObservations} from './lib/aa-observations.mjs';
import {buildRoleSnapshot,validateRoleSnapshot} from './lib/role-scoring.mjs';
import {fetchArtificialAnalysisCyberIndex} from './aa-cyber-index.mjs';
import {caiIndexPercent,detectCodingAgentVersionFromRows} from './lib/cai-version-fallback.mjs';

export function isolatedOutput(root,output){
  if(!output)throw new Error('v10 requires --output-dir; published artifacts must not be overwritten');
  const resolved=path.resolve(output);
  for(const protectedDir of ['data','site','config','.git']){
    const relative=path.relative(path.join(root,protectedDir),resolved);
    if(relative===''||!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('v10 output must be outside published/configuration directories');
  }
  return resolved;
}
async function collect(root){
  const bin=path.join(root,'node_modules','.bin',process.platform==='win32'?'opencli.cmd':'opencli');
  const run=(args)=>{const r=spawnSync(bin,args,{cwd:root,encoding:'utf8',shell:process.platform==='win32',env:{...process.env,HOME:path.join(root,'.opencli-home')},maxBuffer:40*1024*1024});if(r.status!==0)throw new Error(`Source extraction failed: ${args[0]}/${args[1]}`);return JSON.parse(r.stdout);};
  const install=spawnSync(process.execPath,[path.join(root,'scripts/install-opencli-adapters.mjs')],{cwd:root,encoding:'utf8'});
  if(install.status!==0)throw new Error('Adapter installation failed');
  const maxRows=run(['commandcode','max','-f','json']),catalog=run(['artificial-analysis','catalog','-f','json']);
  const aliases=JSON.parse(fs.readFileSync(path.join(root,'config/model-aliases.json'))).aliases;
  const norm=x=>String(x).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+\((latest|exp)\)$/,'').replace(/\s+(contributor|highspeed|fast)$/,'').replace(/[^a-z0-9]+/g,'');
  const byNorm=new Map();for(const row of catalog){const k=norm(row.slug);byNorm.set(k,[...(byNorm.get(k)??[]),row.slug]);}
  const offers=maxRows.map(offer=>{
    const override=aliases[offer.name];
    if(override)return {...offer,mapping:override.slug?override:{...override,status:override.status==='outdated_unscored'?'outdated_unscored':'unscored'}};
    const candidates=byNorm.get(norm(offer.name.replace(/\s+preview$/i,'')))??[];
    return {...offer,mapping:candidates.length===1?{slug:candidates[0],status:'exact'}:{status:'unscored',reason:'No unambiguous verified AA identity'}};
  });
  const slugs=[...new Set(offers.map(o=>o.mapping.slug).filter(Boolean))],observations=[];
  let next=0;
  await Promise.all(Array.from({length:Math.min(6,slugs.length)},async()=>{
    while(next<slugs.length){const slug=slugs[next++];
      try{const r=await fetch(`https://artificialanalysis.ai/models/${slug}`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);observations.push(parseModelObservations(await r.text(),slug));}
      catch(e){observations.push({slug,sourceUnavailableReason:String(e.message)});}
    }
  }));
  // Optional diagnostics accept only an exact, verified host identity. No fuzzy
  // provider-name stripping or inferred host alias participates in scoring.
  try{
    const coding=run(['artificial-analysis','coding-agents','-f','json']);
    const version=detectCodingAgentVersionFromRows(coding);
    for(const source of observations){const rows=coding.filter(r=>r.hostModelSlug===source.slug);if(rows.length===1&&Number.isFinite(rows[0].indexScore))source.codingAgentObserved={status:'observed',value:caiIndexPercent(rows[0].indexScore),scale:'0-100',version,sourceUrl:'https://artificialanalysis.ai/agents/coding-agents',capturedAt:new Date().toISOString()};}
  }catch{ /* CAI is optional diagnostic evidence, with no estimator or weight. */ }
  // A specialist source failure leaves only that role unavailable.
  let cyberSourceIssue=null;
  try{const cyber=await fetchArtificialAnalysisCyberIndex();for(const r of observations)r.cyberIndex=cyber.bySlug.get(r.slug)?.value??null;}
  catch(e){cyberSourceIssue=String(e.message);}
  return {offers,observations,rawOfferCount:maxRows.length,generatedAt:new Date().toISOString(),cyberSourceIssue};
}
export async function runSelectiveUpdate(root,args){
  const arg=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
  const output=isolatedOutput(root,arg('--output-dir'));
  const inputs=arg('--inputs')?JSON.parse(fs.readFileSync(path.resolve(arg('--inputs')))):await collect(root);
  const config=JSON.parse(fs.readFileSync(path.join(root,'config/roles-v10.json')));
  const policy=JSON.parse(fs.readFileSync(path.join(root,'config/lineup-policy.json')));
  const snapshot=buildRoleSnapshot({...inputs,config,policy});
  validateRoleSnapshot(snapshot,config);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
  fs.writeFileSync(path.join(output,'latest.json'),JSON.stringify(snapshot,null,2)+'\n');
  console.log(JSON.stringify({methodologyVersion:10,output,estimatorsEnabled:false,counts:snapshot.counts,roleCoverage:snapshot.roleCoverage},null,2));
}
