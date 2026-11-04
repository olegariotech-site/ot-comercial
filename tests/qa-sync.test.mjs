import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../field-sync.js',import.meta.url),'utf8');
const win={};
vm.runInNewContext(source,{window:win,Error,Date,Map,Set,Uint8Array,ArrayBuffer,console});
const sync=win.OTFieldSync;
const owner='11111111-1111-4111-8111-111111111111';
const companyId='22222222-2222-4222-8222-222222222222';
const visitId='33333333-3333-4333-8333-333333333333';
const photoId='44444444-4444-4444-8444-444444444444';
const company={id:companyId,nome:'Cliente de teste',briefing:'Criar site profissional',
  segmento:'Comércio',bairro:'São Marcos',cidade:'Valinhos',endereco:'Teste',
  responsavel:'Teste',whatsapp:'',presenca_digital:'',observacoes:'',status:'Primeira visita',retorno_em:null};
const visit={id:visitId,empresa_id:companyId,nota:'Falei com o responsável',
  proximo_passo:'Enviar portfólio',retorno_em:'2026-11-09',realizado_em:'2026-11-04T15:00:00.000Z'};
const photo={id:photoId,empresa_id:companyId,arquivo_nome:'teste.png',
  categoria:'Fachada',descricao:'',mime:'image/png',bytes:4,publicacao_autorizada:false};

function environment(entries){
 const queue=entries.map((e,i)=>({kind:e.kind,payload:{id:e.data.id,record:e.data,action:'upsert'},opId:String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',
  createdAt:i,attempts:0}));
 const data=new Map(entries.map(e=>[e.kind+':'+e.data.id,e.data]));
 const remote=new Map(),objects=new Map(),calls=[],returns=[];
 const vault={
  activeOwner:()=>owner,
  async pending(){return queue.map(x=>({...x}))},
  async get(kind,id){return data.get(kind+':'+id)||null},
  async getPhoto(id){return {metadata:data.get('photo:'+id),blob:{size:4,type:'image/png'}}},
  async acknowledge(opId){const i=queue.findIndex(x=>x.opId===opId);if(i>=0)queue.splice(i,1)},
  async failed(opId){const q=queue.find(x=>x.opId===opId);if(q)q.attempts++}
 };
 const api={
  owner,
  async getRow(table,id){calls.push('GET '+table+':'+id);return remote.get(table+':'+id)||null},
  async insertRow(table,row){calls.push('POST '+table+':'+row.id);
   if(table==='ot_visitas'&&!remote.get('ot_empresas:'+row.empresa_id))throw Error('FK empresa ausente');
   remote.set(table+':'+row.id,{...row});},
  async ensurePhoto(path,blob){calls.push('PHOTO '+path);
   if(!objects.has(path))objects.set(path,blob);
  },
  async updateReturn(id,date){calls.push('RETURN '+id);returns.push(date)}
 };
 return {vault,api,remote,objects,queue,calls,returns};
}
test('Criação offline de empresa sincroniza uma vez com ID fixo',async()=>{
 const env=environment([{kind:'company',data:company}]);
 const result=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(result.synced,1);assert.equal(result.pending,0);
 assert.equal(env.queue.length,0);
 assert.equal(env.remote.size,1);
 assert.equal(env.api.owner,owner);
 assert.equal((await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true})).total,0);
});
test('Resposta perdida após POST não cria empresa duplicada',async()=>{
 const env=environment([{kind:'company',data:company}]);
 const original=env.api.insertRow;
 let once=true;
 env.api.insertRow=async(...args)=>{await original(...args);if(once){once=false;throw Error('Timeout depois do commit')}};
 const result=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(result.synced,1);assert.equal(env.remote.size,1);assert.equal(env.queue.length,0);
});
test('Visita só confirma após atualizar retorno e retenta sem duplicar',async()=>{
 const env=environment([{kind:'company',data:company},{kind:'visit',data:visit}]);
 let first=true;
 const update=env.api.updateReturn;
 env.api.updateReturn=async(...args)=>{if(first){first=false;throw Error('Sem internet após visita')}return update(...args)};
 const a=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(a.synced,1);assert.equal(a.failed,1);
 assert.equal(env.queue.length,1);assert.equal(env.remote.size,2);
 const b=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(b.synced,1);assert.equal(b.pending,0);
 assert.equal(env.remote.size,2);assert.deepEqual(env.returns,['2026-11-09']);
});
test('Foto após upload parcial retoma metadados sem duplicação',async()=>{
 const env=environment([{kind:'company',data:company},{kind:'photo',data:photo}]);
 let failed=false;
 const orig=env.api.insertRow;
 env.api.insertRow=async(table,row)=>{
  if(table==='ot_fotos'&&!failed){failed=true;throw Error('Erro no envio de metadados')}
  return orig(table,row);
 };
 const a=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(a.synced,1);assert.equal(a.failed,1);
 assert.equal(env.objects.size,1);assert.equal(env.remote.size,1);
 const b=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(b.synced,1);assert.equal(env.objects.size,1);
 assert.equal(env.remote.size,2);assert.equal(env.queue.length,0);
 const remotePhoto=env.remote.get('ot_fotos:'+photoId);
 assert.equal(remotePhoto.storage_path,owner+'/'+companyId+'/'+photoId+'.png');
});
test('Conflito por mesmo ID e registro diferente não apaga pendência',async()=>{
 const env=environment([{kind:'company',data:company}]);
 env.remote.set('ot_empresas:'+companyId,{id:companyId,nome:'Outro cliente',briefing:'Diferente'});
 const r=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(r.failed,1);assert.equal(r.synced,0);assert.equal(env.queue.length,1);
});
test('Operações embaralhadas são sincronizadas na ordem empresa, visita, foto',async()=>{
 const env=environment([{kind:'photo',data:photo},{kind:'visit',data:visit},{kind:'company',data:company}]);
 const r=await sync.sync({vault:env.vault,api:env.api,owner,online:()=>true});
 assert.equal(r.synced,3);assert.equal(r.pending,0);
 const posts=env.calls.filter(x=>x.startsWith('POST '));
 assert.deepEqual(posts.map(x=>x.split(':')[0]),['POST ot_empresas','POST ot_visitas','POST ot_fotos']);
});
test('Sem conexão e sessão errada não enviam nenhum dado',async()=>{
 const env=environment([{kind:'company',data:company}]);
 await assert.rejects(sync.sync({vault:env.vault,api:env.api,owner,online:()=>false}));
 assert.equal(env.calls.length,0);
 env.api.owner='55555555-5555-4555-8555-555555555555';
 await assert.rejects(sync.sync({vault:env.vault,api:env.api,owner,online:()=>true}));
 assert.equal(env.calls.length,0);assert.equal(env.queue.length,1);
});
