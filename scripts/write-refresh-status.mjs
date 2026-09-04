import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const arg=(name,fallback=null)=>{
  const i=args.indexOf(`--${name}`);
  return i>=0&&args[i+1]!=null?args[i+1]:fallback;
};
const state=arg('status');
if(!['success','error'].includes(state)) throw new Error('Expected --status success|error');
const attemptedAt=arg('attempted-at',new Date().toISOString());
const stage=arg('stage',null);
const runUrl=arg('run-url',null);
const logFile=arg('log-file',null);

function readLatest({committed=false}={}){
  try{
    const raw=committed
      ? execFileSync('git',['show','HEAD:data/latest.json'],{cwd:root,encoding:'utf8'})
      : fs.readFileSync(path.join(root,'data','latest.json'),'utf8');
    return JSON.parse(raw)
  }
  catch{return null}
}
function summarizeLog(file){
  if(!file) return null;
  try{
    const clean=fs.readFileSync(file,'utf8')
      .replace(/\u001b\[[0-9;]*m/g,'')
      .split(/\r?\n/)
      .map(s=>s.trim())
      .filter(Boolean);
    const candidates=clean.filter(s=>/^(error:|error\b|.*failed\b|.*failure\b|.*coverage\b|.*row count\b|.*quality floor\b)/i.test(s));
    const line=(candidates.at(-1)||clean.at(-1)||'').replace(/\s+/g,' ').trim();
    return line?line.slice(0,280):null;
  }catch{return null}
}

const latest=readLatest({committed:state==='error'});
const payload={
  schemaVersion:1,
  status:state,
  attemptedAt,
  lastSuccessfulSnapshot:latest?{
    date:latest.date??null,
    generatedAt:latest.generatedAt??null
  }:null,
  stage:state==='error'?stage:null,
  errorSummary:state==='error'?(summarizeLog(logFile)||'Refresh failed; see the GitHub Actions run for details.'):null,
  runUrl:runUrl||null
};
const json=JSON.stringify(payload,null,2)+'\n';
for(const rel of ['data/refresh-status.json','site/data/refresh-status.json']){
  const out=path.join(root,rel);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,json);
}
console.log(JSON.stringify(payload,null,2));
