import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('async function cacheHistoryForField(){');
const end=app.indexOf('\nasync function prepareVault(){',start);
assert.ok(start>=0&&end>start,'Preparacao offline nao encontrada');
const functionSource=app.slice(start,end);
const fakeVisit=id=>({id,empresa_id:'22222222-2222-4222-8222-222222222222',nota:'Visita QA'});
const v1=fakeVisit('33333333-3333-4333-8333-333333333333');
const v2=fakeVisit('44444444-4444-4444-8444-444444444444');
function harness({rows=[v1,v2],enabled=true,online=true,storageFails=false,missing=false}={}){
 const local=[],calls=[];
 const vault={
  async snapshot(kind,items){
   calls.push('snapshot:'+kind);
   if(storageFails)throw Error('Quota exceeded');
   local.splice(0,local.length,...items);
   return items.length;
  },
  async list(kind){
   assert.equal(kind,'visit');
   calls.push('list:'+kind);
   return missing?local.slice(0,1):local.slice();
  }
 };
 const request=async path=>{
  calls.push('request:'+path);
  assert.match(path,/ot_visitas\?select=\*&order=realizado_em.desc&limit=201/);
  return rows;
 };
 const create=new Function('fieldReady','offlineMode','navigator','request','window','Error',
  functionSource+'\nreturn cacheHistoryForField;');
 const action=create(()=>enabled,false,{onLine:online},request,{OTOfflineVault:vault},Error);
 return {action,local,calls};
}
test('Novo cofre salva e confirma duas visitas ja existentes na nuvem',async()=>{
 const h=harness();
 const result=await h.action();
 assert.deepEqual(result,{checked:true,count:2,partial:false});
 assert.equal(h.local.length,2);
 assert.deepEqual(h.calls,['request:ot_visitas?select=*&order=realizado_em.desc&limit=201','snapshot:visit','list:visit']);
});
test('Sem rede ou cofre bloqueado nenhuma consulta e feita',async()=>{
 for(const options of [{online:false},{enabled:false}]){
  const h=harness(options);
  assert.deepEqual(await h.action(),{checked:false,count:0,partial:false});
  assert.deepEqual(h.calls,[]);
 }
});
test('Falha de armazenamento nao pode ser anunciada como sucesso',async()=>{
 const h=harness({storageFails:true});
 await assert.rejects(h.action(),/Quota exceeded/);
});
test('Nao confirmar se alguma visita do servidor ficou ausente no cofre',async()=>{
 const h=harness({missing:true});
 await assert.rejects(h.action(),/Nao foi possivel confirmar|Não foi possível confirmar/);
});
test('Limite explicito sinaliza historico parcial, sem prometer completude',async()=>{
 const rows=Array.from({length:201},(_,i)=>fakeVisit('a'.repeat(8)+'-'+String(i).padStart(4,'0')+'-4444-8444-444444444444'));
 const h=harness({rows});
 const r=await h.action();
 assert.equal(r.count,200);
 assert.equal(r.partial,true);
 assert.equal(h.local.length,200);
});
test('Interface anuncia o numero de visitas reais no cofre, nao so pendencias',()=>{
 assert.match(app,/offlineVisits=\(await window\.OTOfflineVault\.list\('visit'\)\)\.length/);
 assert.match(app,/histórico offline NÃO confirmado|hist[oó]rico offline N[AÃ]O confirmado/);
 assert.match(app,/Histórico online visível, mas cópia offline NÃO confirmada/);
});
