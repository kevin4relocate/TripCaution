// Static editorial preparation checks. They detect metadata duplication and
// missing provenance records; they cannot verify whether travel claims are true.
import {slugify,normalizeURL} from './content.js';
export function auditCautionPackage(packageData){
 const items=Array.isArray(packageData?.articles)?packageData.articles:[packageData];
 const problems=[],warnings=[],seenSlug=new Set(),seenTitle=new Set(),countries=new Set();
 if(items.length<1||items.length>30){
  problems.push('A package must contain 1–30 articles.');
  return {ok:false,count:items.length,problems,warnings,countries:[]};
 }
 for(let index=0;index<items.length;index++){
  const item=items[index],tag='#'+(index+1)+' '+String(item?.title||'(untitled)').slice(0,70);
  if(!item||typeof item!=='object'||Array.isArray(item)){problems.push(tag+': invalid article');continue;}
  const title=String(item.title||'').trim(),country=String(item.country||'').trim();
  const slug=slugify(item.slug||item.title);
  if(!title||!country||!slug){problems.push(tag+': title, country and usable slug required');continue;}
  countries.add(country);
  const slugKey=slug,titleKey=country.toLocaleLowerCase('en')+'|'+title.toLocaleLowerCase('en');
  if(seenSlug.has(slugKey))problems.push(tag+': duplicate slug in package');
  if(seenTitle.has(titleKey))problems.push(tag+': repeated title in the same country');
  seenSlug.add(slugKey);seenTitle.add(titleKey);
  if(String(item.content_markdown||'').trim().length<100)
   warnings.push(tag+': draft body is shorter than 100 characters and will fail import.');
  const sourceList=item.research?.sources||item.sources||[];
  const sources=Array.isArray(sourceList)?sourceList:[];
  const valid=new Set();
  for(const source of sources){
   const url=normalizeURL(source?.url);
   if(url)valid.add(url);
   else warnings.push(tag+': missing or invalid HTTPS source.');
  }
  if(!valid.size)warnings.push(tag+': no valid cited HTTPS source; publishing will be blocked.');
  if(valid.size===1)warnings.push(tag+': only one cited URL; consider independent corroboration for contested claims.');
  // A link in a source list is not evidence that it supports the text.
  const claims=item.research?.claim_evidence||[];
  if(!Array.isArray(claims)||!claims.length){
   warnings.push(tag+': no claim-to-source record; individually trace material claims before publication.');
  }else{
   for(const [n,claim] of claims.entries()){
    if(String(claim?.claim||'').trim().length<12)
     warnings.push(tag+': evidence row '+(n+1)+' needs an actual claim.');
    const source=normalizeURL(claim?.source_url);
    if(!source||!valid.has(source))
     warnings.push(tag+': evidence row '+(n+1)+' does not match a listed HTTPS source.');
    if(String(claim?.scope||'').trim().length<12)
     warnings.push(tag+': evidence row '+(n+1)+' needs a country/operator/date-specific scope.');
   }
  }
  const reportedLevel=item.caution_level||item.research?.caution_level;
  if(reportedLevel&&reportedLevel!=='unassessed')
   warnings.push(tag+': imported impact labels are ignored; only the editor may assess and approve them.');
  if(!Array.isArray(item.research?.uncertainties)||!item.research.uncertainties.length)
   warnings.push(tag+': record unanswered questions explicitly; an empty list requires owner confirmation.');
 }
 return {ok:problems.length===0,count:items.length,problems,warnings,countries:[...countries].sort()};
}
