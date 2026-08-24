import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const URL='https://artificialanalysis.ai/agents/coding-agents';
const UA='Mozilla/5.0 (compatible; OctopusRoleBenchmarks/1.0; +https://github.com/Jhacarreiro/octopus-role-benchmarks)';

function fieldString(block, field) {
  const i=block.indexOf(field); if(i<0) return null;
  const tail=block.slice(i+field.length,i+field.length+500);
  const m=tail.match(/:\\"([^\\"]*)/); return m?m[1]:null;
}
function fieldNumber(block, field) {
  const i=block.indexOf(field); if(i<0) return null;
  const tail=block.slice(i+field.length,i+field.length+180);
  const m=tail.match(/:(null|-?[0-9]+(?:\.[0-9]+)?)/); return !m||m[1]==='null'?null:Number(m[1]);
}
function fieldBool(block, field) {
  const i=block.indexOf(field); if(i<0) return null;
  const tail=block.slice(i+field.length,i+field.length+60);
  const m=tail.match(/:(true|false)/); return m?m[1]==='true':null;
}
function meanTelemetry(block) {
  const marker='mean\\":{\\"reward';
  const i=block.indexOf(marker); if(i<0) return {};
  const x=block.slice(i,i+2200);
  return {
    reward: fieldNumber(x,'reward'), costUsd: fieldNumber(x,'costUsd'), wallTimeSec: fieldNumber(x,'agentWallTimeSec'),
    steps: fieldNumber(x,'steps'), inputTokens: fieldNumber(x,'inputTokens'), cacheWriteTokens: fieldNumber(x,'cacheWriteTokens'),
    outputTokens: fieldNumber(x,'outputTokens'), cacheTokens: fieldNumber(x,'cacheTokens'), cacheHitRate: fieldNumber(x,'cacheHitRate'),
    totalTokens: fieldNumber(x,'totalTokens')
  };
}
function evalScores(block) {
  const out={};
  const re=/datasetIndexName\\":\\"([^\\"]+).*?mean\\":\{\\"reward\\":([0-9.]+)/gs;
  for(const m of block.matchAll(re)) out[m[1]]=Number(m[2]);
  return out;
}
export function parseCodingAgents(html) {
  const marker=/\\"id\\":\\"[0-9a-f]{32}\\",\\"isDefault\\":/g;
  const starts=[...html.matchAll(marker)].map(m=>m.index);
  const rows=[];
  for(let n=0;n<starts.length;n++){
    const block=html.slice(starts[n],starts[n+1]??Math.min(html.length,starts[n]+28000));
    const agent=fieldString(block,'agentName'), hostModelSlug=fieldString(block,'hostModelSlug'), indexScore=fieldNumber(block,'indexScore');
    if(!agent||!hostModelSlug||indexScore==null) continue;
    rows.push({
      agent, hostModelSlug, displayLabel:fieldString(block,'displayLabel'), indexScore,
      isDefault:fieldBool(block,'isDefault'), isHighlighted:fieldBool(block,'isHighlighted'),
      telemetry:meanTelemetry(block), evaluations:evalScores(block), sourceUrl:URL
    });
  }
  return rows;
}

cli({
  site:'artificial-analysis', name:'coding-agents',
  description:'Read Artificial Analysis Coding Agent Index variants and pooled efficiency telemetry',
  access:'read', example:'opencli artificial-analysis coding-agents -f json', domain:'artificialanalysis.ai',
  strategy:Strategy.PUBLIC, browser:false,
  columns:['hostModelSlug','agent','displayLabel','indexScore','isHighlighted'],
  func:async()=>{
    const response=await fetch(URL,{headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new CommandExecutionError(`Coding Agent page returned HTTP ${response.status}`);
    const rows=parseCodingAgents(await response.text());
    if(rows.length<40) throw new EmptyResultError(`Unexpected Coding Agent row count: ${rows.length}`);
    return rows;
  }
});
