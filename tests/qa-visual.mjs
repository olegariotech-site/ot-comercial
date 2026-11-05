// QA visual OT V1.4 em Chrome real. Apenas Node.js + Chrome do runner.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.join(root,'artifacts','v1-4-visual');
const dir=path.join(root,'tests','.visual-temp');
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(dir,{recursive:true});
const page=fs.readFileSync(path.join(root,'apresentacao-ot.html'),'utf8');
const matched=page.match(/const SERVICES=(\[[\s\S]*?\]);\s*const KITS=/);
assert.ok(matched,'SERVICES ausente');
const services=vm.runInNewContext('('+matched[1]+')');
assert.equal(services.length,8);

function findChrome(){
 const names=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
 for(const name of names){
  const r=spawnSync(name,['--version'],{encoding:'utf8',timeout:8000});
  if(r.status===0){console.log('Chromium:',r.stdout.trim());return name}
 }
 throw Error('Chrome/Chromium não encontrado no runner');
}
const chrome=findChrome();
function launch(args,name,timeout=45000){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ot-chrome-'));
 const flags=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--no-first-run','--disable-background-networking','--hide-scrollbars',
   '--disable-extensions','--force-device-scale-factor=1',
   '--user-data-dir='+profile,'--virtual-time-budget=7000',...args];
 const r=spawnSync(chrome,flags,{encoding:'utf8',timeout,maxBuffer:20*1024*1024});
 fs.rmSync(profile,{recursive:true,force:true});
 if(r.error)throw r.error;
 assert.equal(r.status,0,'Chrome falhou em '+name+': '+(r.stderr||'').slice(-1000));
 return r.stdout||'';
}
function screenshot(file,filename,size){
 const dest=path.join(target,filename);
 launch(['--window-size='+size,'--screenshot='+dest,pathToFileURL(file).href],filename);
 assert.ok(fs.existsSync(dest),'Screenshot ausente: '+filename);
 const png=fs.readFileSync(dest);
 assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
 const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
 assert.ok(w>=360&&h>=700,'Resolução errada: '+w+'x'+h);
 assert.ok(png.length>12000,'Screenshot pode estar vazio: '+filename+' '+png.length);
 console.log('VISUAL OK',filename,w+'x'+h,png.length+' bytes');
}
function fixture(s){
 const data=JSON.stringify(s).replace(/</g,'\\u003c');
 return [
 '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width, initial-scale=1">',
 '<title>QA visual OT</title><style>',
 '*{box-sizing:border-box}body{margin:0;background:#081320;color:#fff}',
 '#preview{display:block;width:540px;max-width:100%;height:auto;margin:0 auto}',
 '#status{font:12px system-ui;margin:8px 16px}</style></head><body>',
 '<img id="preview" alt="Card OT"><p id="status">Gerando card...</p>',
 '<script src="../../ot-logo.js"></script><script src="../../card-export.js"></script>',
 '<script>',
 'const service='+data+';',
 '(async()=>{try{const file=await OTCardExport.create(service);',
 'if(file.type!=="image/png")throw Error("Arquivo inválido");',
 'const im=document.getElementById("preview");',
 'im.onload=()=>{document.documentElement.dataset.ready="true";document.getElementById("status").textContent="Imagem: "+file.name;};',
 'im.onerror=()=>{document.documentElement.dataset.ready="error";};',
 'im.src=URL.createObjectURL(file);',
 '}catch(e){document.documentElement.dataset.ready="error";document.getElementById("status").textContent=e.message;}})();',
 '</script></body></html>'
 ].join('\n');
}
let count=0;
for(const service of services){
 const file=path.join(dir,'card-'+service.id+'.html');
 fs.writeFileSync(file,fixture(service));
 const dom=launch(['--dump-dom',pathToFileURL(file).href],service.id);
 assert.match(dom,/data-ready="true"/,'Card não concluiu: '+service.id+' '+dom.slice(-700));
 screenshot(file,'card-'+service.id+'.png','550,1010');count++;
}
screenshot(path.join(root,'apresentacao-ot.html'),'vitrine-mobile-390.png','390,1000');
screenshot(path.join(root,'apresentacao-ot.html'),'vitrine-desktop-1280.png','1280,900');

// Renderização visual sintética do CRM: não autentica, não acessa Supabase,
// não usa qualquer ficha ou dado de cliente real.
const rawIndex=fs.readFileSync(path.join(root,'index.html'),'utf8');
const marker=rawIndex.indexOf('<script src="config.js"></script>');
assert.ok(marker>0,'Ponto de scripts do CRM não encontrado');
const companyCard='<button type="button" class="company-card"><div class="name">Empresa de demonstração</div><div class="meta">Comércio · Valinhos</div><div class="meta">Contato ilustrativo</div><div class="brief">Criar apresentação digital e integrar WhatsApp.</div><div class="status">Interessado · Retorno agendado</div></button>';
const demoScript=[
 'document.getElementById("brandSymbol").src=window.OTBrandLogo||"";',
 'document.getElementById("appView").classList.remove("hidden");',
 'document.getElementById("loginView").classList.add("hidden");',
 'document.getElementById("setupView").classList.add("hidden");',
 'document.getElementById("connectionState").textContent="Demonstração visual";',
 'document.getElementById("logoutBtn").hidden=false;',
 'document.getElementById("countAll").textContent="1";',
 'document.getElementById("countHot").textContent="1";',
 'document.getElementById("companyList").innerHTML='+JSON.stringify(companyCard)+';'
].join('\n');
const fixturePath=path.join(root,'qa-crm-v14-preview.html');
fs.writeFileSync(fixturePath,rawIndex.slice(0,marker)+
 '<script src="ot-logo.js"></script><script>'+demoScript+'</script></body></html>');
try{
 screenshot(fixturePath,'crm-mobile-390.png','390,900');
 screenshot(fixturePath,'crm-desktop-1280.png','1280,900');
}finally{fs.rmSync(fixturePath,{force:true})}

console.log('QA visual concluído: '+count+' cards e duas versões da vitrine');
