import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=file('index.html'),sw=file('sw.js'),manifest=JSON.parse(file('manifest.webmanifest'));
const workflow=file('.github/workflows/deploy-pages.yml');
const style=file('style.css'),app=file('app.js'),store=file('offline-vault.js');

test('Versão integrada preserva o CRM Premium e registra apenas shell público',()=>{
 assert.match(html,/OT Comercial V1\.5/);
 assert.match(html,/class="btn ot-presentation"/);
 assert.match(html,/rel="manifest" href="manifest\.webmanifest"/);
 assert.match(html,/offline-vault\.js/);
 assert.match(html,/offline-status\.js/);
 assert.match(html,/serviceWorker\.register\("\.\/sw\.js"\)/);
 assert.match(html,/Modo campo em homologação/);
 assert.match(style,/offline-notice\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(app,/OTOffline\./,'Não integrar módulo sem criptografia a dados reais');
 assert.match(store,/AES-GCM/);
 assert.match(store,/PBKDF2/);
 assert.match(app,/OTOfflineVault\./);
 assert.match(workflow,/cp sw\.js offline-vault\.js field-sync\.js offline-status\.js manifest\.webmanifest ot-icon\.svg _site\//);
 assert.match(workflow,/branches:\s*\[main\]/,'Nenhum deploy automático a partir desta branch');
 assert.equal(manifest.scope,'./');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.icons[0].src,'./ot-icon.svg');
 assert.match(file('ot-icon.svg'),/data:image\/webp;base64,UklGR/);
});

test('Worker não intercepta Supabase e só cacheia arquivos públicos dentro do escopo',async()=>{
 const listeners={}; const cached=[];let response;
 const sampleResponse={ok:true,clone(){return this}};
 const cachedResponse={cached:true};
 const cache={addAll:async paths=>{cached.push(...paths)},match:async()=>cachedResponse,put:async()=>{}};
 const self={
  registration:{scope:'https://olegariotech-site.github.io/ot-comercial/'},
  location:{origin:'https://olegariotech-site.github.io'},
  addEventListener(name,handler){listeners[name]=handler},
  skipWaiting:async()=>{},clients:{claim:async()=>{}}
 };
 const caches={
  open:async()=>cache,keys:async()=>[],
  delete:async()=>true
 };
 vm.runInNewContext(sw,{self,caches,URL,fetch:async()=>sampleResponse,Error});
 assert.ok(listeners.install&&listeners.activate&&listeners.fetch);
 let installing;listeners.install({waitUntil(p){installing=p}});await installing;
 assert.ok(cached.includes('./index.html'));
 assert.ok(cached.includes('./apresentacao-ot.html'));
 assert.ok(cached.includes('./solucoes/cardapio.html'));
 assert.ok(!cached.some(x=>x.includes('supabase')));
 assert.ok(!cached.some(x=>x.includes('ot_empresas')));
 const ignored=url=>{
  let touched=false;
  listeners.fetch({request:{method:'GET',url,mode:'cors'},respondWith(){touched=true}});
  return touched;
 };
 assert.equal(ignored('https://agvjqxmrzffkksrgdndn.supabase.co/rest/v1/ot_empresas'),false);
 assert.equal(ignored('https://olegariotech-site.github.io/ot-comercial/fora-da-lista'),false);
 assert.equal(ignored('https://olegariotech-site.github.io/outro-projeto/index.html'),false);
 const promise=[];
 listeners.fetch({request:{method:'GET',url:'https://olegariotech-site.github.io/ot-comercial/apresentacao-ot.html',mode:'navigate'},respondWith(p){promise.push(p)}});
 assert.equal(promise.length,1);const fetched=await promise[0];assert.equal(fetched.ok,true);
 const cachePath=[];
 listeners.fetch({request:{method:'GET',url:'https://olegariotech-site.github.io/ot-comercial/app.js',mode:'cors'},respondWith(p){cachePath.push(p)}});
 assert.equal(cachePath.length,1);assert.strictEqual(await cachePath[0],sampleResponse,'A rede deve ter prioridade sobre JS antigo');
});

test('Atualizacao PWA: JS novo pela rede, fallback antigo so quando offline',async()=>{
 const listeners={},puts=[];
 const old={ok:true,version:'antiga',clone(){return this}};
 const fresh={ok:true,version:'nova',clone(){return this}};
 const unavailable={ok:false,status:503};
 let situation='online';
 const cache={
  addAll:async()=>{},
  match:async()=>old,
  put:async(req,response)=>puts.push({path:String(req),version:response.version})
 };
 const scope='https://olegariotech-site.github.io/ot-comercial/';
 const self={
  registration:{scope},
  location:{origin:'https://olegariotech-site.github.io'},
  addEventListener(name,handler){listeners[name]=handler},
  skipWaiting:async()=>{},
  clients:{claim:async()=>{}}
 };
 const caches={open:async()=>cache,keys:async()=>[],delete:async()=>true};
 const fetch=async()=>{
  if(situation==='offline')throw Error('sem rede');
  return situation==='server-error'?unavailable:fresh;
 };
 vm.runInNewContext(sw,{self,caches,URL,fetch,Error});
 const req={url:scope+'app.js?v=atual',method:'GET',mode:'cors'};
 const attempt=()=>{
  let response;
  listeners.fetch({request:req,respondWith(p){response=p}});
  assert.ok(response,'O SW deve interceptar somente arquivo publico no escopo');
  return response;
 };
 assert.strictEqual(await attempt(),fresh);
 assert.equal(puts.length,1);
 assert.equal(puts[0].version,'nova');
 assert.equal(puts[0].path,scope+'app.js','Cache deve ignorar query strings e nao criar versoes paralelas');
 situation='offline';
 assert.strictEqual(await attempt(),old,'Offline deve manter a copia disponivel');
 assert.equal(puts.length,1,'Nao alterar cache durante falha de rede');
 situation='server-error';
 assert.strictEqual(await attempt(),unavailable,'Nao esconder erro HTTP com JS velho');
 assert.equal(puts.length,1,'Nao cachear falhas HTTP');
});

test('Aviso offline aparece e não afirma que dados foram sincronizados',()=>{
 const events={},banner={hidden:true},chip={textContent:'Nuvem conectada'};
 const navigator={onLine:false};
 const document={getElementById(name){return name==='offlineNotice'?banner:name==='connectionState'?chip:null}};
 const window={addEventListener(name,listener){events[name]=listener}};
 vm.runInNewContext(file('offline-status.js'),{window,document,navigator});
 assert.equal(banner.hidden,false);
 assert.equal(chip.textContent,'Sem internet');
 navigator.onLine=true;events.online();
 assert.equal(banner.hidden,true);
 assert.equal(chip.textContent,'Rede disponível — verificar nuvem');
});

test('Scripts JS integrados têm sintaxe válida',()=>{
 for(const name of ['sw.js','offline-vault.js','offline-status.js','ot-logo.js','card-export.js']){
  assert.doesNotThrow(()=>new vm.Script(file(name),{filename:name}));
 }
});

test('Todos os controles referenciados pelo CRM existem no HTML, e scripts estão na ordem certa',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const refs=[...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 const missing=[...new Set(refs.filter(id=>!ids.has(id)))];
 assert.deepEqual(missing,[],'IDs de controles ausentes: '+missing.join(', '));
 assert.ok(html.indexOf('src="offline-vault.js"')<html.indexOf('src="field-sync.js"'));
 assert.ok(html.indexOf('src="field-sync.js"')<html.indexOf('src="app.js"'));
 assert.match(app,/async function syncNow\(\)/);
 assert.match(app,/OTFieldSync\.sync/);
 assert.match(app,/OTOfflineVault\.stagePhoto/);
 assert.match(app,/OTOfflineVault\.stage\('company'/);
 assert.match(app,/OTOfflineVault\.stage\('visit'/);
});


test('Galeria usa foto cifrada mesmo sem pendencia e guarda foto remota sem upload',()=>{
 const start=app.indexOf('async function loadPhotos(id){');
 const end=app.indexOf('\nasync function uploadPhotos(fileList)',start);
 const downloadStart=app.indexOf('async function downloadPhoto(id){');
 const downloadEnd=app.indexOf('\nasync function deletePhoto(id){',downloadStart);
 assert.ok(start>=0&&end>start&&downloadStart>0&&downloadEnd>downloadStart);
 const gallery=app.slice(start,end);
 const download=app.slice(downloadStart,downloadEnd);
 assert.match(gallery,/OTOfflineVault\.getPhoto\(p\.id\)/);
 assert.match(gallery,/OTOfflineVault\.cachePhoto\(p,blob\)/);
 assert.match(gallery,/DISPONÍVEL OFFLINE/);
 assert.match(download,/OTOfflineVault\.getPhoto\(id\)/);
 assert.doesNotMatch(gallery,/OTOfflineVault\.stagePhoto\(/,
  'Recuperar foto da nuvem não pode enfileirar upload');
 assert.doesNotThrow(()=>new vm.Script(app,{filename:'app.js'}));
});
