/* OT Comercial V1.3 — precache EXCLUSIVAMENTE dos arquivos públicos do aplicativo.
 * Nunca armazenar respostas Supabase, credenciais, dados ou fotografias no Cache Storage. */
'use strict';
const CACHE='ot-comercial-shell-v1.3-rc1';
const SHELL=['./','./index.html','./style.css','./config.js','./offline.js','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>event.waitUntil(
  Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ot-comercial-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])
));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  // Arquivos estáticos do app: cache first. Rede após atualização no próximo deploy.
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});