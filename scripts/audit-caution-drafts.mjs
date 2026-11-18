#!/usr/bin/env node
// Optional owner-facing structural audit: not a factual verification service.
import {readFileSync} from 'node:fs';
import {auditCautionPackage} from '../src/research-audit.js';

const input=process.argv[2];
if(!input){
 console.error('Usage: node scripts/audit-caution-drafts.mjs <draft-package.json>');
 process.exitCode=2;
}else{
 try{
  const parsed=JSON.parse(readFileSync(input,'utf8'));
  const report=auditCautionPackage(parsed);
  console.log(JSON.stringify({
   ...report,
   limitation:'Source URLs and structured claims must be independently checked by a human editor. No impact levels are assigned here.'
  },null,2));
  if(!report.ok)process.exitCode=1;
 }catch(error){
  console.error('Cannot audit research package: '+error.message);
  process.exitCode=2;
 }
}
