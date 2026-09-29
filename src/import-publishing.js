// Guard against an AI-authored JSON document silently choosing a live state.
// Owner-confirmed plan application is separate from source-link syntax checks.
import {isValidSchedule} from './content.js';

const SELF_PUBLISH_CATEGORIES=new Set(['transport','payments-money','travel-essentials','before-you-go','etiquette']);
const SENSITIVE=/\b(?:visa|immigration|passport validity|entry requirement|border closure|arrest|criminal|fraud|scam|theft|kidnap|assault|war|armed|unrest|outbreak|epidemic|medical|vaccin|hospital|fatal|death|emergency|terror|sexual|unsafe|legal requirement|penalt|fines?|prohibit)\b/i;
function host(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:')return '';
  return u.hostname.toLowerCase().replace(/^www\./,'').replace(/^(?:old|new)\./,'');
 }catch{return '';}
}
export function assessImportPublishingPlan(raw,now=Date.now()){
 const requested=raw?.publishing?.requested_status;
 if(requested!=='publish'&&requested!=='schedule')return {requested:false,allowed:false,reason:null};
 const reasons=[];
 const exactTime=raw?.publishing?.preferred_publish_at;
 if(raw?.auto_publish===true)reasons.push('Manual import cannot request bot auto_publish.');
 if(!SELF_PUBLISH_CATEGORIES.has(raw?.category))reasons.push('Sensitive category requires individual editorial review.');
 if(raw?.country==='Myanmar')reasons.push('Myanmar travel topics require individual editorial review.');
 if(SENSITIVE.test([raw?.title,raw?.excerpt,raw?.content_markdown].join(' ')))
  reasons.push('Change-sensitive or high-impact claims require individual editorial review.');
 if(String(raw?.content_markdown||'').trim().length<1800)reasons.push('Article must contain substantive content.');
 const sources=raw?.research?.sources||raw?.sources||[];
 if(!Array.isArray(sources)||new Set(sources.map(s=>host(s?.url)).filter(Boolean)).size<2)
  reasons.push('At least two independently hosted HTTPS sources required.');
 const claims=raw?.research?.claim_evidence;
 if(!Array.isArray(claims)||claims.length<2||!claims.every(c=>
  typeof c?.claim==='string'&&c.claim.trim().length>=25&&
  typeof c?.scope==='string'&&c.scope.trim().length>=12&&
  typeof c?.evidence_excerpt==='string'&&c.evidence_excerpt.trim().length>=35&&
  sources.some(src=>src.url===c.source_url)))
  reasons.push('Two claim-to-source records with supported scope and exact quotes required.');
 if(requested==='schedule'&&(!isValidSchedule(exactTime)||Date.parse(exactTime)<=now))
  reasons.push('Scheduled publication requires a future ISO 8601 timestamp with timezone.');
 if(requested==='publish'&&exactTime)
  reasons.push('Immediate publish must not carry a future schedule date.');
 return {requested:true,allowed:reasons.length===0,action:requested,scheduled_at:requested==='schedule'?exactTime:null,reason:reasons.join(' ')||null};
}
