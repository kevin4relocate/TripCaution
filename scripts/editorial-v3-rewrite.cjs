'use strict';
// Repeatable editorial revision. No live safety claim or unverified citation is generated.
// Node: require('./scripts/editorial-v3-rewrite.cjs').upgrade(article, note, frequency)
const FAMILIES=[
 [/myanmar|advisory|consular|warning|medic(al|ation)|pharmacy|e-visa|visa|et?travel|arrival card|restricted items|insurance exclusion/i,
  ['the relevant government or specialist authority','the country-specific rule or warning and its effective date','an official page and an offline copy of the applicable notice','the advice changes or a requirement cannot be confirmed','Which official notice applies to the exact traveler, route and date?']],
 [/allerg|diet|ingredient|vegetarian|food|restaurant|hawker|breakfast|meal|seafood/i,
  ['the responsible food business and, where appropriate, a qualified clinician','ingredients, preparation method and the ability to avoid cross-contact','the written dietary request and a usable alternative meal plan','the kitchen cannot confirm the ingredients or preparation','Can the person preparing the food explain both ingredients and cross-contact, rather than merely agreeing to the request?']],
 [/snorkel|swim|dive|kayak|reef|water activ|boat|ferry|pier|river tubing|cruise|marine|island-hopping/i,
  ['the boat operator, activity guide or responsible local authority','the exact departure/return place, passenger limits and conditions for cancellation','the operator contact, boarding instructions and a land-based fallback','weather, boarding access or equipment makes the activity unsuitable','What is the departure point, return arrangement and go/no-go policy for these specific conditions?']],
 [/rail|train|mrt|bts|coach|bus|station|airport|flight|airline|terminal|transfer|taxi|ride pickup|ride receipts/i,
  ['the current carrier, airport or transport operator','the precise terminal or platform, connecting leg and the last workable return option','the booking, pickup instructions, full address and an offline route','the connection is missed or the intended pickup cannot be located','Which station, terminal, pickup point and service are named on the actual ticket or operator notice?']],
 [/walk|mobility|step-free|accessib|stroller|crossing|cycling|bicycle|road|hike|trek|viewpoint|heat|shade|sun exposure|highland|mountain/i,
  ['the place manager, qualified guide or route authority','the surface, gradients, steps, rest options and a realistic turnaround point','an access description, meeting place and an easier return route','the route becomes too demanding for the least comfortable traveler','Where are the difficult sections, stopping points and accessible alternatives on this particular route?']],
 [/temple|mosque|religious|monastery|ceremony|heritage|cultural|photograph|photo|craft|wildlife|homestay|festival|community|market|privacy|library/i,
  ['the host, venue, responsible community representative or local authority','the boundaries around photography, access, consent and respectful participation','the host’s instructions, any permissions and a plan that respects refusals','a person declines consent or an area is not open to visitors','What has the host or venue explicitly permitted, and how will the group respond if permission changes?']],
 [/payment|cash|card|qr|bank|ticket|book|refund|hotel|guesthouse|accommodation|reservation|rental|tour|workshop/i,
  ['the seller, service provider or responsible issuer','the included service, full charges, cancellation terms and accepted payment channel','the authentic booking page, itemized terms and payment confirmation','a charge, inclusion or cancellation condition differs from the listing','Does the provider confirm the full scope, price conditions and the channel for resolving a dispute?']],
 [/./,['the responsible operator or local authority','the actual location, terms, timing and constraints for the trip','the current provider instructions, contact details and an offline backup','a key arrangement is unavailable or cannot be confirmed','Which responsible organization can verify the one detail that changes this decision?']]
];
const clean=s=>String(s||'').trim().replace(/[.!?]\s*$/,'');
const low=s=>{s=clean(s);return s.slice(0,1).toLowerCase()+s.slice(1)};
function context(a){
 const match=a.content_markdown.match(/^## Key takeaways\s*\n((?:- .*\n){3})/m);
 const steps=match?match[1].trim().split('\n').map(x=>clean(x.replace(/^-\s*/,''))):[];
 if(steps.length!==3)throw Error('Missing three takeaways: '+a.slug);
 const family=FAMILIES.find(([regex])=>regex.test(a.title+' '+a.category))[1];
 const city=a.city&&a.city!==a.country?a.city+', '+a.country:a.country;
 return {a,steps,family,city};
}
function rewriteRepeated(p,c){
 const [s1,s2,s3]=c.steps,[source,detail,record,failure,question]=c.family;
 const title=c.a.title;
 if(p.startsWith('A useful test is to imagine')||p.startsWith('Think about whether someone else')||p.startsWith('A single phone may hold')||p.startsWith('Offline access to the next'))
  return 'Try an offline rehearsal of **'+low(s2)+'** for '+title+'. Keep '+record+', the name of the person responsible for resolving a problem, and the date of the last confirmation. If another member of the group cannot follow the next step from those notes, request a clearer answer before relying on the arrangement.';
 if(p.startsWith('When comparing two options')||p.startsWith('A transfer is not just')||p.startsWith('A route is made')||p.startsWith('The handoff between services'))
  return 'Compare alternatives against '+detail+' rather than only an advertised price or a short map route. For this itinerary, **'+low(s3)+'** is the stress test: assess the original arrangement and the backup on the same terms, including what happens at the handoff. A good option is one the traveler can actually complete and reverse if needed.';
 if(p.startsWith('The best questions are specific')||p.startsWith('Ask for the answer in a form')||p.startsWith('A glossy listing may say little')||p.startsWith('A booking page can make'))
  return 'Make the question narrow enough to be answered with evidence: '+question+' Tie the response to **'+low(s1)+'**, and keep the exact instruction, issuer and relevant date. A general assurance or a screenshot with no named service does not settle '+detail+' for this particular visit.';
 if(p.startsWith('Test two changes')||p.startsWith('Now introduce two changes'))
  return 'Run two hypothetical changes through this plan. First, imagine that '+failure+'. Second, imagine the person with the tightest schedule or greatest support needs must leave early. Which option still makes **'+low(s3)+'** practical? If neither works, shorten the visit or change the booking before the pressure of the day makes the decision harder.';
 if(p.startsWith('Different people may make different choices')||p.startsWith('The right choice depends on the traveler')||p.startsWith('Name the requirement that cannot be traded away'))
  return 'The limits for '+title+' are personal, not a single universal ranking. One traveler may need '+detail+' settled in advance, while another values a faster or less expensive choice. Agree which condition is non-negotiable for this group, then use **'+low(s1)+'** as the first check before committing time or money.';
 if(p.startsWith('Save the relevant answer')||p.startsWith('Before you act, look at the original source'))
  return 'Keep '+record+' in a private offline note. Confirm live operational details with '+source+'; broad government destination advice is context, not proof that a named business or service will operate as expected. Avoid sharing booking references, identity documents or sensitive information in public groups merely to obtain an answer.';
 if(p.startsWith('When comparing alternatives')||p.startsWith('Carry an independent backup')||p.startsWith('Use a smaller or more flexible')||p.startsWith('Choose an option with fewer'))
  return 'A genuine alternative for '+title+' must still work if '+failure+'. Use **'+low(s3)+'** to design that alternative: identify who makes the change, what it would cost or invalidate, and how the traveler would return. Do not call two listings a backup when they depend on the same operator, access point or unverified condition.';
 if(p.startsWith('The scope of the booked experience')||p.startsWith('Respect for people and places'))
  return 'Before calling this plan complete, return to **'+low(s2)+'**. The deciding evidence is '+detail+', not how persuasive the listing or photograph looks. For a visit in '+c.city+', note who gave the answer and whether the same arrangement would remain comfortable and respectful if one member of the party needed to change course.';
 return p;
}
function rewriteQuestions(markdown,c){
 const lines=markdown.split('\n');
 const start=lines.findIndex(x=>/^## Questions (?:before|for )/i.test(x));
 if(start<0)throw Error('Missing question section for '+c.a.slug);
 let end=lines.findIndex((x,i)=>i>start&&/^## /.test(x));if(end<0)end=lines.length;
 const original=lines.slice(start,end),n=original.filter(x=>x.startsWith('- ')).length;
 if(n<5||n>7)throw Error('Unexpected checklist count '+n+' for '+c.a.slug);
 const [s1,s2,s3]=c.steps,[source,detail,record,failure,question]=c.family;
 const custom=[
  '- **'+s1+':** Which current instruction or written confirmation from '+source+' addresses this step?',
  '- **'+s2+':** What precise detail needs to be recorded — '+detail+' — for this date and group?',
  '- **'+s3+':** If the original choice fails, what alternative is independent and still workable?',
  '- **One accountable answer:** '+question,
  '- **Proof for travel day:** Can you retrieve '+record+' without mobile access?',
  '- **Change of plan:** If '+failure+', who will decide, cancel or arrange the return?'
 ];
 const count=n;
 let index=0;
 const replacement=original.map(line=>line.startsWith('- ')?custom[index++]:line);
 if(index>custom.length)throw Error('Too many checklist items');
 return [...lines.slice(0,start),...replacement,...lines.slice(end)].join('\n');
}
function upgrade(article,note,frequency){
 if(!note||note.length<55)throw Error('Missing specific topic note for '+article.slug);
 if(article.editorial_standard_version!==2)throw Error('Expected v2 '+article.slug);
 const c=context(article);let chunks=article.content_markdown.split(/\n\s*\n/),rewritten=0;
 chunks=chunks.map(p=>{
  const t=p.trim();if((frequency.get(t)||0)<12)return p;
  const result=rewriteRepeated(t,c);if(result===t)throw Error('Unmapped repeat in '+article.slug+': '+t.slice(0,70));
  rewritten++;return result;
 });
 if(rewritten<1)throw Error('No boilerplate fixed '+article.slug);
 let result=chunks.join('\n\n');
 const idx=result.indexOf('\n\n## Key takeaways');
 if(idx<0)throw Error('No takeaways '+article.slug);
 result=result.slice(0,idx)+'\n\n'+note+result.slice(idx);
 result=rewriteQuestions(result,c);
 return {...article,content_markdown:result,editorial_standard_version:3,editorial_revision:'topic-specific-provisional-v3'};
}
module.exports={upgrade,context,rewriteRepeated,rewriteQuestions};
