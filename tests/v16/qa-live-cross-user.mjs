/* Gate HTTP REAL opcional e estritamente QA. Usa apenas UUIDs fictícios exclusivos. */
import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import fs from 'node:fs';import vm from 'node:vm';
const ref='efscgxwvaixwqhffwdqu',base='https://'+ref+'.supabase.co',bucket='ot-clientes-privado';
const names=['OT_QA_EMAIL','OT_QA_PASSWORD','OT_QA_EMAIL_2','OT_QA_PASSWORD_2'];
if(names.some(k=>!process.env[k])){console.log('PENDENTE: credenciais protegidas de dois titulares QA não disponíveis. Nenhuma requisição efetuada.');process.exit(2)}
const w={};vm.runInNewContext(fs.readFileSync(new URL('../staging/config.public.js',import.meta.url),'utf8'),{window:w});assert.equal(w.OT_CONFIG.url,base);const key=w.OT_CONFIG.publishableKey;assert.ok(key.startsWith('sb_publishable_'));
const req=async(method,path,token,data)=>{const r=await fetch(base+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json',Prefer:'return=representation'}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20000)});const txt=await r.text();let body;try{body=JSON.parse(txt)}catch{}return {status:r.status,ok:r.ok,data:body}};
async function login(n){const r=await req('POST','/auth/v1/token?grant_type=password',null,{email:process.env[n?'OT_QA_EMAIL_2':'OT_QA_EMAIL'],password:process.env[n?'OT_QA_PASSWORD_2':'OT_QA_PASSWORD']});assert.equal(r.status,200,'Auth QA falhou');return {owner:r.data.user.id,token:r.data.access_token,refresh:r.data.refresh_token}}
const a=await login(0),b=await login(1);assert.notEqual(a.owner,b.owner);
const company=randomUUID(),companyB=randomUUID(),entity=randomUUID(),event=randomUUID(),child=randomUUID(),photo=randomUUID();
const photoPath=a.owner+'/'+company+'/'+photo+'.png',route='/storage/v1/object/'+bucket+'/'+photoPath,png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+jVwAAAAASUVORK5CYII=','base64');
const op={id:event,empresa_id:company,entity_id:entity,entity_type:'opportunity',parent_id:null,occurred_at:new Date().toISOString(),data:{titulo:'QA V16 HTTP',estagio:'diagnostico',recorrencia_status:'nao_contratada'}};
const storage=async(method,token,body)=>fetch(base+route,{method,headers:{apikey:key,Authorization:'Bearer '+token,...(body?{'Content-Type':'image/png'}:{})},body,signal:AbortSignal.timeout(20000)});
let success=false;
try{
 for(const [id,user] of [[company,a],[companyB,b]])assert.equal((await req('POST','/rest/v1/ot_empresas',user.token,{id,nome:'QA V16 HTTP '+id.slice(0,8),briefing:'Fixture exclusiva; nenhum cliente real'})).status,201);
 assert.equal((await req('POST','/rest/v1/ot_comercial_eventos',a.token,op)).status,201);
 assert.equal((await req('GET','/rest/v1/ot_comercial_eventos?id=eq.'+event,b.token)).data.length,0);
 for(const verb of ['PATCH','DELETE'])assert.ok([401,403].includes((await req(verb,'/rest/v1/ot_comercial_eventos?id=eq.'+event,b.token,verb==='PATCH'?{data:{}}:undefined)).status));
 assert.equal((await req('POST','/rest/v1/ot_comercial_eventos',b.token,{...op,id:randomUUID(),owner_id:a.owner})).status,403);
 assert.ok([400,409].includes((await req('POST','/rest/v1/ot_comercial_eventos',b.token,{id:randomUUID(),empresa_id:companyB,entity_id:randomUUID(),entity_type:'action',parent_id:null,occurred_at:new Date().toISOString(),data:{descricao:'Associação indevida',estado:'aberta',tipo:'retorno',oportunidade_id:entity}})).status));
 assert.equal((await req('POST','/rest/v1/ot_comercial_eventos',a.token,{...op,id:child,parent_id:event,data:{...op.data,estagio:'proposta'}})).status,201);
 assert.equal((await req('POST','/rest/v1/ot_comercial_eventos',a.token,{...op,id:randomUUID(),parent_id:event})).status,409);
 assert.equal((await req('POST','/rest/v1/ot_comercial_eventos',a.token,op)).status,409);
 assert.ok([401,403].includes((await req('GET','/rest/v1/ot_comercial_eventos?limit=1',null)).status));
 assert.equal((await storage('POST',a.token,png)).status,200);
 const get=token=>fetch(base+'/storage/v1/object/authenticated/'+bucket+'/'+photoPath,{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 assert.ok([400,401,403,404].includes((await get(b.token)).status));
 await storage('DELETE',b.token);const original=await get(a.token);assert.equal(original.status,200,'Delete cross-user afetou arquivo');assert.equal(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),createHash('sha256').update(png).digest('hex'));
 assert.ok([400,401,403,409].includes((await storage('POST',b.token,png)).status));
 const renewed=await req('POST','/auth/v1/token?grant_type=refresh_token',null,{refresh_token:a.refresh});assert.equal(renewed.status,200,'Refresh QA falhou');a.token=renewed.data.access_token;
 success=true;
}finally{
 // UUIDs exclusivos desta execução, mesmo em resposta perdida; nunca filtro amplo.
 const removed=await storage('DELETE',a.token);assert.ok(removed.ok||[400,404].includes(removed.status),'Limpeza de objeto QA falhou');
 for(const [id,user] of [[company,a],[companyB,b]]){const r=await req('DELETE','/rest/v1/ot_empresas?id=eq.'+id,user.token);assert.ok(r.ok,'Limpeza de empresa QA falhou');assert.equal((await req('GET','/rest/v1/ot_empresas?id=eq.'+id,user.token)).data.length,0)}
 assert.equal((await req('GET','/rest/v1/ot_comercial_eventos?id=eq.'+event,a.token)).data.length,0,'Cascade deixou fixture');
}
if(success)console.log('PASS HTTP QA: Auth/refresh A/B, eventos imutáveis, FK, owner forjado, fork/idempotência, Storage A/B e limpeza confirmada.');
