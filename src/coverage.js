// Sprint 6 editorial capacity targets, not claims that every country has
// eight corroborated travel problems. Unsubstantiated slots stay unfilled.
export const COUNTRY_ARTICLE_TARGET=8;
export const FIRST_PASS_TARGET=3;
export const TOPIC_TARGETS=Object.freeze([
 {slug:'scams-theft',label:'Scams & theft',target:2},
 {slug:'payments-money',label:'Payments & money',target:1},
 {slug:'transport',label:'Transport',target:2},
 {slug:'laws-customs',label:'Local laws & customs',target:1},
 {slug:'safety-health',label:'Safety & health',target:1},
 {slug:'travel-essentials',label:'Travel essentials',target:1}
]);
export function summarizeCountryTopicCounts(rows, countries, topicForCategory){
 const map=new Map(countries.map(country=>[country, {
  country,published:0,pipeline:0,topics:TOPIC_TARGETS.map(t=>({...t,published:0,pipeline:0}))
 }]));
 for(const row of rows||[]){
  const record=map.get(row.country);
  const topic=topicForCategory(row.category_id);
  if(!record||!topic)continue;
  const target=record.topics.find(t=>t.slug===topic.slug);
  if(!target)continue;
  const n=Math.max(0,Number(row.count)||0);
  if(row.status==='published')target.published+=n;
  if(['draft','review','scheduled'].includes(row.status))target.pipeline+=n;
 }
 for(const item of map.values()){
  item.published=item.topics.reduce((n,t)=>n+t.published,0);
  item.pipeline=item.topics.reduce((n,t)=>n+t.pipeline,0);
  // Target-capped topic coverage avoids counting three generic transport
  // guides as three distinct first-phase issues or exceeding the 88 goal.
  item.firstPassCovered=['transport','scams-theft','safety-health']
   .reduce((sum,slug)=>sum+Math.min(1,item.topics.find(t=>t.slug===slug)?.published||0),0);
  item.depthCovered=item.topics.reduce((sum,t)=>sum+Math.min(t.target,t.published),0);
  item.firstPassGoal=FIRST_PASS_TARGET;
  item.depthGoal=COUNTRY_ARTICLE_TARGET;
 }
 return [...map.values()];
}
