/* OT Comercial V1.5 — cache de páginas públicas SOMENTE.
 * Não armazena dados do Supabase, sessões, autenticação nem responses privadas.
 * O CRM ainda exige internet para criar e recuperar fichas nesta etapa.
 */
'use strict';
const PREFIX='ot-comercial-shell-';
const CACHE=PREFIX+'v1-5-gate-b';
const PATHS=[
 './','./index.html','./style.css','./app.js','./config.js','./ot-logo.js',
 './offline-vault.js','./field-sync.js','./offline-status.js','./manifest.webmanifest',
 './apresentacao-ot.html','./apresentacao-servico.css','./card-export.js',
 './solucoes/landing.html','./solucoes/site.html','./solucoes/cardapio.html',
 './solucoes/google.html','./solucoes/catalogo.html','./solucoes/marca.html',
 './solucoes/redes.html','./solucoes/diagnostico.html','./ot-icon.svg'
];
const ROOT=new URL(self.registration.scope);
const ALLOWED=new Set(PATHS.map(p=>new URL(p,ROOT).pathname));
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(PATHS);await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const all=await caches.keys();
  await Promise.all(all.filter(x=>(x.startsWith(PREFIX)||x.startsWith('ot-comercial-v13-shell-'))&&x!==CACHE).map(x=>caches.delete(x)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!ALLOWED.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Chave canonica: nao criar copias diferentes para ?utm ou ?v.
  const key=url.origin+url.pathname;
  const cached=await cache.match(key);
  // Shell público: preferir SEMPRE a versão da rede para evitar JS antigo.
  // No modo offline, usar a última cópia já validada no cache.
  // Não intercepta APIs, sessões, fotos privadas ou rotas fora deste escopo.
  try{
   const online=await fetch(req,{cache:'no-store'});
   if(online.ok){
    // Falha por quota de cache não pode impedir a aplicação de abrir online.
    try{await cache.put(key,online.clone())}catch{}
   }
   return online;
  }catch{
   if(cached)return cached;
   throw Error('Recurso público indisponível sem conexão')
  }
 })());
});
