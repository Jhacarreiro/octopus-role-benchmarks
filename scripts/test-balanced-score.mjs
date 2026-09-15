import { balancedScore } from "./lib/balanced-score.mjs";

function close(actual,expected,label){
  if(!Number.isFinite(actual)||Math.abs(actual-expected)>1e-12){
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

close(balancedScore(66.608,2.567,3.5),57.6235,"Astra example");
close(balancedScore(59.167,0.836,3.5),56.241,"Grok example");
close(balancedScore(70,0,3.5),70,"free model keeps quality score");
if(balancedScore(70,null,3.5)!==null)throw new Error("missing cost must return null");
if(balancedScore(70,1,-1)!==null)throw new Error("negative penalty must return null");
console.log("ok: Balanced score uses Role Quality - lambda * plan-adjusted task cost");
