import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=app.indexOf('async function preparePhotoGalleryOffline(){');
const end=app.indexOf('\nfunction renderPhotoCards(){',start);
assert.ok(start>=0&&end>start,'Ação de preparo das fotos não encontrada');
const src=app.slice(start,end);
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const ids=['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'];
const files=ids.map((id,i)=>({id,empresa_id:company,bytes:i+8,storage_path:owner+'/'+company+'/'+id+'.png'}));

function create({online=true,unlocked=true,existing=[0,1],networkFail=false,wrongSize=false}={}){
 const state=new Map(existing.map(i=>[ids[i],new Blob([new Uint8Array(i+8)],{type:'image/png'})]));
 const calls=[],notifications=[],btn={disabled:false},output={textContent:''};
 const deps={
  galleryBusy:false,userId:owner,cloudRows:async()=>files,
  active:{id:company},offlineMode:false,navigator:{onLine:online},
  fieldReady:()=>unlocked,
  $:id=>id==='preparePhotoOfflineBtn'?btn:output,
  request:async(path,opts)=>{
   calls.push(path);
   if(path.startsWith('ot_fotos?'))return files;
   if(networkFail)throw Error('Falha de rede controlada');
   const i=files.findIndex(f=>path.includes(f.id));
   assert.ok(i>=0,'Foto inesperada');
   return {blob:async()=>new Blob([new Uint8Array(wrongSize?1:i+8)],{type:'image/png'})};
  },
  OTOfflineVault:{
   photoMetadata:(p,id)=>assert.equal(p.empresa_id,id),
   getPhoto:async id=>state.has(id)?{blob:state.get(id),metadata:files.find(f=>f.id===id)}:null,
   cachePhoto:async(p,blob)=>{assert.equal(p.id,ids[2]);if(blob.size!==p.bytes)throw Error('Tamanho diferente');state.set(p.id,blob);return {cached:true}},
  },
  bucket:'ot-clientes-privado',encodePath:p=>p,
  loadPhotos:async id=>{assert.equal(id,company);calls.push('reload')},
  safeErr:e=>e.message,
  toast:message=>notifications.push(message)
 };
 const names=Object.keys(deps);
 const factory=new Function(...names,src+'\nreturn preparePhotoGalleryOffline;');
 return {run:factory(...Object.values(deps)),btn,output,calls,notifications,state};
}

test('Prepara 3/3 recuperando apenas a foto ausente; nenhuma escrita na nuvem',async()=>{
 const h=create();await h.run();
 assert.equal(h.output.textContent,'3 de 3 fotos disponíveis offline — confirmado.');
 assert.ok(h.state.has(ids[2]));
 assert.equal(h.calls.filter(x=>x.includes('/object/')||x.startsWith('object/')).length,1);
 assert.equal(h.calls.filter(x=>/POST|PATCH|DELETE/i.test(x)).length,0);
 assert.equal(h.btn.disabled,false);
});
test('Falha de rede não gera sucesso falso: informa 2/3',async()=>{
 const h=create({networkFail:true});await h.run();
 assert.match(h.output.textContent,/2 de 3 fotos offline/);
 assert.match(h.output.textContent,/Falha de rede controlada/);
 assert.equal(h.state.size,2);
 assert.equal(h.btn.disabled,false);
});
test('Mismatch de tamanho informa erro e preserva as duas fotos locais',async()=>{
 const h=create({wrongSize:true});await h.run();
 assert.match(h.output.textContent,/2 de 3 fotos offline/);
 assert.equal(h.state.size,2);
});
test('Sem rede ou sem cofre não solicita arquivos',async()=>{
 for(const opts of [{online:false},{unlocked:false}]){
  const h=create(opts);await h.run();
  assert.equal(h.calls.length,0);
  assert.match(h.output.textContent,/Conecte a nuvem/);
 }
});
test('Ação explícita está ligada a um botão real na galeria',()=>{
 assert.match(html,/id="preparePhotoOfflineBtn"/);
 assert.match(html,/id="photoCacheState"/);
 assert.match(app,/\$\('preparePhotoOfflineBtn'\)\.addEventListener\('click',preparePhotoGalleryOffline\)/);
});
