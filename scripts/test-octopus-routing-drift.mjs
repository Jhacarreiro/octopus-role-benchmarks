import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const routing=JSON.parse(fs.readFileSync(path.join(root,"site","data","octopus-routing.json"),"utf8"));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"octopus-routing-"));
try{
  const good={routing:{roles:Object.fromEntries(Object.entries(routing.roles).map(([role,v])=>[role,{provider:v.provider,model:v.model}]))}};
  const goodPath=path.join(dir,"good.json"); fs.writeFileSync(goodPath,JSON.stringify(good));
  let r=spawnSync(process.execPath,[path.join(root,"scripts","check-octopus-routing-drift.mjs"),"--providers",goodPath],{encoding:"utf8"});
  if(r.status!==0)throw new Error(`matching routing failed: ${r.stderr||r.stdout}`);
  const bad=structuredClone(good); bad.routing.roles.implementer=`${routing.roles.implementer.provider}/${routing.roles.implementer.model}`;
  const badPath=path.join(dir,"bad.json"); fs.writeFileSync(badPath,JSON.stringify(bad));
  r=spawnSync(process.execPath,[path.join(root,"scripts","check-octopus-routing-drift.mjs"),"--providers",badPath],{encoding:"utf8"});
  if(r.status!==2||!r.stderr.includes("DRIFT implementer"))throw new Error(`string route did not fail closed: status=${r.status} stderr=${r.stderr}`);
  console.log("ok: routing drift checker accepts exact objects and rejects string routes");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
