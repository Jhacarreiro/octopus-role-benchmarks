import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const flag=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const providersPath=flag("--providers")||process.env.OCTOPUS_PROVIDERS_CONFIG;
if(!providersPath)throw new Error("providers path required via --providers or OCTOPUS_PROVIDERS_CONFIG");
const routing=JSON.parse(fs.readFileSync(path.join(root,"site","data","octopus-routing.json"),"utf8"));
const providers=JSON.parse(fs.readFileSync(providersPath,"utf8"));
const current=providers?.routing?.roles;
if(!current||typeof current!=="object"||Array.isArray(current))throw new Error("providers.json routing.roles missing or invalid");
let drift=false;
for(const [role,want] of Object.entries(routing.roles)){
  const got=current[role];
  const exact=got&&typeof got==="object"&&!Array.isArray(got)&&got.provider===want.provider&&got.model===want.model;
  if(exact) console.log(`OK ${role}: ${want.provider}:${want.model}`);
  else {drift=true;console.error(`DRIFT ${role}: expected ${want.provider}:${want.model}; got ${JSON.stringify(got)}`);}
}
if(drift)process.exit(2);
console.log(`ok: providers routing matches Balanced snapshot ${routing.snapshotDate}`);
