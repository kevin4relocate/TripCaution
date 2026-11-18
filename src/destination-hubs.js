// Reader-first destination discovery: only group articles already published by the Worker.
// A topic is not a warning about an entire country, nor a measure of incident likelihood.
import {CAUTION_TOPICS,cautionTopicForCategory} from './cautions.js';

export function groupDestinationGuides(articles=[]){
 const available=new Map(CAUTION_TOPICS.map(topic=>[topic.slug,{...topic,guides:[]}]));
 const other={slug:'other',title:'Other travel preparations',description:'Additional published guidance.',guides:[]};
 for(const guide of articles){
  const topic=cautionTopicForCategory(guide?.category_id);
  (topic?available.get(topic.slug):other).guides.push(guide);
 }
 return [...available.values(),other].filter(group=>group.guides.length>0);
}

export function destinationHubDescription(place,country,groups=[],count=0){
 const location=place===country?country:place+', '+country;
 if(!count || !groups.length)
  return 'Travel precautions, cultural considerations and researched guides for '+location+'.';
 const subjects=groups.slice(0,3).map(group=>group.title.toLowerCase()).join(', ');
 return 'Explore '+count+' source-linked travel guides for '+location+' on '+subjects+'. Check original sources before your trip.';
}
