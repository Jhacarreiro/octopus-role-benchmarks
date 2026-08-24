import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const roles=JSON.parse(fs.readFileSync(path.join(root,'config','roles.json'),'utf8'));
if(roles.coveragePolicy!==1) throw new Error('coveragePolicy must remain 1.0');
if(!Array.isArray(roles.roles)||roles.roles.length!==8) throw new Error('Expected 8 canonical Octopus roles');
const ids=new Set();
for(const role of roles.roles){
  if(!role.id||ids.has(role.id)) throw new Error(`Invalid/duplicate role id: ${role.id}`); ids.add(role.id);
  const sum=Object.values(role.weights).reduce((a,b)=>a+b,0);
  if(Math.abs(sum-1)>1e-9) throw new Error(`Weights for ${role.id} sum to ${sum}`);
  for(const key of Object.keys(role.weights)) if(!roles.benchmarks[key]) throw new Error(`Unknown benchmark ${key} in ${role.id}`);
}
const latest=path.join(root,'data','latest.json');
if(fs.existsSync(latest)){
  const d=JSON.parse(fs.readFileSync(latest,'utf8'));
  for(const [key,c] of Object.entries(d.coverage||{})) if(c.ratio!==1||c.present!==c.total) throw new Error(`Snapshot coverage <100% for ${key}`);
  for(const m of d.models||[]) if(m.mapping?.status==='unscored'&&Object.keys(m.roleScores||{}).length) throw new Error(`Unscored model has role score: ${m.name}`);
}
console.log(`ok: ${roles.roles.length} roles; coveragePolicy=${roles.coveragePolicy}`);
