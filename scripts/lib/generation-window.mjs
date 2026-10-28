import {compareGenerationStrings,inferModelGeneration} from './model-family.mjs';
const catalogGeneration=model=>inferModelGeneration({name:model.name});

// Count distinct catalog generations, never numerical subtraction (6.1 - 5.4).
// All offers define the window, including a new release without measurements.
export function generationWindows(models,{retainedGenerations=2}={}){
  if(!Number.isInteger(retainedGenerations)||retainedGenerations<1)throw new Error('Invalid generation window');
  const series=new Map();
  for(const m of models){const info=catalogGeneration(m);if(info.generation==null)continue;const versions=series.get(info.series)??new Set();versions.add(info.generation);series.set(info.series,versions);}
  return new Map([...series].map(([key,values])=>[key,[...values].sort((a,b)=>compareGenerationStrings(b,a))]));
}
export function generationEligibility(model,windows,{retainedGenerations=2}={}){
  const info=catalogGeneration(model),versions=windows.get(info.series)??[];
  const rank=info.generation==null?null:versions.indexOf(info.generation);
  const explicit=model.mapping?.status==='outdated_unscored';
  const eligible=!explicit&&(rank==null||rank>=0&&rank<retainedGenerations);
  return {eligible,status:eligible?'active':'historical',series:info.series,generation:info.generation,generationRank:rank,retainedGenerations,latestGenerations:versions.slice(0,retainedGenerations),source:'full-retained-catalog',reason:eligible?(rank==null?'No reliable numeric generation; retain for identity/evidence review':`Inside the ${retainedGenerations}-generation catalog window`):explicit?'Explicitly superseded release':`Outside the ${retainedGenerations}-generation window; newer catalog generations: ${versions.slice(0,retainedGenerations).join(', ')}`};
}
