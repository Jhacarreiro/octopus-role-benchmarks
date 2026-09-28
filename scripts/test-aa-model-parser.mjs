import {parseModel,currentModelBlock} from '../opencli/clis/artificial-analysis/models.js';

const html=[
  'prefix',
  '\\"currentModel\\":{\\"slug\\":\\"target\\",\\"name\\":\\"Target\\",\\"intelligenceIndex\\":12.5,\\"scicode\\":null,\\"gpqa\\":0.7}',
  'middle',
  '{\\"slug\\":\\"target\\",\\"name\\":\\"Target related\\",\\"intelligenceIndex\\":99,\\"scicode\\":0.91,\\"gpqa\\":0.99}',
  '\\"currentModel\\":{\\"slug\\":\\"other\\",\\"name\\":\\"Other\\",\\"intelligenceIndex\\":88,\\"scicode\\":0.88}',
].join('');

const block=currentModelBlock(html,'target');
if(!block) throw new Error('target currentModel block not found');
if(block.includes('0.91')) throw new Error('currentModel block leaked into adjacent object');
const parsed=parseModel(html,'target');
if(!parsed) throw new Error('target model did not parse');
if(parsed.intelligenceIndex!==12.5) throw new Error(`wrong intelligenceIndex ${parsed.intelligenceIndex}`);
if(parsed.scicode!==null) throw new Error(`expected null SciCode, got ${parsed.scicode}`);
if(parsed.gpqa!==0.7) throw new Error(`wrong GPQA ${parsed.gpqa}`);
console.log(JSON.stringify({ok:true,slug:parsed.slug,intelligenceIndex:parsed.intelligenceIndex,scicode:parsed.scicode,gpqa:parsed.gpqa}));
