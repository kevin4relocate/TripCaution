// Narrow, fail-closed eligibility for unattended research publication.
// A passing result means the package passed structural and source-excerpt checks;
// it is NOT a human fact-check and never assigns an impact/danger rating.
const SAFE_TOPICS=new Set(['transport','payments-money','travel-essentials','before-you-go']);
const HIGH_STAKES=/\b(?:visa|immigration|passport validity|entry requirements|border closure|arrest|criminal|fraud|scam(?:s)?|theft|kidnap(?:ping)?|assault|war|armed|unrest|outbreak|epidemic|medical|vaccin(?:e|ation)|hospital|fatal|death|emergency|terror|sexual|unsafe|legal requirement|penalty|fine|prohibit(?:ed|ion)?)\b/i;
const redditHost=host=>host==='reddit.com'||host.endsWith('.reddit.com');
function hostname(url){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
function independentHost(host){return host.replace(/^old\./,'').replace(/^new\./,'');}
export function assessAutoPublication(article,raw){
 const problems=[];
 if(!SAFE_TOPICS.has(article.category_id))problems.push('Category requires owner review.');
 if(article.country==='Myanmar')problems.push('Myanmar travel content requires dated owner review.');
 const words=[article.title,article.excerpt,article.content_markdown].join(' ');
 if(HIGH_STAKES.test(words))problems.push('Change-sensitive, alleged or high-stakes claims require owner review.');
 if(article.content_markdown.trim().length<1800)problems.push('The article is too short for unattended publication.');
 if(article.caution_level!=='unassessed')problems.push('Unattended research cannot assign an impact level.');
 const sources=JSON.parse(article.sources_json||'[]');
 const urls=new Set(sources.map(s=>s.url));
 const hosts=new Set(sources.map(s=>independentHost(hostname(s.url))).filter(Boolean));
 if(urls.size<2||hosts.size<2)problems.push('Two cited sources from independent sites are required.');
 // Community reports can expose issues overlooked by authorities. Two Reddit
 // threads still come from one platform, not two independently verified publishers.
 if(sources.every(s=>redditHost(hostname(s.url))))
  problems.push('Community-only claims require owner verification before publishing.');
 const claims=raw?.research?.claim_evidence;
 if(!Array.isArray(claims)||claims.length<2)problems.push('At least two material claim-to-source records are required.');
 else {
  const linked=new Set();
  for(const item of claims){
   if(typeof item?.claim!=='string'||item.claim.trim().length<25
      ||typeof item?.scope!=='string'||item.scope.trim().length<12
      ||typeof item?.evidence_excerpt!=='string'||item.evidence_excerpt.trim().length<35
      ||!urls.has(item.source_url)||item.source_checked!==true)
    problems.push('Claim-to-source rows must contain a checked excerpt and specific scope.');
   else linked.add(independentHost(hostname(item.source_url)));
  }
  if(linked.size<2)problems.push('Material claims require checked evidence from two independent sites.');
 }
 // Explicit unanswered source/claim conflicts can never go unattended.
 if(raw?.research?.evidence_conflict===true)problems.push('Conflicting evidence requires owner review.');
 if(raw?.research?.source_check_passed!==true)
  problems.push('Source excerpts must be independently fetched and matched by the research job.');
 return {eligible:problems.length===0,problems};
}
