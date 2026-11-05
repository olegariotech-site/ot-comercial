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
 function unchanged(vault){if(unlocked!==vault)throw Error('Cofre ou conta alterados durante a operação')}
 async function exclusive(fn){
  const owner=live().owner;
  if(globalThis.navigator?.locks?.request)
   return navigator.locks.request(NAME+':write:'+owner,()=>{if(live().owner!==owner)throw Error('Conta alterada');return fn()});
  return fn();
 }
 async function capacity(bytes){
  const info=await estimate();
  if(info?.quota&&Number.isFinite(info.usage)&&info.usage+bytes*2+65536>info.quota)
   throw Error('Espaço insuficiente no aparelho. Pendências existentes foram preservadas.');
 }
 function photoMetadata(info,company){
  const owner=live().owner;
  if(!info||typeof info!=='object')throw Error('Metadados inválidos');
  idValue(info.id);idValue(info.empresa_id);
  if(company&&info.empresa_id!==company)throw Error('Foto pertence a outra empresa');
  if(info.owner_id&&info.owner_id!==owner)throw Error('Foto de outro proprietário');
  const parts=String(info.storage_path||'').split('/');
  const file=/^([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(parts[2]||'');
  if(parts.length!==3||parts[0]!==owner||parts[1]!==info.empresa_id||!file)
   throw Error('Caminho de foto inválido ou de outro proprietário');
  idValue(file[1]);
  const mime={jpg:'image/jpeg',png:'image/png',webp:'image/webp'}[file[2].toLowerCase()];
  if(!Number.isSafeInteger(Number(info.bytes))||Number(info.bytes)<1||Number(info.bytes)>6*1024*1024)
   throw Error('Tamanho de foto inválido ou acima de 6 MB');
  if(info.mime&&info.mime!==mime)throw Error('Formato de imagem inválido');
  return {mime};
 }
 function validateKind(kind){if(!KINDS.includes(kind))throw Error('Tipo de registro inválido')}
 function ownerId(owner){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner))throw Error('Identificador de usuário inválido');return owner}
 function idValue(id){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('ID de registro inválido');return id}
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
  idValue(info?.empresa_id);await capacity(file.size);unchanged(vault);
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
 // Cópia cifrada da foto já existente na nuvem; NUNCA cria fila de upload.
 async function cachePhoto(info,file){
  const vault=live(),owner=vault.owner;
  if(!info||typeof info!=='object')throw Error('Metadados inválidos');
  const id=idValue(info.id),{mime}=photoMetadata(info);
  if(!(file instanceof Blob)||!file.size||file.size>6*1024*1024)
   throw Error('Foto inválida ou acima de 6 MB');
  if(Number(info.bytes)!==file.size)throw Error('Tamanho da foto diferente do registrado');
  if(!mime||(file.type&&file.type!=='application/octet-stream'&&file.type!==mime))
   throw Error('Formato de imagem inválido');
  if((await pending()).some(p=>p.kind==='photo'&&p.payload?.id===id))
   return {cached:false,skippedPending:true};
  const rec=recordKey(owner,'photo',id),bkey=blobKey(owner,id);
  try{
   const saved=await getPhoto(id);unchanged(vault);
   if(saved?.blob.size===file.size&&saved.metadata.storage_path===info.storage_path&&saved.blob.type===mime)
    return {cached:true,existing:true};
  }catch(e){unchanged(vault)}
  await capacity(file.size);unchanged(vault);
  const [recordBox,photoBox]=await Promise.all([
   seal(jsonBytes({...info,mime,bytes:file.size}),vault.key,'record:'+rec),
   seal(await file.arrayBuffer(),vault.key,'photo:'+bkey)
  ]);
  if(unlocked!==vault)throw Error('Cofre bloqueado antes de salvar a imagem');
  await operation(['records','blobs'],'readwrite',tx=>{
   tx.objectStore('records').put({key:rec,owner,kind:'photo',box:recordBox,updatedAt:Date.now()});
   tx.objectStore('blobs').put({key:bkey,owner,box:photoBox});
  });
  return {cached:true,existing:false};
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
 // Somente após lista remota COMPLETA e autorizada. Pendências locais ficam
 // intactas; não recria base nem chaves. Descarta apenas cópias já sincronizadas.
 async function reconcile(kind,records,{companyId,complete=false}={}){
  validateKind(kind);
  if(!complete||!Array.isArray(records)||records.length>5000)throw Error('Lista remota completa obrigatória');
  if(companyId)idValue(companyId);
  const vault=live(),owner=vault.owner,ids=new Set(records.map(r=>idValue(r.id)));
  if(records.some(r=>(r.owner_id&&r.owner_id!==owner)||(companyId&&r.empresa_id!==companyId)))
   throw Error('Lista remota de conta ou empresa incorreta');
  const dirty=new Set((await pending()).map(p=>p.kind+':'+p.payload.id));
  const local=await list(kind),removed=local.filter(r=>(!companyId||r.empresa_id===companyId)&&!ids.has(r.id)&&!dirty.has(kind+':'+r.id));
  const targets=[];
  for(const r of removed){
   if(kind==='company'){
    const children=[...(await list('visit')).map(x=>({kind:'visit',r:x})),...(await list('photo')).map(x=>({kind:'photo',r:x}))].filter(x=>x.r.empresa_id===r.id);
    if(children.some(x=>dirty.has(x.kind+':'+x.r.id)))continue;
    for(const child of children)targets.push({kind:child.kind,id:child.r.id});
   }
   targets.push({kind,id:r.id});
  }
  unchanged(vault);
  if(targets.length)await operation(['records','blobs'],'readwrite',tx=>{
   for(const target of targets){
    tx.objectStore('records').delete(recordKey(owner,target.kind,target.id));
    if(target.kind==='photo')tx.objectStore('blobs').delete(blobKey(owner,target.id));
   }
  });
  return targets.length;
 }
 async function has(owner){ownerId(owner);return !!(await read('meta',owner))}
 async function owners(){return (await readAll('meta')).map(meta=>meta.key).filter(id=>/^[0-9a-f-]{30,40}$/i.test(id))}
 async function get(kind,id){
  validateKind(kind);idValue(id);
  const vault=live(),key=recordKey(vault.owner,kind,id);
  const stored=await read('records',key);
  if(!stored)return null;
  const value=decode(await unseal(stored.box,vault.key,'record:'+key));unchanged(vault);return value;
 }
 async function getPhoto(id){
  const vault=live(),meta=await get('photo',id);unchanged(vault);if(!meta)return null;
  const key=blobKey(vault.owner,id),row=await read('blobs',key);
  if(!row)throw Error('Imagem pendente não encontrada no armazenamento local');
  const raw=await unseal(row.box,vault.key,'photo:'+key);
  unchanged(vault);return {metadata:meta,blob:new Blob([raw],{type:meta.mime})};
 }
 async function list(kind){
  validateKind(kind);
  const vault=live(),rows=(await readAll('records')).filter(r=>r.owner===vault.owner&&r.kind===kind);
  const result=[];
  for(const row of rows)result.push(decode(await unseal(row.box,vault.key,'record:'+row.key)));
  unchanged(vault);return result;
 }
 async function pending(){
  const vault=live(),rows=(await readAll('queue')).filter(r=>r.owner===vault.owner);
  rows.sort((a,b)=>a.createdAt-b.createdAt);
  const results=[];
  for(const row of rows){
   const payload=decode(await unseal(row.box,vault.key,'queue:'+row.key));
   results.push({opId:row.opId,kind:row.kind,attempts:row.attempts,createdAt:row.createdAt,payload});
  }
  unchanged(vault);return results;
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
 async function estimate(){return globalThis.navigator?.storage?.estimate?navigator.storage.estimate():null}
 const serialized=fn=>(...args)=>exclusive(()=>fn(...args));
 return {supported,has,owners,create,unlock,lock,activeOwner,stage:serialized(stage),stagePhoto:serialized(stagePhoto),cachePhoto:serialized(cachePhoto),snapshot:serialized(snapshot),reconcile:serialized(reconcile),photoMetadata,checkCapacity:capacity,get,getPhoto,list,pending,acknowledge:serialized(acknowledge),failed:serialized(failed),persist,estimate,uuid:uid};
})();
