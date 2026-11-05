/* Gate B — testes de criptografia reais (Node WebCrypto) com simulador
 * de transações IndexedDB. QA físico Android/iOS continua obrigatório.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

function indexedDBMemory(){
 const stores=new Map();
 const db={
  objectStoreNames:{contains(name){return stores.has(name)}},
  createObjectStore(name){if(!stores.has(name))stores.set(name,new Map());},
  transaction(names){
   const jobs=[];
   const tx={
    error:null,oncomplete:null,onerror:null,onabort:null,
    objectStore(name){
     const s=stores.get(name);
     if(!s)throw Error('Store inexistente: '+name);
     const request=fn=>{
      const req={onsuccess:null,onerror:null,result:undefined,error:null};
      jobs.push({req,fn});return req;
     };
     return {
      get:key=>request(()=>structuredClone(s.get(key))),
      getAll:()=>request(()=>Array.from(s.values(),x=>structuredClone(x))),
      put:row=>request(()=>{s.set(row.key,structuredClone(row));return row.key}),
      add:row=>request(()=>{
       if(s.has(row.key))throw Error('Duplicate key '+row.key);
       s.set(row.key,structuredClone(row));return row.key;
      }),
      delete:key=>request(()=>{s.delete(key);return undefined})
     };
    },
    abort(){tx.onabort?.()}
   };
   setImmediate(()=>{
    try{
     for(const job of jobs){
      const result=job.fn();
      job.req.result=result;
      job.req.onsuccess?.();
     }
     tx.oncomplete?.();
    }catch(e){
     tx.error=e;tx.onerror?.();tx.onabort?.();
    }
   });
   return tx;
  }
 };
 return {
  stores,
  open(){
   const req={onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null,result:null};
   setImmediate(()=>{
    req.result=db;
    req.onupgradeneeded?.();
    req.onsuccess?.();
   });
   return req;
  }
 };
}
async function run(){
 const fakeDB=indexedDBMemory();
 const source=fs.readFileSync(new URL('../offline-vault.js',import.meta.url),'utf8');
 const scope={
  window:{indexedDB:fakeDB,crypto:webcrypto},
  indexedDB:fakeDB,crypto:webcrypto,TextEncoder,TextDecoder,Blob,Uint8Array,
  console,Error,Date,JSON,Promise,ArrayBuffer,Math
 };
 vm.runInNewContext(source,scope,{filename:'offline-vault.js'});
 const vault=scope.window.OTOfflineVault;
 assert.equal(vault.supported(),true);
 const owner='11111111-1111-4111-8111-111111111111';
 const pass='OT_Vault_SenhaForte_2026!';
 await vault.create(owner,pass);
 assert.equal(vault.activeOwner(),owner);
 const company=await vault.stage('company',{nome:'LOJA_TESTE_PRIVADA',briefing:'SITE E GOOGLE'});
 const visit=await vault.stage('visit',{empresa_id:company.id,nota:'Visita fictícia'});
 const photo=await vault.stagePhoto({empresa_id:company.id,arquivo_nome:'teste.png',categoria:'Fachada'},
  new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}));
 assert.equal(company.storedLocally,true);
 assert.equal(visit.storedLocally,true);
 assert.equal(photo.storedLocally,true);
 assert.equal((await vault.pending()).length,3);
 assert.equal((await vault.get('company',company.id)).nome,'LOJA_TESTE_PRIVADA');
 assert.equal((await vault.list('company')).length,1);
 const image=await vault.getPhoto(photo.id);
 assert.equal(image.blob.size,8);
 assert.equal(image.metadata.categoria,'Fachada');
 const raw=fakeDB.stores.get('records').get(owner+':company:'+company.id);
 assert.ok(raw.box.iv&&raw.box.cipher);
 assert.ok(!JSON.stringify(raw).includes('LOJA_TESTE_PRIVADA'));
 assert.ok(!JSON.stringify(raw).includes('SITE E GOOGLE'));
 const vaultMeta=fakeDB.stores.get('meta').get(owner);
 assert.ok(!JSON.stringify(vaultMeta).includes(pass));
 vault.lock();
 assert.equal(vault.activeOwner(),null);
 await assert.rejects(vault.get('company',company.id));
 await assert.rejects(vault.unlock(owner,'OT_SENHA_ERRADA_LONGA!'));
 await vault.unlock(owner,pass);
 assert.equal((await vault.get('company',company.id)).nome,'LOJA_TESTE_PRIVADA');
 await vault.acknowledge(company.opId);
 assert.equal((await vault.pending()).length,2);
 await vault.failed(visit.opId);
 const retries=(await vault.pending()).find(p=>p.opId===visit.opId);
 assert.equal(retries.attempts,1);
 await assert.rejects(vault.stagePhoto({},new Blob([new Uint8Array(7*1024*1024)],{type:'image/png'})));
 const cloudId='55555555-5555-4555-8555-555555555555';
 const cloudBytes=new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});
 const cloudMeta={id:cloudId,empresa_id:company.id,
  storage_path:owner+'/'+company.id+'/'+cloudId+'.png',
  arquivo_nome:'original-do-desktop.png',categoria:'Fachada',bytes:8,publicacao_autorizada:false};
 const prior=(await vault.pending()).length;
 const saved=await vault.cachePhoto(cloudMeta,cloudBytes);
 assert.equal(saved.cached,true);
 assert.equal((await vault.pending()).length,prior,'Cache remoto NÃO pode criar fila de upload');
 assert.equal((await vault.getPhoto(cloudId)).blob.size,8);
 assert.equal((await vault.cachePhoto(cloudMeta,cloudBytes)).existing,true);
 assert.equal((await vault.pending()).length,prior,'Releitura NÃO pode duplicar pendências');
 const cloudStored=fakeDB.stores.get('blobs').get(owner+':blob:'+cloudId);
 assert.ok(cloudStored.box.iv&&cloudStored.box.cipher);
 assert.ok(!JSON.stringify(cloudStored).includes('original-do-desktop.png'));
 await assert.rejects(vault.cachePhoto({...cloudMeta,storage_path:'outro-dono/'+cloudId+'.png'},cloudBytes));
 await assert.rejects(vault.cachePhoto({...cloudMeta,bytes:9000},cloudBytes));
 await vault.acknowledge(photo.opId);
 assert.equal((await vault.getPhoto(photo.id)).blob.size,8,'Foto enviada deve permanecer disponível offline');
 vault.lock();
 await vault.unlock(owner,pass);
 assert.equal((await vault.getPhoto(cloudId)).blob.size,8,'Foto remota cifrada deve sobreviver a reabertura do cofre');
 console.log('COFRE AES-GCM: fotos antigas e locais acessíveis offline; cache sem fila de upload.');
}
await run();
