'use strict';
/* OT Comercial Gate B: armazenamento experimental, sem criptografia.
   NAO USAR com dados reais antes da integração e auditoria. */
window.OTOffline=(()=>{
 const dbName='ot-comercial-offline-v13', stores=['queue','companies','visits','photos'];
 let connection;
 function supported(){return !!window.indexedDB&&!!window.crypto?.randomUUID}
 function db(){
  if(!supported())return Promise.reject(Error('IndexedDB indisponivel'));
  if(!connection)connection=new Promise((resolve,reject)=>{
   const r=indexedDB.open(dbName,1);
   r.onupgradeneeded=()=>{for(const name of stores)if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'key'})};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
   r.onblocked=()=>reject(Error('Feche as outras abas do CRM'));
  });
  return connection;
 }
 async function run(store,mode,fn){const d=await db();return new Promise((resolve,reject)=>{
  const tx=d.transaction(store,mode),req=fn(tx.objectStore(store));let result;
  req.onsuccess=()=>{result=req.result};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 })}
 function key(owner,id){if(!owner||!id)throw Error('Usuario e ID obrigatorios');return owner+':'+id}
 async function save(kind,owner,record){
  if(!['companies','visits','photos'].includes(kind))throw Error('Tipo invalido');
  return run(kind,'readwrite',s=>s.put({key:key(owner,record.id),owner,record,updatedAt:Date.now()}));
 }
 async function get(kind,owner,id){const row=await run(kind,'readonly',s=>s.get(key(owner,id)));return row?.record??null}
 async function list(kind,owner){if(!stores.includes(kind))throw Error('Tipo invalido');
  const all=await run(kind,'readonly',s=>s.getAll());
  return all.filter(x=>x.owner===owner).map(x=>kind==='queue'?x:x.record);
 }
 async function enqueue(owner,kind,payload){
  if(!['company','visit','photo'].includes(kind)||!payload?.id)throw Error('Operacao invalida');
  const id=crypto.randomUUID(),row={key:key(owner,id),id,owner,kind,payload,createdAt:Date.now(),attempts:0};
  await run('queue','readwrite',s=>s.put(row));return row
 }
 async function pending(owner){return (await list('queue',owner)).sort((a,b)=>a.createdAt-b.createdAt)}
 async function acknowledge(owner,id){return run('queue','readwrite',s=>s.delete(key(owner,id)))}
 async function attempt(owner,id){const row=await run('queue','readonly',s=>s.get(key(owner,id)));if(row){row.attempts++;await run('queue','readwrite',s=>s.put(row))}}
 async function persistent(){return navigator.storage?.persist?await navigator.storage.persist():false}
 return {supported,save,get,list,enqueue,pending,acknowledge,attempt,persistent,uuid:()=>crypto.randomUUID()};
})();