import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

/* Exercita EXATAMENTE o adaptador ensurePhoto extraído do app.js; sem servidor ou clientes. */
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('  ensurePhoto:async(path,blob,verifyOnly=false)=>{');
const end=app.indexOf('\n  }\n };',start);
assert.ok(start>=0&&end>start,'Método ensurePhoto não encontrado no CRM');
const snippet=app.slice(start,end+4);
function adapter(fetchMock){
 const context={
  base:'https://qa.supabase.invalid',bucket:'ot-clientes-privado',
  encodePath:s=>s.split('/').map(encodeURIComponent).join('/'),
  headers:()=>({apikey:'sb_publishable_QA_MOCK',Authorization:'Bearer QA'}),
  authenticated:async()=>{},refreshSession:async()=>{},
  crypto:webcrypto,fetch:fetchMock
 };
 const factory=new Function(...Object.keys(context),
  'return ({'+snippet+'}).ensurePhoto;');
 return factory(...Object.values(context));
}
const path='11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png';
const photo=()=>new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});
const json=(status,obj)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});

test('Arquivo novo: POST antes de qualquer GET, sem x-upsert, depois hash idêntico',async()=>{
 const events=[],remote=photo();
 const upload=adapter(async(url,options={})=>{
  const method=options.method||'GET';events.push(method);
  if(method==='POST'){
   assert.equal(options.headers['Content-Type'],'image/png');
   assert.equal(options.headers['x-upsert'],undefined);
   return json(200,{Key:path});
  }
  return new Response(remote,{status:200});
 });
 await upload(path,photo());
 assert.deepEqual(events,['POST','GET']);
});
test('Retry duplicado com HTTP 400: confirma hash e não sobrescreve',async()=>{
 const events=[];
 const upload=adapter(async(url,options={})=>{
  const method=options.method||'GET';events.push(method);
  return method==='POST'?json(400,{error:'Duplicate',message:'The resource already exists'}):
   new Response(photo(),{status:200});
 });
 await upload(path,photo());
 assert.deepEqual(events,['POST','GET']);
});
test('Retry duplicado mas imagem diferente: protege a foto original',async()=>{
 const upload=adapter(async(url,options={})=>(options.method||'GET')==='POST'?
  json(409,{code:'KeyAlreadyExists',message:'file already exists'}):
  new Response(new Blob(['outra foto'],{type:'image/png'}),{status:200}));
 await assert.rejects(upload(path,photo()),/Conflito.*outra foto/);
});
test('403 do Storage: exibe causa sem remover dados locais',async()=>{
 const events=[];
 const upload=adapter(async(url,options={})=>{
  events.push(options.method||'GET');
  return json(403,{code:'AccessDenied',message:'new row violates row-level security policy'});
 });
 await assert.rejects(upload(path,photo()),/HTTP 403.*row-level security/);
 assert.deepEqual(events,['POST']);
});
test('400 por MIME inválido não é tratado como arquivo duplicado',async()=>{
 const upload=adapter(async()=>json(400,{code:'InvalidMimeType',message:'invalid mime type'}));
 await assert.rejects(upload(path,photo()),/HTTP 400.*invalid mime type/);
});
test('Falha de rede conserva pendência: adaptador não gera falso positivo',async()=>{
 const upload=adapter(async()=>{throw new TypeError('Network error')});
 await assert.rejects(upload(path,photo()),/Cópia local preservada/);
});
test('POST bem-sucedido sem confirmação de GET não é reconhecido como sincronizado',async()=>{
 const upload=adapter(async(url,options={})=>(options.method||'GET')==='POST'?
  json(200,{Key:path}):json(404,{code:'NoSuchKey'}));
 await assert.rejects(upload(path,photo()),/conferir a foto enviada \(HTTP 404\)/);
});
test('Interface guarda causa da falha e mantém pendência',()=>{
 assert.match(app,/lastSyncIssue/);
 assert.match(app,/summary\.errors\?\.\[0\]/);
 assert.match(app,/registro local preservado/);
});


test('Metadados existentes exigem SHA-256 do objeto sem reenviar arquivo',async()=>{
 const events=[];
 const upload=adapter(async(url,options={})=>{events.push(options.method||'GET');return new Response(photo(),{status:200});});
 await upload(path,photo(),true);
 assert.deepEqual(events,['GET']);
 const missing=adapter(async()=>json(404,{code:'NoSuchKey'}));
 await assert.rejects(missing(path,photo(),true),/HTTP 404/);
});
