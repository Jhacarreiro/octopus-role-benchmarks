import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const activePath=path.join(root,'config/active-methodology.json');
if(!fs.existsSync(activePath)){console.log('ok: publication not activated');process.exit(0);}
const fixture=JSON.parse(fs.readFileSync(path.join(root,'methodology/fixtures/2026-10-28-selective-inputs.json')));
const files=['data/latest.json',`data/${fixture.generatedAt.slice(0,10)}.json`,'site/data/latest.json','site/data/lineups.json','data/lineup-opportunities.json','site/data/octopus-routing.json','data/deployment-validation.json'];
const hash=rel=>fs.existsSync(path.join(root,rel))?crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex'):null;
const before=files.map(hash),temp=fs.mkdtempSync(path.join(os.tmpdir(),'benchmark-publication-'));
try{
  for(const failure of ['global-source-failure','missing-security']){
    const data=structuredClone(fixture);
    if(failure==='global-source-failure')data.observations=data.observations.map(r=>({slug:r.slug,sourceUnavailableReason:'test: unavailable'}));
    else for(const r of data.observations)r.cyberIndex=null;
    const input=path.join(temp,failure+'.json');fs.writeFileSync(input,JSON.stringify(data));
    const result=spawnSync(process.execPath,[path.join(root,'scripts/update.mjs'),'--inputs',input],{cwd:root,encoding:'utf8',timeout:45000,maxBuffer:8e6});
    assert.notEqual(result.status,0,`${failure} must reject publication`);
    assert.deepEqual(files.map(hash),before,`${failure} must preserve every current public artifact`);
  }
}finally{
  assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));fs.rmSync(temp,{recursive:true,force:true});
}
console.log('ok: failed source extraction and infeasible security portfolios preserve all published artifacts');
