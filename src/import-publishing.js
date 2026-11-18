// The signed-in owner determines import status after reviewing the JSON
// locally. No AI file or bot-token request can authorize this operation.
import {isValidSchedule} from './content.js';

export function assessImportPublishingPlan(raw,now=Date.now()){
 const token=String(raw?.publishing?.requested_status||raw?.status||'review').toLowerCase().trim();
 const status=({publish:'published',published:'published',schedule:'scheduled',scheduled:'scheduled',
  review:'review',review_before_publication:'review',draft:'review'})[token];
 if(!status)return {requested:true,allowed:false,reason:'Invalid requested_status: '+token};
 const time=raw?.publishing?.preferred_publish_at??raw?.scheduled_at??null;
 const sources=raw?.research?.sources||raw?.sources||[];
 if(status!=='review' && (!Array.isArray(sources)||!sources.some(src=>{
  try{return new URL(src?.url).protocol==='https:';}catch{return false;}
 })))return {requested:true,allowed:false,reason:'Publish and Schedule require at least one valid HTTPS source.'};
 if(status==='scheduled'&&(!isValidSchedule(time)||Date.parse(time)<=now))
  return {requested:true,allowed:false,reason:'Scheduled articles require a future ISO 8601 date with timezone.'};
 if(status==='published'&&time)
  return {requested:true,allowed:false,reason:'Published articles must omit preferred_publish_at; use scheduled when setting a future date.'};
 return {requested:true,allowed:true,status,scheduled_at:status==='scheduled'?time:null,reason:null};
}
