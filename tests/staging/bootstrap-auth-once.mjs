/**
 * One-time signup of two staging-only test users using the public Supabase Auth API.
 * No admin credentials, no production calls, no PII besides controlled OT inbox.
 * Generated passwords are ephemeral, never logged, committed, or persisted.
 * Confirm via OT inbox and then set a new password with Supabase Auth recovery.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import {randomBytes} from 'node:crypto';
const configSource=fs.readFileSync(new URL('./config.public.js',import.meta.url),'utf8');
const scope={window:{}};vm.runInNewContext(configSource,scope);
const config=scope.window.OT_CONFIG;
if(config.url!=='https://efscgxwvaixwqhffwdqu.supabase.co')
 throw Error('ABORT: unexpected Supabase project');
if(!config.publishableKey?.startsWith('sb_publishable_'))
 throw Error('ABORT: invalid publishable key');
const emails=[
 'olegariotech.oficial+otqa-20261104-a@gmail.com',
 'olegariotech.oficial+otqa-20261104-b@gmail.com'
];
if(process.env.OT_CREATE_TEST_USERS!=='authorized-once')
 throw Error('Explicit one-time automation gate not enabled');
for(let index=0;index<emails.length;index++){
 const password='OTqa-'+randomBytes(24).toString('base64url')+'!5aB';
 const response=await fetch(config.url+'/auth/v1/signup',{
  method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},
  body:JSON.stringify({email:emails[index],password}),
  signal:AbortSignal.timeout(15000)
 });
 const obj=await response.json().catch(()=>({}));
 if(!response.ok){
  const errorType=String(obj.code||obj.error_code||obj.error||response.status);
  // Never log bearer tokens or passwords; if rate-limited stop (do not retry).
  console.error('QA AUTH signup '+(index+1)+' rejected: HTTP '+response.status+' '+errorType);
  process.exitCode=1;break;
 }
 if(!obj.user?.id||obj.user?.email!==emails[index])
  throw Error('QA Auth returned no matching user for '+(index+1));
 console.log('QA AUTH signup '+(index+1)+': user created (confirmation required='+
  (!obj.access_token)+')');
}
