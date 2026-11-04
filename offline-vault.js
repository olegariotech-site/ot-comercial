/* OT Comercial — cofre local criptografado (V1.5 Gate B).
 * Componente experimental NÃO conectado à produção.
 * Somente WebCrypto e IndexedDB; nenhuma senha/chave persistida.
 * Requer primeira ativação em sessão online autenticada pelo chamador.
 */
'use strict';
window.OTOfflineVault=(()=>{
 const NAME='ot-comercial-encrypted-vault-v1',VERSION=1;
 const KINDS=['company','visit','photo'];
 const te=new TextEncoder(),td=new TextDecoder();
 let dbPromise=null,unlocked=null;
 function supported(){return !!(window.indexedDB&&window.crypto?.subtle&&window.crypto?.getRandomValues)}
 function uid(){return crypto.randomUUID()}
 async function database(){
  if(!supported())throw Error('Criptografia ou armazenamento offline indisponível neste aparelho');
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   const r=indexedDB.open(NAME,VERSION);
   r.onupgradeneeded=()=>{
    const db=r.result;
    for(const name of ['meta','records','queue','blobs'])
     if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'key'});
   };
   r.onsuccess=()=>resolve(r.result);
   r.onerror=()=>reject(r.error||Error('Falha no IndexedDB'));
   r.onblocked=()=>reject(Error('Feche abas antigas do OT Comercial'));
  });
  return dbPromise;
 }
 async function operation(names,mode,fn){
  const db=await database();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(names,mode);let req;
   try{req=fn(tx)}catch(e){try{tx.abort()}catch{}reject(e);return}
   let result;
   if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error)}
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error||Error('Falha ao gravar no cofre'));
   tx.onabort=()=>reject(tx.error||Error('Transação cancelada'));
  });
 }
 async function read(store,key){return operation([store],'readonly',tx=>tx.objectStore(store).get(key))}
 async function readAll(store){return operation([store],'readonly',tx=>tx.objectStore(store).getAll())}
 function random(size){return crypto.getRandomValues(new Uint8Array(size))}
 async function derive(passphrase,salt){
  const base=await crypto.subtle.importKey('raw',te.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},
    base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function seal(bytes,key,aad){
  const iv=random(12);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},key,bytes);
  return {iv,cipher};
 }
 async function unseal(box,key,aad){
  return crypto.subtle.decrypt({name:'AES-GCM',iv:box.iv,additionalData:te.encode(aad)},key,box.cipher);
 }
 function live(){
  if(!unlocked)throw Error('Cofre bloqueado. Desbloqueie com sua senha local.');
  return unlocked;
 }
 function jsonBytes(obj){return te.encode(JSON.stringify(obj))}
 function decode(bytes){return JSON.parse(td.decode(bytes))}
 function recordKey(owner,kind,id){return owner+':'+kind+':'+id}
 function queueKey(owner,id){return owner+':queue:'+id}
 function blobKey(owner,id){return owner+':blob:'+id}
 function validateKind(kind){if(!KINDS.includes(kind))throw Error('Tipo de registro inválido')}
 function ownerId(owner){if(!/^[0-9a-f-]{30,40}$/i.test(owner))throw Error('Identificador de usuário inválido');return owner}
 function idValue(id){if(typeof id!=='string'||!/^[0-9a-f-]{30,40}$/i.test(id))throw Error('ID de registro inválido');return id}
 async function create(owner,passphrase){
  ownerId(owner);
  if(typeof passphrase!=='string'||passphrase.length<12)throw Error('Senha local deve ter pelo menos 12 caracteres.');
  if(await read('meta',owner))throw Error('Cofre já criado neste aparelho. Utilize Desbloquear.');
  const salt=random(16),key=await derive(passphrase,salt);
  const verifier=await seal(te.encode('OT-VAULT-OK-v1:'+owner),key,'proof:'+owner);
  await operation(['meta'],'readwrite',tx=>tx.objectStore('meta').add({key:owner,salt,verifier,iterations:310000}));
  unlocked={owner,key};return true;
 }
 async function unlock(owner,passphrase){
  // Nunca manter acesso ao cofre anterior após tentativa de troca de usuário.
  unlocked=null;
  ownerId(owner);
  const meta=await read('meta',owner);if(!meta)throw Error('Cofre não encontrado neste aparelho');
  const key=await derive(passphrase,meta.salt);
  try{
   const raw=await unseal(meta.verifier,key,'proof:'+owner);
   if(td.decode(raw)!=='OT-VAULT-OK-v1:'+owner)throw Error('Cofre inválido');
  }catch{throw Error('Senha local incorreta ou cofre danificado')}
  unlocked={owner,key};return true;
 }
 function lock(){unlocked=null}
 function activeOwner(){return unlocked?.owner||null}
 async function stage(kind,payload,action='upsert'){
  validateKind(kind);
  if(!['upsert','delete'].includes(action))throw Error('Operação inválida');
  const vault=live(),owner=vault.owner;
  if(!payload||typeof payload!=='object')throw Error('Dados inválidos');
  const id=idValue(payload.id||uid());
  const record={...payload,id};
  const opId=uid(),key=recordKey(owner,kind,id),qkey=queueKey(owner,opId);
  const recordBox=await seal(jsonBytes(record),vault.key,'record:'+key);
  const queueBox=await seal(jsonBytes({kind,action,record,id,opId}),vault.key,'queue:'+qkey);
  if(unlocked!==vault)throw Error('Cofre bloqueado durante a operação');
  await operation(['records','queue'],'readwrite',tx=>{
   tx.objectStore('records').put({key,owner,kind,box:recordBox,updatedAt:Date.now()});
   tx.objectStore('queue').add({key:qkey,owner,kind,opId,box:queueBox,createdAt:Date.now(),attempts:0});
  });
  return {id,opId,storedLocally:true};
 }
 async function stagePhoto(info,file){
  if(!(file instanceof Blob)||file.size>6*1024*1024||file.size===0)throw Error('Arquivo inválido ou acima de 6 MB');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Formato de imagem inválido');
  const vault=live(),owner=vault.owner,kind='photo';
  const id=idValue(info?.id||uid()),opId=uid(),rec=recordKey(owner,kind,id),qkey=queueKey(owner,opId),bkey=blobKey(owner,id);
  const record={...info,id,mime:file.type,bytes:file.size};
  const [meta,photo,queued]=await Promise.all([
   seal(jsonBytes(record),vault.key,'record:'+rec),
   seal(await file.arrayBuffer(),vault.key,'photo:'+bkey),
   seal(jsonBytes({kind,action:'upsert',id,opId}),vault.key,'queue:'+qkey)
  ]);
  if(unlocked!==vault)throw Error('Cofre bloqueado durante a operação');
  await operation(['records','blobs','queue'],'readwrite',tx=>{
   tx.objectStore('records').put({key:rec,owner,kind,box:meta,updatedAt:Date.now()});
   tx.objectStore('blobs').put({key:bkey,owner,box:photo});
   tx.objectStore('queue').add({key:qkey,owner,kind,opId,box:queued,createdAt:Date.now(),attempts:0});
  });
  return {id,opId,storedLocally:true};
 }
 // Cache criptografado de fichas já vistas online, SEM enfileirar reenvio.
 // Não sobrescreve registros com operações locais pendentes.
 async function snapshot(kind,records){
  validateKind(kind);
  if(!Array.isArray(records)||records.length>5000)throw Error('Lote de cache inválido');
  const vault=live(),owner=vault.owner;
  const dirty=new Set((await pending()).filter(p=>p.kind===kind).map(p=>p.payload?.id));
  const rows=[];
  for(const record of records){
   if(!record?.id||dirty.has(record.id))continue;
   const id=idValue(record.id),key=recordKey(owner,kind,id);
   const box=await seal(jsonBytes(record),vault.key,'record:'+key);
   rows.push({key,owner,kind,box,updatedAt:Date.now()});
  }
  if(unlocked!==vault)throw Error('Cofre bloqueado antes de salvar cache');
  if(!rows.length)return 0;
  await operation(['records'],'readwrite',tx=>{
   const store=tx.objectStore('records');
   let last;for(const row of rows)last=store.put(row);
   return last;
  });
  return rows.length;
 }
 async function has(owner){ownerId(owner);return !!(await read('meta',owner))}
 async function get(kind,id){
  validateKind(kind);idValue(id);
  const vault=live(),key=recordKey(vault.owner,kind,id);
  const stored=await read('records',key);
  if(!stored)return null;
  return decode(await unseal(stored.box,vault.key,'record:'+key));
 }
 async function getPhoto(id){
  const meta=await get('photo',id);if(!meta)return null;
  const vault=live(),key=blobKey(vault.owner,id),row=await read('blobs',key);
  if(!row)throw Error('Imagem pendente não encontrada no armazenamento local');
  const raw=await unseal(row.box,vault.key,'photo:'+key);
  return {metadata:meta,blob:new Blob([raw],{type:meta.mime})};
 }
 async function list(kind){
  validateKind(kind);
  const vault=live(),rows=(await readAll('records')).filter(r=>r.owner===vault.owner&&r.kind===kind);
  const result=[];
  for(const row of rows)result.push(decode(await unseal(row.box,vault.key,'record:'+row.key)));
  return result;
 }
 async function pending(){
  const vault=live(),rows=(await readAll('queue')).filter(r=>r.owner===vault.owner);
  rows.sort((a,b)=>a.createdAt-b.createdAt);
  const results=[];
  for(const row of rows){
   const payload=decode(await unseal(row.box,vault.key,'queue:'+row.key));
   results.push({opId:row.opId,kind:row.kind,attempts:row.attempts,createdAt:row.createdAt,payload});
  }
  return results;
 }
 async function acknowledge(opId){
  idValue(opId);
  const vault=live(),key=queueKey(vault.owner,opId);
  await operation(['queue'],'readwrite',tx=>tx.objectStore('queue').delete(key));
  return true;
 }
 async function failed(opId){
  idValue(opId);
  const vault=live(),key=queueKey(vault.owner,opId);
  const row=await read('queue',key);if(!row)return false;
  row.attempts++;
  await operation(['queue'],'readwrite',tx=>tx.objectStore('queue').put(row));return true;
 }
 async function persist(){return navigator.storage?.persist?navigator.storage.persist():false}
 async function estimate(){return navigator.storage?.estimate?navigator.storage.estimate():null}
 return {supported,has,create,unlock,lock,activeOwner,stage,stagePhoto,snapshot,get,getPhoto,list,pending,acknowledge,failed,persist,estimate,uuid:uid};
})();
