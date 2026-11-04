/* Gate D — fluxo REAL da interface OT em Chromium com servidor HTTPS local
 * simulando Supabase. Nunca usa o banco, autenticação ou fotos de produção.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startMockSupabase} from './mock-supabase-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'artifacts','gate-d-field');
fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function findChrome(){
 for(const cmd of [process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
  '/usr/bin/chromium','/opt/google/chrome/chrome','google-chrome','google-chrome-stable',
  'chromium','chromium-browser'].filter(Boolean)){
  if(cmd.startsWith('/')&&fs.existsSync(cmd))return cmd;
  const which=spawnSync('which',[cmd],{encoding:'utf8',timeout:3000});
  if(which.status===0&&which.stdout.trim())return which.stdout.trim();
 }
 throw Error('Nenhum executável do Chromium localizado no runner');
}
const chrome=findChrome();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ot-field-https-'));
const profile=path.join(tmp,'profile');
const key=path.join(tmp,'qa-local.key');
const cert=path.join(tmp,'qa-local.crt');
const ssl=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
 '-keyout',key,'-out',cert,'-subj','/CN=localhost',
 '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{
 encoding:'utf8',timeout:15000
});
assert.equal(ssl.status,0,'Não foi possível criar TLS temporário: '+ssl.stderr?.slice(-800));
const mock=await startMockSupabase(root,{
 key:fs.readFileSync(key),cert:fs.readFileSync(cert)
});
const PWD='CofreOT_Local_2026_MuitoForte!';
let browser=null;
async function launch(offline=false){
 fs.rmSync(path.join(profile,'DevToolsActivePort'),{force:true});
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--disable-extensions','--no-first-run',
  '--ignore-certificate-errors','--disable-background-networking',
  '--remote-debugging-port=0','--remote-allow-origins=*',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws;
 const ready=async()=>{
  const flag=path.join(profile,'DevToolsActivePort');let port=0;
  for(let i=0;i<90;i++){
   if(fs.existsSync(flag)){port=Number(fs.readFileSync(flag,'utf8').split('\n')[0]);if(port>0)break}
   await wait(100);
  }
  assert.ok(port,'Porta DevTools não encontrada');
  let target=null;
  for(let i=0;i<50;i++){
   try{
    const r=await fetch('http://127.0.0.1:'+port+'/json/list');
    const tabs=await r.json();
    target=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
    if(target)break;
   }catch{}
   await wait(100);
  }
  assert.ok(target,'Aba CDP indisponível');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});
   ws.addEventListener('error',reject,{once:true});
  });
  let serial=0;const pending=new Map();
  ws.addEventListener('message',evt=>{
   let x;try{x=JSON.parse(evt.data)}catch{return}
   if(!x.id)return;
   const p=pending.get(x.id);if(!p)return;pending.delete(x.id);
   if(x.error)p.reject(Error(x.error.message));else p.resolve(x.result||{});
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++serial;pending.set(id,{resolve,reject});
   ws.send(JSON.stringify({id,method,params}));
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{
   width:390,height:844,deviceScaleFactor:1,mobile:true
  });
  if(offline)await send('Network.emulateNetworkConditions',{
   offline:true,latency:0,downloadThroughput:0,uploadThroughput:0
  });
  await send('Page.navigate',{url:mock.origin+'/index.html'});
  async function evalJS(js){
   const r=await send('Runtime.evaluate',{
    expression:js,returnByValue:true,awaitPromise:true,userGesture:true
   });
   if(r.exceptionDetails)throw Error('Erro JS da interface: '+(r.exceptionDetails.text||'')+' '+JSON.stringify(r.exceptionDetails.exception?.description||'').slice(0,450));
   return r.result?.value;
  }
  async function until(js,label,timeout=16000){
   const started=Date.now();let last;
   while(Date.now()-started<timeout){
    try{last=await evalJS(js);if(last)return last}catch(e){last=e.message}
    await wait(170);
   }
   throw Error('Gate D não passou ['+label+']; último estado: '+JSON.stringify(last));
  }
  async function screenshot(file){
   const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   const bytes=Buffer.from(r.data,'base64');
   assert.ok(bytes.length>5000,'Captura vazia: '+file);
   fs.writeFileSync(path.join(out,file),bytes);
  }
  async function close(){
   try{if(ws?.readyState===WebSocket.OPEN)ws.close()}catch{}
   proc.kill('SIGTERM');
   await Promise.race([
    new Promise(resolve=>proc.once('exit',resolve)),
    wait(2000).then(()=>{if(proc.exitCode===null)proc.kill('SIGKILL')})
   ]);
   await wait(850);
  }
  return {proc,send,evalJS,until,screenshot,close};
 };
 try{return await ready()}
 catch(e){proc.kill('SIGTERM');if(ws?.readyState===WebSocket.OPEN)ws.close();throw e}
}
const isShown=id=>'!!document.querySelector("#'+id+'")&&!document.querySelector("#'+id+'").classList.contains("hidden")';
try{
 browser=await launch(false);
 await browser.until(isShown('loginView'),'login online');
 await browser.evalJS('(()=>{document.querySelector("#email").value="qa@ot.invalid";document.querySelector("#password").value="SomenteTesteOT-2026!";document.querySelector("#loginForm button[type=submit]").click();return true})()');
 try{await browser.until(isShown('appView'),'entrar na carteira');}
 catch(e){
  const details=await browser.evalJS('({toast:document.querySelector("#toast")?.textContent,loginHidden:document.querySelector("#loginView")?.classList.contains("hidden"),setupHidden:document.querySelector("#setupView")?.classList.contains("hidden"),state:document.querySelector("#connectionState")?.textContent,api:window.OT_CONFIG?.url})');
  console.log('Gate D: erro de login no mock',JSON.stringify(details));
  throw e;
 }
 await browser.evalJS('document.querySelector("#prepareFieldBtn").click();true');
 await browser.until('document.querySelector("#vaultDialog").open','preparação do cofre');
 await browser.evalJS('(()=>{document.querySelector("#vaultPassword").value='+JSON.stringify(PWD)+';document.querySelector("#vaultForm button[type=submit]").click();return true})()');
 await browser.until('document.querySelector("#fieldState").textContent.includes("desbloqueado")','cofre preparado',25000);
 await browser.until('(async()=>{if(!("serviceWorker" in navigator))return false;const r=await navigator.serviceWorker.ready;return !!r.active})()','service worker instalado',20000);
 console.log('Gate D: login mock, cofre criptografado e Service Worker ativos.');
 await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await browser.until('navigator.onLine===false','offline real no Chrome');
 await browser.evalJS('document.querySelector("#newBtn").click();true');
 await browser.until('document.querySelector("#companyDialog").open','abrir cadastro');
 await browser.evalJS('(()=>{const f=document.querySelector("#companyForm");f.elements.namedItem("nome").value="LOJA QA SEM INTERNET";f.elements.namedItem("briefing").value="Site institucional e presença Google (apenas teste)";f.elements.namedItem("bairro").value="São Marcos";f.querySelector("button[type=submit]").click();return true})()');
 await browser.until('document.querySelector("#pendingCount").textContent.startsWith("1 pendente")','empresa local',24000);
 await browser.until(isShown('companyPanel'),'abrir ficha do teste');
 await browser.evalJS('(()=>{document.querySelector("#visitNote").value="Visita de teste sem internet";document.querySelector("#visitNext").value="Mostrar portfólio";document.querySelector("#visitReturn").value="2026-11-09";document.querySelector("#visitForm button[type=submit]").click();return true})()');
 await browser.until('document.querySelector("#pendingCount").textContent.startsWith("2 pendentes")','visita local',20000);
 await browser.evalJS('(()=>{const f=new File([new Uint8Array([137,80,78,71,13,10,26,10])],"teste.png",{type:"image/png"});const dt=new DataTransfer();dt.items.add(f);const input=document.querySelector("#photoFiles");input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
 await browser.until('document.querySelector("#pendingCount").textContent.startsWith("3 pendentes")','foto local',25000);
 await browser.until('document.querySelector("#photoList").textContent.includes("SALVA NO APARELHO")','galeria local');
 assert.equal(mock.map.ot_empresas.size,0,'Nuvem simulada recebeu dados mesmo offline!');
 assert.equal(mock.map.ot_visitas.size,0,'Visita enviada enquanto offline!');
 assert.equal(mock.media.size,0,'Foto enviada enquanto offline!');
 await browser.screenshot('01-registros-locais.png');
 console.log('Gate D: empresa, visita e foto fictícias persistidas com rede desligada.');
 await browser.close();browser=null;
 browser=await launch(true);
 await browser.until(isShown('offlineLoginView'),'reabrir sem internet',25000);
 await browser.evalJS('(()=>{document.querySelector("#offlinePassword").value='+JSON.stringify(PWD)+';document.querySelector("#offlineUnlockForm button[type=submit]").click();return true})()');
 await browser.until(isShown('appView'),'desbloquear offline',25000);
 await browser.until('document.querySelector("#pendingCount").textContent.startsWith("3 pendentes")','fila recuperada',25000);
 assert.equal(await browser.evalJS('document.querySelector("#companyList").textContent.includes("LOJA QA SEM INTERNET")'),true);
 await browser.screenshot('02-reaberto-offline.png');
 console.log('Gate D: cofre reaberto, carteira e três pendências recuperadas.');
 await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:0,uploadThroughput:0});
 await browser.until('navigator.onLine===true','reconectado');
 await browser.evalJS('document.querySelector("#syncPendingBtn").click();true');
 const state=await browser.until('(()=>{const login=document.querySelector("#loginView");const queue=document.querySelector("#pendingCount");return !login.classList.contains("hidden")?"login":queue.textContent==="0 pendentes"?"synced":false})()','reautenticação ou sync',15000);
 if(state==='login'){
  await browser.evalJS('(()=>{document.querySelector("#email").value="qa@ot.invalid";document.querySelector("#password").value="SomenteTesteOT-2026!";document.querySelector("#loginForm button[type=submit]").click();return true})()');
 }
 await browser.until('document.querySelector("#pendingCount").textContent==="0 pendentes"','sincronização com confirmação HTTP',30000);
 assert.equal(mock.map.ot_empresas.size,1,'Empresa não chegou ao mock');
 assert.equal(mock.map.ot_visitas.size,1,'Visita não chegou ao mock');
 assert.equal(mock.map.ot_fotos.size,1,'Metadados da foto não chegaram ao mock');
 assert.equal(mock.media.size,1,'Arquivo da foto não chegou ao mock');
 const uniquePosts=mock.calls.filter(s=>s.startsWith('POST '));
 assert.equal(uniquePosts.length,3,'POST duplicado no mock');
 assert.equal(mock.calls.filter(s=>s.startsWith('PHOTO ')).length,1,'Upload duplicado');
 await browser.screenshot('03-confirmado-na-nuvem-mock.png');
 console.log('Gate D: reconexão, login, confirmação de 3 registros e 1 imagem. Sem duplicação.');
}finally{
 if(browser)await browser.close();
 await mock.close();
 fs.rmSync(tmp,{recursive:true,force:true});
}
