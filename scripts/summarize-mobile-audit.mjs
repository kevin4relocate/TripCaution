import {readFileSync,writeFileSync,existsSync} from 'node:fs';

const dir=process.argv[2]||'audits';
const targetsPath=process.argv[3]||dir+'/targets.json';
if(!existsSync(targetsPath))throw new Error('Missing '+targetsPath);
const targets=JSON.parse(readFileSync(targetsPath,'utf8'));
if(!Array.isArray(targets)||!targets.length)throw new Error('No Lighthouse targets found');

const thresholds={
 performance:{warn:80,fail:65,direction:'min'},
 accessibility:{warn:95,fail:90,direction:'min'},
 'best-practices':{warn:95,fail:90,direction:'min'},
 seo:{warn:95,fail:90,direction:'min'},
 lcp:{warn:3000,fail:4000,direction:'max'},
 cls:{warn:0.10,fail:0.25,direction:'max'},
 tbt:{warn:300,fail:600,direction:'max'}
};
const score=(lhr,key)=>lhr.categories?.[key]?.score==null?null:Math.round(lhr.categories[key].score*100);
const metric=(lhr,key)=>lhr.audits?.[key]?.numericValue==null?null:Number(lhr.audits[key].numericValue);
function level(value,rule){
 if(value==null)return 'fail';
 if(rule.direction==='min'){
  if(value<rule.fail)return 'fail';
  if(value<rule.warn)return 'warn';
 }else{
  if(value>rule.fail)return 'fail';
  if(value>rule.warn)return 'warn';
 }
 return 'pass';
}
const rows=[];
for(const target of targets){
 const path=dir+'/'+target.file+'.json';
 if(!existsSync(path)){
  rows.push({...target,file:path,status:'fail',problems:['Missing Lighthouse report']});
  continue;
 }
 const lhr=JSON.parse(readFileSync(path,'utf8'));
 const values={
  performance:score(lhr,'performance'),
  accessibility:score(lhr,'accessibility'),
  'best-practices':score(lhr,'best-practices'),
  seo:score(lhr,'seo'),
  lcp:metric(lhr,'largest-contentful-paint'),
  cls:metric(lhr,'cumulative-layout-shift'),
  tbt:metric(lhr,'total-blocking-time')
 };
 const problems=[],warnings=[];
 for(const [key,rule] of Object.entries(thresholds)){
  const state=level(values[key],rule);
  if(state==='fail')problems.push(key+' failed launch threshold');
  if(state==='warn')warnings.push(key+' needs attention');
 }
 const status=problems.length?'fail':warnings.length?'warn':'pass';
 rows.push({...target,file:path,status,values,problems,warnings,
  finalUrl:lhr.finalDisplayedUrl||lhr.finalUrl||target.url,
  lighthouseVersion:lhr.lighthouseVersion||null});
}
const failed=rows.filter(r=>r.status==='fail');
const warned=rows.filter(r=>r.status==='warn');
const passed=rows.filter(r=>r.status==='pass');
const allScores=key=>rows.map(r=>r.values?.[key]).filter(Number.isFinite);
const avg=key=>{const a=allScores(key);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;};
const worst=(key,direction='min')=>{
 const vals=rows.filter(r=>Number.isFinite(r.values?.[key]));
 if(!vals.length)return null;
 return vals.reduce((a,b)=>direction==='min'?(b.values[key]<a.values[key]?b:a):(b.values[key]>a.values[key]?b:a));
};
const decision=failed.length?'NO_GO':warned.length?'PASS_WITH_WARNINGS':'MOBILE_PERFORMANCE_PASS';
const report={
 executed_at:new Date().toISOString(),
 source_sha:process.env.GITHUB_SHA||null,
 decision,
 thresholds,
 totals:{targets:rows.length,passed:passed.length,warned:warned.length,failed:failed.length},
 averages:{
  performance:avg('performance'),accessibility:avg('accessibility'),
  best_practices:avg('best-practices'),seo:avg('seo')
 },
 worst:{
  performance:worst('performance','min'),
  accessibility:worst('accessibility','min'),
  lcp:worst('lcp','max'),
  cls:worst('cls','max'),
  tbt:worst('tbt','max')
 },
 rows
};
writeFileSync(dir+'/mobile-performance-summary.json',JSON.stringify(report,null,2));

const fmt=(value,type)=>{
 if(value==null)return '—';
 if(type==='ms')return (value/1000).toFixed(2)+' s';
 if(type==='cls')return value.toFixed(3);
 return String(value);
};
let md='# TripCaution launch mobile + performance audit\\n\\n';
md+='Source SHA: '+(report.source_sha||'unknown')+'\\n\\n';
md+='Decision: **'+decision+'**\\n\\n';
md+='Targets: '+rows.length+' · Pass: '+passed.length+' · Warnings: '+warned.length+' · Fail: '+failed.length+'\\n\\n';
md+='| Page | Perf | A11y | Best | SEO | LCP | CLS | TBT | Result |\\n';
md+='|---|---:|---:|---:|---:|---:|---:|---:|---|\\n';
for(const row of rows){
 const v=row.values||{};
 md+='| '+row.label+' | '+(v.performance??'—')+' | '+(v.accessibility??'—')+' | '+(v['best-practices']??'—')+' | '+(v.seo??'—')+' | '+fmt(v.lcp,'ms')+' | '+fmt(v.cls,'cls')+' | '+fmt(v.tbt,'ms')+' | '+row.status.toUpperCase()+' |\\n';
}
md+='\\nThresholds: performance >=80 preferred (<65 fail); accessibility >=95 preferred (<90 fail); best practices/SEO >=95 preferred (<90 fail); LCP <=3.0s preferred (>4.0s fail); CLS <=0.10 preferred (>0.25 fail); TBT <=300ms preferred (>600ms fail).\\n';
if(warned.length){
 md+='\\n## Warnings\\n';
 for(const row of warned)md+='- **'+row.label+'**: '+row.warnings.join(', ')+'\\n';
}
if(failed.length){
 md+='\\n## Failures\\n';
 for(const row of failed)md+='- **'+row.label+'**: '+row.problems.join(', ')+'\\n';
}
md+='\\nLab scores are diagnostic and can vary between runs. They do not replace a real-device visual check.\\n';
writeFileSync(dir+'/summary.md',md);
console.log(md);
if(failed.length)process.exitCode=1;
