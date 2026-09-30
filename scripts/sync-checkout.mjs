import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const git=(args)=>execFileSync("git",["-C",root,...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const dirty=git(["status","--porcelain"]);
if(dirty){console.error("refusing sync: checkout has local changes");process.exit(2);}
git(["fetch","origin","main"]);
const counts=git(["rev-list","--left-right","--count","HEAD...origin/main"]).split(/\s+/).map(Number);
const [ahead,behind]=counts;
if(ahead>0){console.error(`refusing sync: checkout is ahead by ${ahead} commit(s)`);process.exit(3);}
if(behind===0){console.log("ok: checkout already matches origin/main");process.exit(0);}
execFileSync("git",["-C",root,"merge","--ff-only","origin/main"],{stdio:"inherit"});
console.log(`ok: fast-forwarded checkout by ${behind} commit(s)`);
