import {
  caiIndexPercent,
  detectCodingAgentVersionFromRows,
  detectCodingAgentVersionFromSnapshot,
  historicalCaiAnchor,
  calibrateHistoricalCai,
  applyHistoricalCai
} from './lib/cai-version-fallback.mjs';

const currentPairs=[
  ['kimi-k3','Kimi Code CLI','Kimi Code CLI - Kimi K3',0.519259105470924,62.639],
  ['qwen3-8-max','Claude Code','Claude Code - Qwen3.8 Max',0.43265296412598736,61.31],
  ['claude-fable-5-1','Claude Code','Claude Code - Fable 5.1 (max) (with fallback)',0.6222249615769457,70.431],
  ['deepseek-v4-flash','Codex','Codex - DeepSeek V4 Flash 0731 (max)',0.3874247758775307,49.758],
  ['gpt-5-6-sol','Codex',"Codex - GPT-5.6 Sol (max) ({'reasoning_effort': 'max'})",0.54559127289644,65.052]
];
const currentBySlug=new Map(currentPairs.map(([slug,agent,displayLabel,indexScore])=>[slug,{agent,displayLabel,indexScore,evaluations:{'deep-swe-v1.1':0.5,'terminal-bench-v4':0.5}}]));
const previousModels=currentPairs.map(([slug,agent,displayLabel,,old])=>({
  aaModel:{slug},
  caiStar:{value:old,source:'observed'},
  codingAgent:{agent,displayLabel:displayLabel.replace(/ \(\{'reasoning_effort': 'max'\}\)$/,''),indexScore:old,evaluations:{'terminal-bench-v2.1':50}}
}));
const previous={generatedAt:'2026-09-07T12:39:50.361Z',models:previousModels,sources:{codingAgentIndex:{variants:55}}};
const previousBySlug=new Map(previousModels.map(m=>[m.aaModel.slug,m]));

if(caiIndexPercent(0.622)!==62.2)throw new Error('0-1 CAI scale normalization failed');
if(caiIndexPercent(62.2)!==62.2)throw new Error('0-100 CAI scale normalization failed');
if(detectCodingAgentVersionFromRows([...currentBySlug.values()])!=='v1.5')throw new Error('v1.5 row detection failed');
if(detectCodingAgentVersionFromSnapshot(previous)!=='v1.4')throw new Error('v1.4 snapshot detection failed');

const calibration=calibrateHistoricalCai({
  currentBySlug,
  previousBySlug,
  previousSnapshotVersion:'v1.4',
  previousObservedAt:previous.generatedAt,
  currentVersion:'v1.5'
});
if(!calibration.valid)throw new Error(`calibration unexpectedly invalid: ${calibration.errors.join('; ')}`);
if(calibration.comparableFamilies!==5)throw new Error(`expected 5 comparable families, got ${calibration.comparableFamilies}`);
if(Math.abs(calibration.factor-0.829)>0.001)throw new Error(`unexpected factor ${calibration.factor}`);
if(calibration.looMae>4.1||calibration.looMaxError>8)throw new Error(`unexpected validation error ${calibration.looMae}/${calibration.looMaxError}`);

const anchor=historicalCaiAnchor(previousModels[0],'v1.4',previous.generatedAt);
const migrated=applyHistoricalCai(anchor,calibration);
if(!(migrated>51&&migrated<53))throw new Error(`unexpected migrated score ${migrated}`);

console.log(JSON.stringify({
  ok:true,
  factor:Number(calibration.factor.toFixed(4)),
  comparableFamilies:calibration.comparableFamilies,
  looMae:Number(calibration.looMae.toFixed(3)),
  looMaxError:Number(calibration.looMaxError.toFixed(3))
}));
