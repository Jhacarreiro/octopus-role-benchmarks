import {parseArtificialAnalysisCyberIndex} from './aa-cyber-index.mjs';
const html='prefix{\\"id\\":\\"1\\",\\"slug\\":\\"grok-4-7\\",\\"name\\":\\"Grok 4.7\\",\\"cyberIndex\\":56.4,\\"cweBench\\":0.68,\\"cweBenchRefusalRate\\":0,\\"deepsecBench\\":0.27,\\"deepsecBenchRefusalRate\\":0,\\"cybergymE2e\\":0.74,\\"cybergymE2eRefusalRate\\":0}suffix';
const m=parseArtificialAnalysisCyberIndex(html).get('grok-4-7');
if(!m)throw new Error('row missing');
if(m.value!==56.4)throw new Error(`wrong score ${m.value}`);
if(m.components.cweBench!==0.68||m.components.deepsecBench!==0.27||m.components.cybergymE2e!==0.74)throw new Error('wrong components');
console.log(JSON.stringify({ok:true,row:m}));
