'use strict';
// Cache SOMENTE do shell público; jamais requests da API Supabase.
const VERSION='ot-comercial-v13-shell-1';
const ASSETS=['./','./index.html','./style.css','./config.js','./app.js','./offline-store.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('ot-comercial-v13-shell-')&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 const allowed=new Set(['/ot-comercial/','/ot-comercial/index.html','/ot-comercial/style.css','/ot-comercial/config.js','/ot-comercial/app.js','/ot-comercial/offline-store.js','/ot-comercial/manifest.webmanifest']);
 if(!allowed.has(url.pathname))return;
 e.respondWith((async()=>{const c=await caches.open(VERSION);return await c.match(req,{ignoreSearch:true})||fetch(req)})());
});