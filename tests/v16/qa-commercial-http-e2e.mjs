/* Gate D — fluxo REAL da interface OT em Chromium com servidor HTTPS local
 * simulando Supabase. Nunca usa o banco, autenticação ou fotos de produção.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startMockSupabase} from '../mock-supabase-server.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.join(root,'artifacts','v16-field');
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
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+jVwAAAAASUVORK5CYII=','base64');
let browser=null;
async function launch(offline=false,profileDir=profile){
 fs.rmSync(path.join(profileDir,'DevToolsActivePort'),{force:true});
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--disable-extensions','--no-first-run',
  '--ignore-certificate-errors','--disable-background-networking',
  '--remote-debugging-port=0','--remote-allow-origins=*',
  '--user-data-dir='+profileDir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let chromeStderr='';
 proc.stderr.on('data',chunk=>{chromeStderr=(chromeStderr+chunk.toString()).slice(-2500)});
 let ws;
 const ready=async()=>{
  const flag=path.join(profileDir,'DevToolsActivePort');let port=0;
  for(let i=0;i<220;i++){
   if(fs.existsSync(flag)){port=Number(fs.readFileSync(flag,'utf8').split('\n')[0]);if(port>0)break}
   if(proc.exitCode!==null)break;
   await wait(100);
  }
  assert.ok(port,'Porta DevTools não encontrada; binário='+chrome+' exit='+proc.exitCode+' signal='+proc.signalCode+' logs='+chromeStderr.slice(-750));
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
  let serial=0;const pending=new Map(),exceptions=[];
  ws.addEventListener('message',evt=>{
   let x;try{x=JSON.parse(evt.data)}catch{return}
   if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params?.exceptionDetails?.text||'JS exception');
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
  const navigation=await send('Page.navigate',{url:mock.origin+'/index.html'});
  if(navigation.errorText)console.log('Gate D: retorno da navegação',navigation.errorText);
  async function evalJS(js){
   const r=await Promise.race([
    send('Runtime.evaluate',{expression:js,returnByValue:true,awaitPromise:true,userGesture:true}),
    wait(6500).then(()=>{throw Error('Avaliação no Chrome excedeu 6,5 segundos')})
   ]);
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
  async function screenshot(file,full=false){
   const options={format:'png',captureBeyondViewport:full};
   if(full){const m=await send('Page.getLayoutMetrics');const box=m.cssContentSize||m.contentSize;options.clip={x:0,y:0,width:box.width,height:box.height,scale:1};}
   const r=await send('Page.captureScreenshot',options);
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
  return {proc,send,evalJS,until,screenshot,close,exceptions};
 };
 try{return await ready()}
 catch(e){proc.kill('SIGTERM');if(ws?.readyState===WebSocket.OPEN)ws.close();throw e}
}
const shown=id=>'!!document.querySelector("#'+id+'")&&!document.querySelector("#'+id+'").classList.contains("hidden")';
async function loginUI(){await browser.until(shown('loginView'),'login V1.6');await browser.evalJS('(()=>{document.querySelector("#email").value="qa@ot.invalid";document.querySelector("#password").value="SomenteTesteOT-2026!";document.querySelector("#loginForm button[type=submit]").click();return true})()');await browser.until(shown('appView'),'app V1.6');await browser.until('!document.querySelector("#agendaView").hidden','agenda padrão');}
async function unlockOnline(){await browser.evalJS('document.querySelector("#prepareFieldBtn").click();true');await browser.until('document.querySelector("#vaultDialog").open','cofre V1.6');await browser.evalJS('(()=>{document.querySelector("#vaultPassword").value='+JSON.stringify(PWD)+';document.querySelector("#vaultForm button[type=submit]").click();return true})()');await browser.until('document.querySelector("#fieldState").textContent.includes("desbloqueado")','cofre disponível');}
async function form(id,values){await browser.evalJS('(()=>{const f=document.querySelector('+JSON.stringify('#'+id)+');for(const [k,v] of Object.entries('+JSON.stringify(values)+'))f.elements.namedItem(k).value=v;f.querySelector("button[type=submit]").click();return true})()');}
async function idle(dialog){await browser.until('!document.querySelector('+JSON.stringify('#'+dialog)+').open','formulário concluído');await browser.until('document.querySelector("#pendingCount").textContent==="0 pendentes"','fila confirmada');}
async function openCompanyUI(id){
 await browser.evalJS('document.querySelector("#walletTab").click();true');
 await browser.until('!!document.querySelector(\'[data-id="'+id+'"]\')','empresa na carteira');
 await browser.evalJS('document.querySelector(\'[data-id="'+id+'"]\').click();true');
 await browser.until(shown('companyPanel'),'ficha aberta');
}
const timings=[];const buddy=path.join(tmp,'second-device');
try{
 browser=await launch();await loginUI();assert.equal(await browser.evalJS('document.querySelector("#walletView").hidden'),true);await unlockOnline();
 const day=await browser.evalJS('OTCommercial.today()');const shift=n=>{const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 for(let i=0;i<10;i++){
  const started=Date.now();await browser.evalJS('document.querySelector("#quickNewBtn").click();true');await browser.until('document.querySelector("#quickDialog").open','cadastro rápido '+i);
  await form('quickForm',{nome:'QA V16 '+i,segmento:i===0?'Alimentação':'Serviços',decisor:'Decisor fictício',necessidade:'Diagnóstico de presença digital',proxima:i===3?'':'Apresentar diagnóstico '+i,data:i===1?shift(-1):i===2?shift(1):day});
  await idle('quickDialog');timings.push(Date.now()-started);
 }
 assert.equal(mock.map.ot_empresas.size,10);assert.ok(timings.filter(ms=>ms<=90000).length>=8);assert.equal(await browser.evalJS('document.querySelectorAll("[data-agenda-row]").length'),10);
 const company=[...mock.map.ot_empresas.values()].find(x=>x.nome==='QA V16 0');
 await openCompanyUI(company.id);await browser.until('document.querySelectorAll("[data-edit-opportunity]").length===1','oportunidade da empresa');
 const opportunityId=await browser.evalJS('document.querySelector("[data-edit-opportunity]").dataset.editOpportunity');
 await browser.evalJS('document.querySelector("[data-edit-opportunity]").click();true');await browser.until('document.querySelector("#opportunityDialog").open','diagnóstico');
 await form('opportunityForm',{estagio:'proposta',origem_clientes:'Indicações',prioridade_cliente:'Serviço prioritário QA',jornada_online:'Contato a melhorar após diagnóstico',presenca_verificada:'Site existente conferido, Google ainda a verificar',case_id:'dudu',implantacao_proposta:'2500,00',mensalidade_proposta:'420,00'});await idle('opportunityDialog');
 assert.equal(await browser.evalJS('(async()=>OTCommercial.metrics(OTCommercial.project(await OTOfflineVault.list("commercial"))).mrr)()'),0);
 await browser.evalJS('document.querySelector("[data-edit-opportunity]").click();true');await browser.until('document.querySelector("#opportunityDialog").open','fechamento');
 await form('opportunityForm',{estagio:'ganho',valor_fechado:'2500,00',recorrencia_contratada:'420,00',recorrencia_status:'ativa',contratado_em:day,escopo_mensal:'Site e presença local',entregas_mensais:'Duas atualizações de conteúdo; revisão mensal',frequencia:'Mensal, prazo combinado'});await idle('opportunityDialog');
 assert.equal(await browser.evalJS('(async()=>OTCommercial.metrics(OTCommercial.project(await OTOfflineVault.list("commercial"))).mrr)()'),42000);
 const other=[...mock.map.ot_empresas.values()].find(x=>x.nome==='QA V16 1');
 await browser.evalJS('document.querySelector("#agendaTab").click();true');
 let nextId=await browser.evalJS('(async()=>OTCommercial.project(await OTOfflineVault.list("commercial")).actions.find(a=>a.empresa_id==='+JSON.stringify(other.id)+'&&a.estado==="aberta").id)()');
 await browser.evalJS('document.querySelector(\'[data-action-plan="'+nextId+'"]\').click();true');await browser.until('document.querySelector("#actionDialog").open','desfecho');
 await form('actionForm',{resultado:'Conversa de QA realizada',descricao:'Retomar com decisor',data_prevista:shift(2)});await idle('actionDialog');
 nextId=await browser.evalJS('(async()=>OTCommercial.project(await OTOfflineVault.list("commercial")).actions.find(a=>a.empresa_id==='+JSON.stringify(other.id)+'&&a.estado==="aberta").id)()');
 await browser.evalJS('document.querySelector(\'[data-reschedule="'+nextId+'"]\').click();true');await browser.until('document.querySelector("#actionDialog").open','reagendamento');await form('actionForm',{descricao:'Revisar proposta no horário combinado',data_prevista:shift(3)});await idle('actionDialog');
 assert.equal(await browser.evalJS('(async()=>OTCommercial.project(await OTOfflineVault.list("commercial")).actions.filter(a=>a.empresa_id==='+JSON.stringify(other.id)+'&&a.estado==="aberta").length)()'),1);
 await browser.screenshot('01-agenda-integrada.png',true);
 // Apresentação pública independente, sem sessão/cofre/notas nas páginas.
 await browser.send('Page.navigate',{url:mock.origin+'/cases.html?segment=alimentacao'});await browser.until('document.querySelectorAll("#caseCards article").length===2','cases por segmento');assert.equal(await browser.evalJS('document.body.textContent.includes("QA V16")'),false);assert.equal(await browser.evalJS('typeof OTOfflineVault'),'undefined');await browser.screenshot('02-cases-publicos.png');
 await browser.send('Page.navigate',{url:mock.origin+'/index.html'});await browser.until(shown('appView'),'retorno ao CRM');await unlockOnline();
 await openCompanyUI(company.id);await browser.until(shown('companyPanel'),'ficha para fotos');
 await browser.evalJS('(()=>{const dt=new DataTransfer();for(let i=1;i<=3;i++)dt.items.add(new File([Uint8Array.from(atob('+JSON.stringify(png.toString('base64'))+'),c=>c.charCodeAt(0))],"qa"+i+".png",{type:"image/png"}));const input=document.querySelector("#photoFiles");input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
 await browser.until('document.querySelectorAll("#photoList img").length===3&&document.querySelector("#pendingCount").textContent==="0 pendentes"','três fotos sincronizadas',30000);
 await browser.close();browser=null;
 // Segundo perfil: autenticar, criar cofre independente e obter agenda/fotos da nuvem simulada.
 browser=await launch(false,buddy);await loginUI();await unlockOnline();
 assert.equal(await browser.evalJS('(async()=>OTCommercial.metrics(OTCommercial.project(await OTOfflineVault.list("commercial"))).mrr)()'),42000);
 await openCompanyUI(company.id);await browser.until('document.querySelectorAll("#photoList img").length===3&&[...document.querySelectorAll("#photoList img")].every(i=>i.naturalWidth>0)','fotos de outro dispositivo');
 await browser.evalJS('document.querySelector("#preparePhotoOfflineBtn").click();true');await browser.until('document.querySelector("#photoCacheState").textContent.includes("3 de 3 fotos disponíveis offline")','preparo no segundo dispositivo');
 await browser.close();browser=null;const beforeOffline=mock.apiRequests.length;
 browser=await launch(true,buddy);await browser.until(shown('offlineLoginView'),'abrir offline no outro dispositivo');
 await browser.evalJS('(()=>{document.querySelector("#offlinePassword").value='+JSON.stringify(PWD)+';document.querySelector("#offlineUnlockForm button[type=submit]").click();return true})()');await browser.until(shown('appView'),'desbloquear offline');await browser.until('!document.querySelector("#agendaView").hidden&&document.querySelectorAll("[data-agenda-row]").length>0','agenda offline');
 await openCompanyUI(company.id);await browser.until('document.querySelectorAll("#photoList img").length===3&&[...document.querySelectorAll("#photoList img")].every(i=>i.naturalWidth>0)','3/3 imagens reais offline');
 const downloads=path.join(tmp,'downloads');fs.mkdirSync(downloads,{recursive:true});await browser.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await browser.evalJS('[...document.querySelectorAll("[data-download]")].forEach(b=>b.click());true');for(let i=0;i<80&&fs.readdirSync(downloads).filter(n=>n.endsWith('.png')).length<3;i++)await wait(100);assert.equal(fs.readdirSync(downloads).filter(n=>n.endsWith('.png')).length,3);for(const file of fs.readdirSync(downloads).filter(n=>n.endsWith('.png')))assert.deepEqual(fs.readFileSync(path.join(downloads,file)),png);
 await browser.screenshot('03-segundo-aparelho-offline.png',true);
 await browser.evalJS('document.querySelector("#quickNewBtn").click();true');await browser.until('document.querySelector("#quickDialog").open','cadastro offline');await form('quickForm',{nome:'QA V16 OFFLINE FINAL',proxima:'Retomar após reconexão',data:day});await browser.until('!document.querySelector("#quickDialog").open&&document.querySelector("#pendingCount").textContent.startsWith("3 pendentes")','lote offline cifrado');
 assert.equal(mock.apiRequests.length,beforeOffline,'Nenhuma chamada HTTP deve ocorrer offline');
 await browser.close();browser=null;browser=await launch(true,buddy);await browser.until(shown('offlineLoginView'),'reabrir fila nova');await browser.evalJS('(()=>{document.querySelector("#offlinePassword").value='+JSON.stringify(PWD)+';document.querySelector("#offlineUnlockForm button[type=submit]").click();return true})()');await browser.until('document.querySelector("#pendingCount").textContent.startsWith("3 pendentes")','fila comercial recuperada');
 await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:0,uploadThroughput:0});await browser.until('!document.querySelector("#syncPendingBtn").disabled||!document.querySelector("#loginView").classList.contains("hidden")','reconexão habilitada');await browser.evalJS('document.querySelector("#syncPendingBtn").click();true');
 const status=await browser.until('!document.querySelector("#loginView").classList.contains("hidden")?"login":document.querySelector("#pendingCount").textContent==="0 pendentes"?"synced":false','login ou sincronização');if(status==='login')await loginUI();await browser.until('document.querySelector("#pendingCount").textContent==="0 pendentes"','sincronização final');
 assert.equal(mock.map.ot_empresas.size,11);assert.equal([...mock.map.ot_empresas.values()].filter(x=>x.nome==='QA V16 OFFLINE FINAL').length,1);
 assert.deepEqual(browser.exceptions,[]);await browser.screenshot('04-sincronizado-final.png',true);
 const result={status:'PASS',environment:'Chromium Linux HTTPS mock, dois perfis independentes',physical:false,quickRegistrations:10,timingsMs:timings,within90Seconds:timings.filter(x=>x<=90000).length,photosFromOtherDeviceOffline:3,downloadsExact:3,offlineHTTP:0,pendingFinal:0,mrrContractedCents:42000};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log('V1.6 E2E PASS',JSON.stringify(result));
} catch(e){if(browser)try{console.log('V1.6 diagnóstico',await browser.evalJS('({toast:document.querySelector("#toast")?.textContent,pending:document.querySelector("#pendingCount")?.textContent,coverage:document.querySelector("#commercialCoverage")?.textContent})'));await browser.screenshot('99-falha.png',true)}catch{}throw e;}finally{if(browser)await browser.close();await mock.close();fs.rmSync(tmp,{recursive:true,force:true});}
