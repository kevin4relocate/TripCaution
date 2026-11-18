// Launch inventory baseline for the eleven Southeast Asian destinations.
// These are publication inventory targets, never country safety ratings.
export const LAUNCH_COUNTRY_TARGET=10;
export const LAUNCH_GUIDE_TARGET=110;

export const TOPIC_CATEGORIES=Object.freeze([
 {slug:'scams-theft',label:'Scams & theft'},
 {slug:'payments-money',label:'Payments & money'},
 {slug:'transport',label:'Transport'},
 {slug:'laws-customs',label:'Local laws & customs'},
 {slug:'safety-health',label:'Safety & health'},
 {slug:'travel-essentials',label:'Travel essentials'}
]);

export function summarizeCountryTopicCounts(rows,countries,topicForCategory){
 const map=new Map(countries.map(country=>[country,{
  country,published:0,pipeline:0,
  topics:TOPIC_CATEGORIES.map(topic=>({...topic,published:0,pipeline:0}))
 }]));
 for(const row of rows||[]){
  const record=map.get(row.country);
  const topic=topicForCategory(row.category_id);
  if(!record||!topic)continue;
  const bucket=record.topics.find(item=>item.slug===topic.slug);
  if(!bucket)continue;
  const n=Math.max(0,Number(row.count)||0);
  if(row.status==='published')bucket.published+=n;
  if(['draft','review','scheduled'].includes(row.status))bucket.pipeline+=n;
 }
 for(const item of map.values()){
  item.published=item.topics.reduce((sum,topic)=>sum+topic.published,0);
  item.pipeline=item.topics.reduce((sum,topic)=>sum+topic.pipeline,0);
  item.topicsCovered=item.topics.filter(topic=>topic.published>0).length;
  item.topicGoal=TOPIC_CATEGORIES.length;
 }
 return [...map.values()];
}
