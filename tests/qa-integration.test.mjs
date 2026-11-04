import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=file('index.html'),sw=file('sw.js'),manifest=JSON.parse(file('manifest.webmanifest'));
const workflow=file('.github/workflows/deploy-pages.yml');
const style=file('style.css'),app=file('app.js'),store=file('offline-store.js');

test('Versão integrada preserva o CRM Premium e registra apenas shell público',()=>{
 assert.match(html,/OT Comercial V1\.5/);
 assert.match(html,/class="btn ot-presentation"/);
 assert.match(html,/rel="manifest" href="manifest\.webmanifest"/);
 assert.match(html,/offline-store\.js/);
 assert.match(html,/offline-status\.js/);
 assert.match(html,/serviceWorker\.register\("\.\/sw\.js"\)/);
 assert.match(html,/ainda NÃO são salvos offline/);
 assert.match(style,/offline-notice\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(app,/OTOffline\./,'Não integrar módulo sem criptografia a dados reais');
 assert.match(store,/armazenamento EXPERIMENTAL/);
 assert.match(workflow,/cp sw\.js offline-store\.js offline-status\.js manifest\.webmanifest ot-icon\.svg _site\//);
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
 assert.equal(cachePath.length,1);assert.deepEqual(await cachePath[0],cachedResponse);
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
 for(const name of ['sw.js','offline-store.js','offline-status.js','ot-logo.js','card-export.js']){
  assert.doesNotThrow(()=>new vm.Script(file(name),{filename:name}));
 }
});
