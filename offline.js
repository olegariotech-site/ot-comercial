/* OT Comercial V1.3 — cache privado criptografado e fila local por usuário.
   Não registra senhas, chaves JWT, tokens ou fotografias em Cache Storage.
   Uso offline exige desbloqueio local com frase secreta individual (>= 10 caracteres). */
'use strict';
window.OTOffline = (() => {
  const NAME = 'ot_comercial_offline_v13', VERSION = 1;
  let database=null, key=null, owner=null;
  const encoder=new TextEncoder(), decoder=new TextDecoder();
  function open(){
    if(!('indexedDB' in window)||!crypto?.subtle) return Promise.reject(Error('Armazenamento offline seguro indisponível neste navegador.'));
    if(database)return Promise.resolve(database);
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(NAME,VERSION);
      req.onupgradeneeded=()=>{const d=req.result;for(const n of ['settings','entities','blobs'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'});};
      req.onsuccess=()=>{database=req.result;database.onversionchange=()=>{database.close();database=null;};resolve(database);};
      req.onerror=()=>reject(req.error||Error('Falha ao abrir banco local.'));
      req.onblocked=()=>reject(Error('Feche outras abas antigas do CRM para atualizar o banco local.'));
    });
  }
  async function get(store,id){const d=await open();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readonly'),q=t.objectStore(store).get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);});}
  async function all(store){const d=await open();return new Promise((resolve,reject)=>{const q=d.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});}
  async function put(store,record){const d=await open();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).put(record);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Transação local cancelada.'));});}
  async function del(store,id){const d=await open();return new Promise((resolve,reject)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}
  const random = n => crypto.getRandomValues(new Uint8Array(n));
  const bytes = s => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const b64 = b => btoa(String.fromCharCode(...b));
  async function derive(pass,salt){const k=await crypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
  async function seal(payload){if(!key)throw Error('Desbloqueie o modo offline.');const iv=random(12),plain=payload instanceof ArrayBuffer?payload:encoder.encode(JSON.stringify(payload));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);return {iv:iv.buffer,encrypted};}
  async function unseal(rec,binary=false){if(!key)throw Error('Desbloqueie o modo offline.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:rec.iv},key,rec.encrypted);return binary?plain:JSON.parse(decoder.decode(plain));}
  async function profile(){return get('settings','profile');}
  async function activate(userId,pass){
    if(!userId||!pass||pass.length<10)throw Error('Use uma frase offline com pelo menos 10 caracteres.');
    if(await profile())throw Error('Já existe um cofre offline neste navegador. Desbloqueie com a frase original.');
    const salt=random(16),k=await derive(pass,salt),iv=random(12);
    const verifier=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,encoder.encode('OT_COMERCIAL_OFFLINE_V13:'+userId));
    await put('settings',{id:'profile',userId,salt:b64(salt),iv:iv.buffer,encrypted:verifier});owner=userId;key=k;return true;
  }
  async function unlock(pass){const p=await profile();if(!p)throw Error('Modo offline ainda não ativado neste aparelho.');
    try{const k=await derive(pass,bytes(p.salt));const v=decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:p.iv},k,p.encrypted));if(v!=='OT_COMERCIAL_OFFLINE_V13:'+p.userId)throw Error('Inválido');owner=p.userId;key=k;return owner;}
    catch{throw Error('Frase offline incorreta. Os dados continuam protegidos.');}
  }
  function lock(){key=null;owner=null;}
  function ready(userId){return !!(key&&owner&&(!userId||owner===userId));}
  function user(){return owner;}
  async function save(kind,id,data,meta={}){if(!ready())throw Error('Modo offline bloqueado.');const s=await seal({data,meta});await put('entities',{id:`${owner}:${kind}:${id}`,owner,kind,entityId:id,...s});}
  async function read(kind,id){if(!ready())throw Error('Modo offline bloqueado.');const r=await get('entities',`${owner}:${kind}:${id}`);return r?unseal(r):null;}
  async function list(kind){if(!ready())return [];const a=await all('entities');const mine=a.filter(r=>r.owner===owner&&r.kind===kind);return Promise.all(mine.map(async r=>({id:r.entityId,...await unseal(r)})));}
  async function remove(kind,id){if(!ready())throw Error('Modo offline bloqueado.');await del('entities',`${owner}:${kind}:${id}`);}
  async function storeImage(id,blob){if(!ready())throw Error('Modo offline bloqueado.');const sealed=await seal(await blob.arrayBuffer());await put('blobs',{id:`${owner}:photo:${id}`,owner,...sealed,type:blob.type});}
  async function image(id){if(!ready())return null;const r=await get('blobs',`${owner}:photo:${id}`);return r?new Blob([await unseal(r,true)],{type:r.type}):null;}
  async function removeImage(id){if(!ready())return;await del('blobs',`${owner}:photo:${id}`);}
  async function countPending(){if(!ready())return 0;const kinds=['company','visit','photo'];const listAll=await Promise.all(kinds.map(list));return listAll.flat().filter(x=>x.meta?.state&&x.meta.state!=='synced').length;}
  async function persistPermission(){if(navigator.storage?.persist)return navigator.storage.persist();return false;}
  return {open,profile,activate,unlock,lock,ready,user,save,read,list,remove,storeImage,image,removeImage,countPending,persistPermission};
})();