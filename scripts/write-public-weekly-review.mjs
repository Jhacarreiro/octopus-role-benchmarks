import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(rel)=>JSON.parse(fs.readFileSync(path.join(root,rel),"utf8"));
const show=(rel)=>{try{return JSON.parse(execFileSync("git",["show",`HEAD:${rel}`],{cwd:root,encoding:"utf8"}))}catch{return null}};
const money=v=>v==null?"—":v===0?"$0":`$${Number(v).toFixed(Number(v)<0.1?4:2)}`;
const pct=(a,b)=>a==null||b==null||a===0?null:(b-a)/a;
const clip=(xs,n=10)=>({shown:xs.slice(0,n),more:Math.max(0,xs.length-n)});
const mapModels=d=>new Map((d?.models||[]).map(m=>[m.name,m]));
const selections=l=>{const out=new Map();for(const [mode,x] of Object.entries(l?.modes||{}))for(const [role,p] of Object.entries(x.selections||{}))out.set(`${mode}|${role}`,p.model);return out};

const oldD=show("data/latest.json"),newD=read("data/latest.json");
const oldL=show("site/data/lineups.json"),newL=read("site/data/lineups.json");
const oldR=show("data/refresh-status.json"),newR=read("data/refresh-status.json");
const a=mapModels(oldD),b=mapModels(newD);
const added=[...b.keys()].filter(n=>!a.has(n)).sort();
const removed=[...a.keys()].filter(n=>!b.has(n)).sort();
const priceChanges=[];
for(const name of [...a.keys()].filter(n=>b.has(n)).sort()){
  const x=a.get(name),y=b.get(name),parts=[];
  const oldRaw=x.taskEfficiency?.commandCodeCostPerTaskUsd,newRaw=y.taskEfficiency?.commandCodeCostPerTaskUsd;
  const oldAdj=x.taskEfficiency?.planAdjustedCostPerTaskUsd,newAdj=y.taskEfficiency?.planAdjustedCostPerTaskUsd;
  const rawPc=pct(oldRaw,newRaw),adjPc=pct(oldAdj,newAdj);
  if(rawPc!=null&&Math.abs(rawPc)>=0.05)parts.push(`créditos/task ${money(oldRaw)}→${money(newRaw)} (${rawPc>0?"+":""}${(rawPc*100).toFixed(0)}%)`);
  if(adjPc!=null&&Math.abs(adjPc)>=0.05)parts.push(`custo ajustado ${money(oldAdj)}→${money(newAdj)} (${adjPc>0?"+":""}${(adjPc*100).toFixed(0)}%)`);
  if(x.billingCategory!==y.billingCategory)parts.push(`billing ${x.billingCategory??"—"}→${y.billingCategory??"—"}`);
  if(x.discountPercent!==y.discountPercent)parts.push(`desconto ${x.discountPercent??0}%→${y.discountPercent??0}%`);
  if(x.free!==y.free)parts.push(`free ${x.free?"sim":"não"}→${y.free?"sim":"não"}`);
  if(parts.length)priceChanges.push(`• ${name}: ${parts.join("; ")}`);
}
const oldS=selections(oldL),newS=selections(newL),roleChanges=[];
for(const [key,model] of newS){const before=oldS.get(key);if(before&&before!==model){const [mode,role]=key.split("|");roleChanges.push(`• ${mode}/${role}: ${before} → ${model}`)}}
const refreshChanged=JSON.stringify(oldR)!==JSON.stringify(newR);
const material=added.length||removed.length||priceChanges.length||roleChanges.length||refreshChanged;
let message="NO_REPLY";
if(material){
  const mode=newR?.mode?` · ${newR.mode}`:"";
  const icon=newR?.status==="success"?"✅":newR?.status==="partial"?"⚠️":"❌";
  const lines=["🧭 Octopus benchmark — revisão semanal",`Snapshot: ${oldD?.date??"—"} → ${newD?.date??"—"}`,`${icon} Refresh: ${newR?.status??"unknown"}${mode}${newR?.message?` — ${newR.message}`:""}`,""];
  if(added.length||removed.length){lines.push("MODELOS");if(added.length){const {shown,more}=clip(added);lines.push("Entraram:",...shown.map(x=>`+ ${x}`));if(more)lines.push(`… +${more} adicionais`)}if(removed.length){const {shown,more}=clip(removed);lines.push("Saíram:",...shown.map(x=>`- ${x}`));if(more)lines.push(`… +${more} adicionais`)}lines.push("")}
  if(priceChanges.length){const {shown,more}=clip(priceChanges,12);lines.push("PREÇOS / CRÉDITOS",...shown);if(more)lines.push(`… +${more} alterações adicionais`);lines.push("")}
  lines.push("LINEUPS");
  if(roleChanges.length)lines.push(...roleChanges);else lines.push("• Nenhuma alteração efectiva nas lineups.");
  message=lines.join("\n").slice(0,3900);
}
const payload={schemaVersion:1,generatedAt:new Date().toISOString(),snapshotDate:newD.date??null,refresh:newR??null,materialChanges:Boolean(material),message};
const json=JSON.stringify(payload,null,2)+"\n";
for(const rel of ["data/weekly-review.json","site/data/weekly-review.json"]){const out=path.join(root,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,json)}
console.log(message);
