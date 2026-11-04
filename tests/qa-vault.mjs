import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const tempDir=path.join(root,'tests','.visual-temp');
fs.mkdirSync(tempDir,{recursive:true});
const file=path.join(tempDir,'vault-test.html');
const script= [
'(async()=>{',
 'const v=window.OTOfflineVault,owner="11111111-1111-4111-8111-111111111111",pass="SenhaLocalOT-MuitoForte-2026";',
 'function check(c,m){if(!c)throw Error("ASSERT: "+m)}',
 'check(v.supported(),"WebCrypto e IndexedDB indisponíveis");',
 'await v.create(owner,pass);check(v.activeOwner()===owner,"Cofre não ativou");',
 'const company=await v.stage("company",{nome:"LOJA_TESTE_CRIPTO",briefing:"SITE E GOOGLE"});',
 'const visit=await v.stage("visit",{empresa_id:company.id,nota:"Conversa fictícia"});',
 'const photo=await v.stagePhoto({empresa_id:company.id,categoria:"Fachada",arquivo_nome:"teste.png"},new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:"image/png"}));',
 'check(company.storedLocally&&visit.storedLocally&&photo.storedLocally,"Gravação local falhou");',
 'const qs=await v.pending();check(qs.length===3,"Fila incompleta");',
 'const got=await v.get("company",company.id);check(got.nome==="LOJA_TESTE_CRIPTO","Leitura criptografada falhou");',
 'const all=await v.list("company");check(all.length===1,"Listagem falhou");',
 'const loaded=await v.getPhoto(photo.id);check(loaded.blob.size===8,"Foto criptografada não recuperada");',
 'const raw=await new Promise((resolve,reject)=>{const o=indexedDB.open("ot-comercial-encrypted-vault-v1");o.onsuccess=()=>{const q=o.result.transaction("records").objectStore("records").get(owner+":company:"+company.id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)};o.onerror=()=>reject(o.error)});',
 'check(!!raw.box?.cipher&&!JSON.stringify(raw).includes("LOJA_TESTE_CRIPTO"),"Dados privados gravados em texto puro");',
 'v.lock();check(v.activeOwner()===null,"Cofre não bloqueou");',
 'let denied=false;try{await v.get("company",company.id)}catch{denied=true}check(denied,"Leitura não bloqueada");',
 'denied=false;try{await v.unlock(owner,"SENHA_ERRADA_COMPRIDA")}catch{denied=true}check(denied,"Senha incorreta aceitou");',
 'await v.unlock(owner,pass);check((await v.get("company",company.id)).nome==="LOJA_TESTE_CRIPTO","Dados não sobreviveram ao desbloqueio");',
 'await v.acknowledge(company.opId);check((await v.pending()).length===2,"Acknowledge falhou");',
 'document.documentElement.dataset.test="passed";document.body.textContent="CRIPTO OK: cadastro, visita, foto, fila, bloqueio e recuperação";',
 '})().catch(e=>{document.documentElement.dataset.test="failed";document.body.textContent="FALHOU: "+e.message;console.error(e)})'
].join('\n');
const html=[
 '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Gate cripto OT</title>',
 '</head><body>Executando...</body><script src="../../offline-vault.js"></script>',
 '<script>'+script+'</script></html>'
].join('\n');
fs.writeFileSync(file,html);
let chrome=null;
for(const cmd of [process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
 const r=spawnSync(cmd,['--version'],{encoding:'utf8',timeout:5000});
 if(r.status===0){chrome=cmd;break}
}
assert.ok(chrome,'Chromium indisponível para testar cofre criptografado');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ot-vault-test-'));
try{
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--disable-extensions','--disable-background-networking',
  '--user-data-dir='+profile,'--virtual-time-budget=15000','--dump-dom',
  pathToFileURL(file).href];
 const r=spawnSync(chrome,args,{encoding:'utf8',timeout:75000,maxBuffer:12*1024*1024});
 if(r.error)throw r.error;
 assert.equal(r.status,0,'Chromium falhou: '+(r.stderr||'').slice(-500));
 assert.match(r.stdout,/data-test="passed"/,'Cofre falhou: '+(r.stdout.match(/FALHOU:[^<]*/)||[])[0]);
 console.log('GATE COFRE: dados cifrados, foto, fila, senha errada e desbloqueio aprovados.');
}finally{
 fs.rmSync(profile,{recursive:true,force:true});
 fs.rmSync(file,{force:true});
}
