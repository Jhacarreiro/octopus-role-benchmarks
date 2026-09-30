import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const check=process.argv.includes("--check");
const lineups=JSON.parse(fs.readFileSync(path.join(root,"site","data","lineups.json"),"utf8"));
const mapping=JSON.parse(fs.readFileSync(path.join(root,"config","octopus-routing-models.json"),"utf8"));
const balanced=lineups?.modes?.balanced?.selections;
if(!balanced||typeof balanced!=="object")throw new Error("balanced lineup missing");
const roles={};
for(const [role,selection] of Object.entries(balanced)){
  const identity=mapping?.models?.[selection?.model];
  if(!identity?.provider||!identity?.model)throw new Error(`missing Octopus execution identity for Balanced model: ${selection?.model}`);
  roles[role]={provider:identity.provider,model:identity.model,benchmarkModel:selection.model};
}
const out={schemaVersion:1,snapshotDate:lineups.snapshotDate,generatedAt:lineups.generatedAt,mode:"balanced",roles};
const text=JSON.stringify(out,null,2)+"\n";
const target=path.join(root,"site","data","octopus-routing.json");
if(check){
  const current=fs.existsSync(target)?fs.readFileSync(target,"utf8"):"";
  if(current!==text)throw new Error("site/data/octopus-routing.json is stale; run npm run build:octopus-routing");
  console.log("ok: Octopus routing artifact matches Balanced lineup");
}else{
  fs.writeFileSync(target,text);
  console.log(`wrote ${path.relative(root,target)} for snapshot ${lineups.snapshotDate}`);
}
