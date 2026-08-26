import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const statePath=path.join(root,'.weekly-review-state.json');
const args=process.argv.slice(2);
const baseline=args.includes('--baseline');
const compareIdx=args.indexOf('--compare');

function git(a,{allowFail=false}={}){
  const r=spawnSync('git',a,{cwd:root,encoding:'utf8',timeout:20000});
  if(r.status!==0&&!allowFail) throw new Error(`git ${a.join(' ')}: ${(r.stderr||r.stdout||'failed').trim()}`);
  return (r.stdout||'').trim();
}
function showJson(commit,file,optional=false){
  const r=spawnSync('git',['show',`${commit}:${file}`],{cwd:root,encoding:'utf8',timeout:20000});
  if(r.status!==0){if(optional)return null;throw new Error(`cannot read ${file} at ${commit}: ${(r.stderr||'').trim()}`)}
  return JSON.parse(r.stdout);
}
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function money(v){if(v==null)return '—'; if(v===0)return '$0'; return `$${Number(v).toFixed(Number(v)<0.1?4:2)}`}
function pctChange(a,b){if(a==null||b==null||a===0)return null;return (b-a)/a}
function clip(list,n=12){return {shown:list.slice(0,n),more:Math.max(0,list.length-n)}}
function modelMap(d){return new Map((d?.models||[]).map(m=>[m.name,m]))}
function selectionMap(lineups){
 const out=new Map();
 for(const [mode,m] of Object.entries(lineups?.modes||{})) for(const [role,p] of Object.entries(m.selections||{})) out.set(`${mode}|${role}`,p.model);
 return out;
}
function oppKeys(o){
 const out=new Map();
 for(const [mode,m] of Object.entries(o?.modes||{})) for(const x of m.opportunities||[]) out.set(`${mode}|${x.role}|${x.from}|${x.to}|${x.classification}`,{...x,mode,currentFamilyCount:m.currentFamilyCount??null});
 return out;
}
function signed(v,d=2){if(v==null||!Number.isFinite(Number(v)))return '—';const n=Number(v);return `${n>=0?'+':''}${n.toFixed(d)}`}
function candidateDetail(x){
 const parts=[];
 if(x.fromQuality!=null&&x.toQuality!=null) parts.push(`Quality ${Number(x.fromQuality).toFixed(2)}→${Number(x.toQuality).toFixed(2)} (${signed(x.toQuality-x.fromQuality,2)})`);
 if(x.fromCostPerTaskUsd!=null&&x.toCostPerTaskUsd!=null){const pc=pctChange(x.fromCostPerTaskUsd,x.toCostPerTaskUsd);parts.push(`custo ${money(x.fromCostPerTaskUsd)}→${money(x.toCostPerTaskUsd)}${pc==null?'':` (${signed(pc*100,0)}%)`}`)}
 if(x.fromBalanced!=null&&x.toBalanced!=null) parts.push(`Balanced ${Number(x.fromBalanced).toFixed(1)}→${Number(x.toBalanced).toFixed(1)} (${signed(x.toBalanced-x.fromBalanced,1)})`);
 if(x.currentFamilyCount!=null&&x.resultingFamilyCount!=null) parts.push(`famílias ${x.currentFamilyCount}→${x.resultingFamilyCount}`);
 if(x.reviewReason) parts.push(`motivo: ${x.reviewReason}`);
 return `${x.mode}/${x.role}: ${x.from} → ${x.to} — ${parts.join('; ')}`;
}
function candidateAction(x){
 if(x.classification==='auto-safe-candidate') return 'AÇÃO: rever/aprovar; o evaluator considera a troca numericamente e estruturalmente admissível, mas nunca a aplica sozinho.';
 if(x.reviewReason?.includes('reduce distinct-family')) return 'AÇÃO: manter salvo decisão explícita de aceitar menor diversidade.';
 if(x.reviewReason?.includes('quality improvement below')) return 'AÇÃO: ignorar salvo evidência externa/role-fit que justifique a troca.';
 if(x.mode==='balanced') return 'AÇÃO: comparar Quality absoluta/role-fit com a poupança antes de alterar.';
 return 'AÇÃO: revisão humana obrigatória antes de qualquer alteração.';
}
function selectionUsage(lineups){
 const out=new Map();
 for(const [mode,m] of Object.entries(lineups?.modes||{})) for(const [role,p] of Object.entries(m.selections||{})){
   const arr=out.get(p.model)||[];arr.push(`${mode}/${role}`);out.set(p.model,arr);
 }
 return out;
}
function fmtModelList(title,names,prefix){
 if(!names.length)return [];
 const {shown,more}=clip(names,10); const lines=[title];
 for(const n of shown)lines.push(`${prefix} ${n}`); if(more)lines.push(`… +${more} adicionais`); return lines;
}
function buildReport(oldC,newC){
 const oldD=showJson(oldC,'data/latest.json'), newD=showJson(newC,'data/latest.json');
 const oldL=showJson(oldC,'site/data/lineups.json',true), newL=showJson(newC,'site/data/lineups.json',true);
 const oldO=showJson(oldC,'data/lineup-opportunities.json',true), newO=showJson(newC,'data/lineup-opportunities.json',true);
 const newP=showJson(newC,'config/lineup-policy.json',true);
 const a=modelMap(oldD),b=modelMap(newD);
 const usage=selectionUsage(newL);
 const added=[...b.keys()].filter(n=>!a.has(n)).sort();
 const removed=[...a.keys()].filter(n=>!b.has(n)).sort();
 const unclassifiedAdded=added.filter(n=>!newP?.familyByModel?.[n]);
 const priceFields=[['inputPerM','input/M'],['outputPerM','output/M'],['cacheReadPerM','cache read/M'],['cacheWritePerM','cache write/M'],['discountPercent','desconto'],['free','free']];
 const priceChanges=[];
 for(const n of [...a.keys()].filter(n=>b.has(n)).sort()){
   const x=a.get(n),y=b.get(n),parts=[];
   for(const [k,label] of priceFields){if(!eq(x[k],y[k])){if(k==='discountPercent')parts.push(`${label} ${x[k]??'—'}%→${y[k]??'—'}%`);else if(k==='free')parts.push(`${label} ${x[k]?'sim':'não'}→${y[k]?'sim':'não'}`);else parts.push(`${label} ${money(x[k])}→${money(y[k])}`)}}
   const oc=x.taskEfficiency?.commandCodeCostPerTaskUsd,nc=y.taskEfficiency?.commandCodeCostPerTaskUsd;
   if(oc!=null&&nc!=null){const pc=pctChange(oc,nc);if(pc!=null&&Math.abs(pc)>=0.05)parts.push(`custo/task ${money(oc)}→${money(nc)} (${pc>0?'+':''}${(pc*100).toFixed(0)}%)`)}
   if(parts.length){const used=usage.get(n)||[];const suffix=used.length?` ⚠️ lineup: ${used.join(', ')}`:'';priceChanges.push({name:n,text:`• ${n}: ${parts.join('; ')}${suffix}`});}
 }
 const roleChanges=[]; const os=selectionMap(oldL),ns=selectionMap(newL);
 for(const [k,newM] of ns){const oldM=os.get(k);if(oldM&&oldM!==newM){const [mode,role]=k.split('|');roleChanges.push(`• ${mode} / ${role}: ${oldM} → ${newM}`)}}
 const oldOpp=oppKeys(oldO),newOpp=oppKeys(newO); const newCandidates=[];
 for(const [k,x] of newOpp){if(!oldOpp.has(k)&&(x.classification==='auto-safe-candidate'||x.classification==='review-only'))newCandidates.push(x)}
 const autoSafe=newCandidates.filter(x=>x.classification==='auto-safe-candidate');
 const reviewOnly=newCandidates.filter(x=>x.classification==='review-only').slice(0,5);
 const material=added.length||removed.length||priceChanges.length||roleChanges.length||autoSafe.length||reviewOnly.length||unclassifiedAdded.length;
 if(!material)return {report:'NO_REPLY',oldD,newD};
 const lines=['🧭 Octopus benchmark — revisão semanal',`Snapshot: ${oldD.date||oldC.slice(0,7)} → ${newD.date||newC.slice(0,7)}`,`Decisão: ${autoSafe.length} auto-safe nova(s) · ${reviewOnly.length} review-only nova(s) · ${unclassifiedAdded.length} modelo(s) novo(s) sem família`, ''];
 if(added.length||removed.length){lines.push('MODELOS');lines.push(...fmtModelList('Entraram:',added,'+'));lines.push(...fmtModelList('Saíram:',removed,'-'));if(unclassifiedAdded.length){lines.push('⚠️ Novos ainda fora do optimizer (sem familyByModel):');for(const n of unclassifiedAdded.slice(0,8))lines.push(`  - ${n}`);if(unclassifiedAdded.length>8)lines.push(`  … +${unclassifiedAdded.length-8} adicionais`);lines.push('  AÇÃO: classificar manualmente em familyByModel antes de o modelo poder entrar no optimizer.')}lines.push('')}
 if(priceChanges.length){lines.push('PREÇOS');const {shown,more}=clip(priceChanges,12);lines.push(...shown.map(x=>x.text));if(more)lines.push(`… +${more} alterações de preço adicionais`);lines.push('')}
 lines.push('ROLES');
 if(roleChanges.length)lines.push(...roleChanges); else lines.push('• Nenhuma alteração efectiva nas lineups.');
 if(autoSafe.length){lines.push('🚨 AUTO-SAFE NOVAS — decisão recomendada');for(const x of autoSafe.slice(0,5)){lines.push(`  - ${candidateDetail(x)}`);lines.push(`    ${candidateAction(x)}`)}}
 if(reviewOnly.length){lines.push('👀 REVIEW-ONLY NOVAS — contexto');for(const x of reviewOnly){lines.push(`  - ${candidateDetail(x)}`);lines.push(`    ${candidateAction(x)}`)}}
 if(!autoSafe.length&&!reviewOnly.length)lines.push('• Sem novas trocas candidatas relevantes no evaluator.');
 return {report:lines.join('\n').slice(0,3900),oldD,newD};
}

try{
  let oldC,newC;
  if(compareIdx>=0){oldC=args[compareIdx+1];newC=args[compareIdx+2];if(!oldC||!newC)throw new Error('--compare requires OLD NEW commits');}
  else{
    git(['fetch','--quiet','origin','main']);
    newC=git(['log','-1','--format=%H','origin/main','--','data/latest.json']);
    if(!newC)throw new Error('no benchmark snapshot commit found on origin/main');
    let state=null;try{state=JSON.parse(fs.readFileSync(statePath,'utf8'))}catch{}
    if(baseline||!state?.lastReviewedDataCommit){fs.writeFileSync(statePath,JSON.stringify({lastReviewedDataCommit:newC,reviewedAt:new Date().toISOString()},null,2)+'\n');console.log('NO_REPLY');process.exit(0)}
    oldC=state.lastReviewedDataCommit;
    if(oldC===newC){console.log('NO_REPLY');process.exit(0)}
    const result=buildReport(oldC,newC);
    fs.writeFileSync(statePath,JSON.stringify({lastReviewedDataCommit:newC,reviewedAt:new Date().toISOString()},null,2)+'\n');
    console.log(result.report);process.exit(0);
  }
  console.log(buildReport(oldC,newC).report);
}catch(e){
  console.log(`⚠️ Octopus benchmark weekly check falhou: ${e.message}`);
  process.exitCode=1;
}
