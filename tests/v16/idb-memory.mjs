export function indexedDBMemory(){
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
