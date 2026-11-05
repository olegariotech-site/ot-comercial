// OT Field — teste real IndexedDB/WebCrypto no Chromium em localhost, dois processos.
// Não toca em Supabase nem na produção.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixtureDir=path.join(root,'tests','.browser-e2e');
const fixturePath=path.join(fixtureDir,'vault-e2e.html');
const port=8767;
const origin='http://127.0.0.1:'+port;
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const visit='33333333-3333-4333-8333-333333333333';
const photo='44444444-4444-4444-8444-444444444444';
const remotePhoto='55555555-5555-4555-8555-555555555555';
const pass='SegredoForteLocalOT-2026!';
fs.mkdirSync(fixtureDir,{recursive:true});
const html=[
'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Campo OT E2E Cofre</title></head>',
'<body>Iniciando E2E</body><script src="../../offline-vault.js"></script>',
'<script>',
'const q=new URLSearchParams(location.search),stage=q.get("stage");',
'const v=window.OTOfflineVault;',
'const owner='+JSON.stringify(owner)+';',
'const company='+JSON.stringify(company)+';',
'const visit='+JSON.stringify(visit)+';',
'const photo='+JSON.stringify(photo)+';',
'const remotePhoto='+JSON.stringify(remotePhoto)+';',
'const pass='+JSON.stringify(pass)+';',
'function check(cond,msg){if(!cond)throw Error(msg)}',
'(async()=>{',
' check(v.supported(),"IndexedDB ou WebCrypto indisponíveis");',
' if(stage==="create"){',
'  await v.create(owner,pass);',
'  const c=await v.stage("company",{id:company,nome:"Comércio Teste Off",briefing:"Site profissional"});',
'  const t=await v.stage("visit",{id:visit,empresa_id:company,nota:"Visitado sem conexão"});',
'  const p=await v.stagePhoto({id:photo,empresa_id:company,arquivo_nome:"teste.png",categoria:"Fachada"},',
'    new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:"image/png"}));',
'  check(c.id===company&&t.id===visit&&p.id===photo,"IDs locais não persistiram");',
'  await v.cachePhoto({id:remotePhoto,empresa_id:company,storage_path:owner+"/"+company+"/"+remotePhoto+".png",arquivo_nome:"do-desktop.png",bytes:8,categoria:"Fachada"},',
'    new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:"image/png"}));',
'  check((await v.getPhoto(remotePhoto)).blob.size===8,"Foto remota não foi armazenada");',
'  check((await v.pending()).length===3,"Fila de pendências incompleta");',
' }else if(stage==="reopen"){',
'  check(await v.has(owner),"Cofre desapareceu depois de fechar o navegador");',
'  check((await v.owners()).includes(owner),"Cofre não foi localizado pelos metadados");',
'  let rejected=false;try{await v.unlock(owner,"Senha errada muito longa")}catch{rejected=true}',
'  check(rejected,"Desbloqueou com senha incorreta");',
'  await v.unlock(owner,pass);',
'  const c=await v.get("company",company),t=await v.get("visit",visit),p=await v.getPhoto(photo);',
'  check(c.nome==="Comércio Teste Off","Empresa desapareceu");',
'  check(t.nota==="Visitado sem conexão","Visita desapareceu");',
'  check(p.blob.size===8,"Foto foi perdida");',
'  check((await v.getPhoto(remotePhoto)).blob.size===8,"Foto remota cifrada não sobreviveu ao reinício");',
'  check((await v.pending()).length===3,"Fila não persistiu");',
'  const raw=await new Promise((resolve,reject)=>{',
'   const o=indexedDB.open("ot-comercial-encrypted-vault-v1");o.onerror=()=>reject(o.error);',
'   o.onsuccess=()=>{const r=o.result.transaction("records").objectStore("records").get(owner+":company:"+company);',
'    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}',
'  });',
'  check(!!raw.box?.cipher&&!JSON.stringify(raw).includes("Comércio Teste Off"),"Registro gravado em claro");',
' }else throw Error("Etapa desconhecida");',
' document.documentElement.dataset.e2e="passed";document.body.textContent="OT E2E "+stage+" OK";',
'})().catch(e=>{document.documentElement.dataset.e2e="failed";',
' document.body.textContent="OT E2E FAILED: "+e.message;console.error(e)});',
'</script></html>'
].join('\n');
fs.writeFileSync(fixturePath,html);
function findChrome(){
 for(const cmd of [process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
  const r=spawnSync(cmd,['--version'],{encoding:'utf8',timeout:5000});
  if(r.status===0)return cmd;
 }
 throw Error('Chrome não instalado');
}
const chrome=findChrome();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ot-field-profile-'));
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{
 cwd:root,stdio:'ignore'
});
function ping(){return new Promise(resolve=>{
 const r=http.get(origin+'/offline-vault.js',res=>{res.resume();resolve(res.statusCode===200)});
 r.on('error',()=>resolve(false));r.setTimeout(800,()=>{r.destroy();resolve(false)});
})}
async function ready(){for(let i=0;i<15;i++){if(await ping())return;await new Promise(r=>setTimeout(r,200))}throw Error('Servidor de testes não iniciou')}
async function runPhase(stage){
 // Remover endpoint DevTools antigo ao reutilizar o mesmo perfil em outro processo.
 fs.rmSync(path.join(profile,'DevToolsActivePort'),{force:true});
 const chromeProcess=spawn(chrome,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--disable-extensions','--disable-background-networking',
  '--remote-debugging-port=0','--remote-allow-origins=*',
  '--user-data-dir='+profile,'about:blank'
 ],{stdio:'ignore'});
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 let ws;
 try{
  const debugFile=path.join(profile,'DevToolsActivePort');
  let portNum=0;
  for(let i=0;i<200;i++){
   if(fs.existsSync(debugFile)){
    const v=Number(fs.readFileSync(debugFile,'utf8').split('\n')[0]);
    if(v>0){portNum=v;break}
   }
   await wait(100);
  }
  assert.ok(portNum,'DevTools não abriu');
  let target=null;
  for(let i=0;i<30;i++){
   try{
    const response=await fetch('http://127.0.0.1:'+portNum+'/json/list');
    const tabs=await response.json();
    target=tabs.find(tab=>tab.type==='page'&&tab.webSocketDebuggerUrl);
    if(target)break;
   }catch{}
   await wait(100);
  }
  assert.ok(target,'Aba CDP não encontrada');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});
   ws.addEventListener('error',()=>reject(Error('Falha de WebSocket CDP')),{once:true});
  });
  let seq=0;
  const pending=new Map();
  ws.addEventListener('message',event=>{
   let msg;try{msg=JSON.parse(event.data)}catch{return}
   if(!msg.id)return;
   const p=pending.get(msg.id);if(!p)return;pending.delete(msg.id);
   if(msg.error)p.reject(Error(msg.error.message));else p.resolve(msg.result||{});
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++seq;pending.set(id,{resolve,reject});
   ws.send(JSON.stringify({id,method,params}));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const url=origin+'/tests/.browser-e2e/vault-e2e.html?stage='+stage;
  await send('Page.navigate',{url});
  let last='';
  for(let i=0;i<120;i++){
   const evaluated=await send('Runtime.evaluate',{
    expression:'[document.documentElement.dataset.e2e||"",document.body?.textContent?.slice(0,220)||""]',
    returnByValue:true
   });
   const info=evaluated.result?.value||[];
   const state=info[0]||'',message=info[1]||'';
   if(state==='passed'){console.log('OT E2E Chrome real '+stage+': aprovado.');return;}
   if(state==='failed')throw Error('Chrome '+stage+': '+message);
   last=state+' '+message;
   await wait(200);
  }
  throw Error('Tempo esgotado aguardando Chrome '+stage+': '+last);
 }finally{
  if(ws&&ws.readyState===WebSocket.OPEN)ws.close();
  chromeProcess.kill('SIGTERM');
  await Promise.race([
   new Promise(resolve=>chromeProcess.once('exit',resolve)),
   wait(2000).then(()=>{if(chromeProcess.exitCode===null)chromeProcess.kill('SIGKILL')})
  ]);
  await wait(850);
 }
}
try{
 await ready();await runPhase('create');await runPhase('reopen');
}finally{
 server.kill('SIGTERM');
 fs.rmSync(fixturePath,{force:true});
 fs.rmSync(profile,{recursive:true,force:true});
}
