import fs from 'node:fs';
const lineups=JSON.parse(fs.readFileSync(new URL('../site/data/lineups.json',import.meta.url),'utf8'));
for(const [mode,payload] of Object.entries(lineups.modes||{})){
  const s=payload.selections||{};
  const reviewer=s['code-reviewer'];
  const implementer=s['implementer'];
  const heavy=s['implementer-heavy'];
  if(!reviewer||!implementer||!heavy) throw new Error(`${mode}: missing coding selections`);
  if(reviewer.family===implementer.family) throw new Error(`${mode}: Code Reviewer family ${reviewer.family} matches Implementer family`);
  if(reviewer.family===heavy.family) throw new Error(`${mode}: Code Reviewer family ${reviewer.family} matches Implementer Heavy family`);
}
console.log('ok: Code Reviewer family is independent from both implementation families');
