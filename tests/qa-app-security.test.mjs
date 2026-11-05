import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=app.slice(0,app.indexOf("$('loginForm').addEventListener"));
const owner='11111111-1111-4111-8111-111111111111';
function harness(){
 const controls=new Map();
 const control=id=>{if(!controls.has(id))controls.set(id,{textContent:'',disabled:true,classList:{toggle(){}},style:{}});return controls.get(id)};
 const sessionStorage=new Map();
 const scope=vm.createContext({window:{OT_CONFIG:{url:'https://qa.invalid',publishableKey:'sb_publishable_QA'}},
  document:{getElementById:control},navigator:{onLine:true},URL,console,Error,Response,Date,Set,Map,
  setTimeout,clearTimeout,sessionStorage:{getItem:k=>sessionStorage.get(k),setItem:(k,v)=>sessionStorage.set(k,v),removeItem:k=>sessionStorage.delete(k)}});
 vm.runInContext(source,scope);
 return {scope,controls,run:js=>vm.runInContext(js,scope),control};
}
test('Reconexão: onLine precede habilitação assíncrona; clique antigo é perdido',async()=>{
 const h=harness();let resolve;
 const pending=new Promise(r=>{resolve=r});
 h.scope.window.OTOfflineVault={activeOwner:()=>owner,pending:()=>pending,list:async()=>[]};
 h.run('userId='+JSON.stringify(owner));
 const btn=h.control('syncPendingBtn');let clicks=0;
 btn.click=()=>{if(!btn.disabled)clicks++};
 const update=h.run('updateFieldState()');
 btn.click();assert.equal(clicks,0,'Reproduz clique no botão ainda desabilitado');
 resolve([{id:'pending'}]);await update;
 assert.equal(btn.disabled,false);btn.click();assert.equal(clicks,1);
});
test('Refresh paralelo compartilha uma só renovação e rejeita resposta de sessão antiga',async()=>{
 const h=harness();let calls=0,resolve;
 h.scope.fetch=async()=>{calls++;return new Promise(r=>{resolve=r})};
 h.run('storeSession({access_token:"old",refresh_token:"refresh",expires_at:0})');
 const a=h.run('refreshSession()'),b=h.run('refreshSession()');
 assert.equal(calls,1);
 resolve(new Response(JSON.stringify({access_token:'new',refresh_token:'next',expires_in:3600})));
 await Promise.all([a,b]);assert.equal(h.run('session.access_token'),'new');
 const c=h.run('refreshSession()');
 h.run('storeSession(null)');
 resolve(new Response(JSON.stringify({access_token:'stale',expires_in:3600})));
 await assert.rejects(c,/Sessão alterada/);assert.equal(h.run('session'),null);
});
test('Lista completa exige paginação bem sucedida; falha não autoriza reconcile',async()=>{
 const h=harness();const rows=Array.from({length:500},(_,id)=>({id}));let pages=0;
 h.scope.requestMock=async()=>{pages++;if(pages===1)return {rows,total:501};throw Error('HTTP 403')};
 h.run('request=requestMock');
 await assert.rejects(h.run('cloudRows("ot_empresas")'),/HTTP 403/);assert.equal(pages,2);
});
test('Erro apresentado não expõe JWT, chave, URL nem caminho privado',()=>{
 const h=harness();
 const message='Bearer token sb_secret_segredo https://qa.invalid/'+owner+'/foto.png';
 h.scope.message=message;
 const result=h.run('safeErr(new Error(message))');
 assert.doesNotMatch(result,/token|sb_secret_|https:|11111111/);
});


test('Paginação respeita limite menor do servidor e recusa contagem variável',async()=>{
 const h=harness();let page=0;
 h.scope.requestMock=async()=>({rows:[{id:++page}],total:3});h.run('request=requestMock');
 assert.equal((await h.run('cloudRows("ot_empresas")')).length,3);
 page=0;h.scope.requestMock=async()=>({rows:[{id:++page}],total:page===1?3:4});h.run('request=requestMock');
 await assert.rejects(h.run('cloudRows("ot_empresas")'),/Lista remota alterada/);
});

test('Resposta atrasada de galeria não substitui empresa que acabou de ser aberta',async()=>{
 const h=harness(),a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
 h.scope.requestMock=async()=>[{id:'44444444-4444-4444-8444-444444444444',empresa_id:a}];
 h.run('userId='+JSON.stringify(owner)+';active={id:'+JSON.stringify(b)+'};photos=[{id:"sentinela"}];cloudRows=requestMock;');
 await h.run('loadPhotos('+JSON.stringify(a)+')');
 assert.equal(h.run('photos[0].id'),'sentinela');
});
test('Troca de empresa durante lote de fotos não associa arquivo seguinte a outra empresa',async()=>{
 const h=harness(),a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',written=[];
 const vault={activeOwner:()=>owner,pending:async()=>[],list:async()=>[],
  stagePhoto:async(info)=>{written.push(info.empresa_id);h.run('active={id:'+JSON.stringify(b)+'}')}
 };
 h.scope.window.OTOfflineVault=vault;h.scope.OTOfflineVault=vault;
 h.control('photoCategory').value='Fachada';h.control('photoConsent').checked=false;
 h.scope.navigator.onLine=false;h.scope.crypto={randomUUID:()=> '44444444-4444-4444-8444-444444444444'};
 h.scope.files=[new Blob(['a'],{type:'image/png'}),new Blob(['b'],{type:'image/png'})];
 h.run('userId='+JSON.stringify(owner)+';active={id:'+JSON.stringify(a)+'};');
 await h.run('uploadPhotos(files)');
 assert.deepEqual(written,[a]);
});
