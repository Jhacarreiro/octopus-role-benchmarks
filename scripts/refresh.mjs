import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {runSelectiveUpdate} from './selective-update.mjs';
import {validateRoleSnapshot} from './lib/role-scoring.mjs';

// Collect and validate an entire coherent publication before replacing any
// public artifact. Backups remain in ignored staging storage for recovery.
export async function runPublicRefresh(root,args=[]){
  const active=JSON.parse(fs.readFileSync(path.join(root,'config/active-methodology.json')));
  if(active.version!==10||active.statisticalIntelligenceEstimator!==false)throw new Error('Unsupported active methodology or estimator state');
  const config=JSON.parse(fs.readFileSync(path.join(root,'config',active.config)));
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
  const stage=fs.mkdtempSync(path.join(root,'tmp','refresh-v10-'));
  const index=args.indexOf('--inputs');
  const options=['--output-dir',stage,...(index>=0?['--inputs',args[index+1]]:[])];
  const {snapshot}=await runSelectiveUpdate(root,options);
  validateRoleSnapshot(snapshot,config);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)||!Number.isFinite(Date.parse(snapshot.generatedAt)))throw new Error('Invalid publication date');
  const collected=JSON.parse(fs.readFileSync(path.join(stage,'inputs.json')));
  const failedSources=collected.observations.filter(r=>r.sourceUnavailableReason).length;
  if(failedSources/collected.observations.length>.2)throw new Error('Widespread source extraction failure; previous publication preserved');
  const run=(script,argv)=>{
    const result=spawnSync(process.execPath,[path.join(root,'scripts',script),...argv],{cwd:root,encoding:'utf8',timeout:45000,maxBuffer:8e6});
    if(result.status!==0)throw new Error(`Staged publication failed: ${script}`);
    console.log(result.stdout.trim());
  };
  const latest=path.join(stage,'latest.json'),lineups=path.join(stage,'lineups.json');
  run('build-lineups.mjs',['--snapshot',latest,'--output',lineups]);
  run('evaluate-lineup-swaps.mjs',['--snapshot',latest,'--lineups',lineups,'--output',path.join(stage,'lineup-opportunities.json')]);
  run('build-octopus-routing.mjs',['--lineups',lineups,'--output',path.join(stage,'octopus-routing.json')]);
  const assignments=JSON.parse(fs.readFileSync(lineups));
  if(assignments.methodologyVersion!==10||assignments.snapshotGeneratedAt!==snapshot.generatedAt)throw new Error('Staged publication version mismatch');
  const files={
    [`data/${snapshot.date}.json`]:latest,
    'data/latest.json':latest,
    'site/data/latest.json':latest,
    'site/data/lineups.json':lineups,
    'data/lineup-opportunities.json':path.join(stage,'lineup-opportunities.json'),
    'site/data/octopus-routing.json':path.join(stage,'octopus-routing.json')
  };
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const sourceFiles=['scripts/refresh.mjs','scripts/update.mjs','scripts/selective-update.mjs','scripts/lib/role-scoring.mjs','scripts/lib/role-approximations.mjs','scripts/build-lineups.mjs','scripts/evaluate-lineup-swaps.mjs','scripts/build-octopus-routing.mjs','config/roles-v10.json','config/active-methodology.json','config/lineup-policy.json','config/octopus-routing-models.json','package.json'];
  const previous=execFileSync('git',['show','HEAD:data/latest.json'],{cwd:root,maxBuffer:16e6});
  const manifest={schemaVersion:1,methodologyVersion:10,snapshotGeneratedAt:snapshot.generatedAt,sourceBaseRevision:revision,sourceSha256:Object.fromEntries(sourceFiles.map(file=>[file,hash(path.join(root,file))])),statisticalIntelligenceEstimator:false,previousSnapshotSha256:crypto.createHash('sha256').update(previous).digest('hex'),artifactSha256:Object.fromEntries(Object.entries(files).map(([target,file])=>[target,hash(file)])),counts:snapshot.counts};
  const manifestPath=path.join(stage,'deployment-validation.json');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  files['data/deployment-validation.json']=manifestPath;
  const backedUp=[];
  try{
    for(const [target]of Object.entries(files)){
      const actual=path.join(root,target),backup=path.join(stage,'backup',target),exists=fs.existsSync(actual);
      if(exists){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(actual,backup);}
      backedUp.push({actual,backup,exists});
    }
    for(const [target,file]of Object.entries(files)){const actual=path.join(root,target);fs.mkdirSync(path.dirname(actual),{recursive:true});fs.copyFileSync(file,actual);}
  }catch(error){
    for(const entry of backedUp){if(entry.exists)fs.copyFileSync(entry.backup,entry.actual);else if(fs.existsSync(entry.actual))fs.unlinkSync(entry.actual);}
    throw error;
  }
  console.log(`Published coherent v10 artifacts for ${snapshot.generatedAt}; statistical estimators disabled.`);
  return {snapshot,stage,manifest};
}
