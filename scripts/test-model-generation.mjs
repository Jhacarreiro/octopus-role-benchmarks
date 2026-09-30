import assert from 'node:assert/strict';
import { isLatestGenerationOrBeatsLatest } from './lib/model-family.mjs';

const models=[
  {name:'GPT-6 Astra',score:54.208},
  {name:'GPT-6 Sol',score:49},
  {name:'GPT-6.1 Sol',score:51.520},
  {name:'Claude Sonnet 5.5',score:60}
];
const score=m=>m.score;
assert.equal(isLatestGenerationOrBeatsLatest(models[0],models,score),true);
assert.equal(isLatestGenerationOrBeatsLatest(models[1],models,score),false);
assert.equal(isLatestGenerationOrBeatsLatest(models[2],models,score),true);
assert.equal(isLatestGenerationOrBeatsLatest(models[3],models,score),true);
const lowerOld={name:'GPT-6 Astra',score:50};
assert.equal(isLatestGenerationOrBeatsLatest(lowerOld,[lowerOld,models[2]],score),false);
console.log('ok: previous generation is eligible only when it beats latest generation on absolute role quality');
