// OT Comercial V1.5 — prepara preview SEM PUBLICAR.
 // Segurança: a única configuração permitida é o projeto Supabase de homologação.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dest=path.join(root,'artifacts','staging-preview');
const stagingRef='efscgxwvaixwqhffwdqu';
const productionRef='agvjqxmrzffkksrgdndn';
const config=fs.readFileSync(path.join(root,'tests/staging/config.public.js'),'utf8');
assert.ok(config.includes('https://'+stagingRef+'.supabase.co'),
 'Configuração não aponta exclusivamente ao staging');
assert.ok(/sb_publishable_[A-Za-z0-9_-]+/.test(config),
 'Chave de QA não é publishable');
assert.ok(!config.includes(productionRef),'Config contém referência à produção');
assert.ok(!/sb_secret_|service_role/i.test(config),'Chave privilegiada proibida');
assert.ok(!/eyJhbGciOiJI/.test(config),'JWT legado proibido no preview');

const staticFiles=[
 'index.html','app.js','style.css','robots.txt','apresentacao-ot.html',
 'apresentacao-servico.css','card-export.js','ot-logo.js','sw.js',
 'offline-vault.js','field-sync.js','offline-status.js','manifest.webmanifest','ot-icon.svg'
];
fs.rmSync(dest,{recursive:true,force:true});
fs.mkdirSync(dest,{recursive:true});
for(const file of staticFiles){
 const from=path.join(root,file);if(!fs.existsSync(from))throw Error('Arquivo não encontrado: '+file);
 fs.copyFileSync(from,path.join(dest,file));
}
fs.cpSync(path.join(root,'solucoes'),path.join(dest,'solucoes'),{recursive:true});
fs.writeFileSync(path.join(dest,'config.js'),config,{mode:0o644});

// CRÍTICO: GitHub Pages de repositórios diferentes sob a mesma conta podem
// compartilhar a mesma ORIGEM https://olegariotech-site.github.io.
// IndexedDB, localStorage, sessionStorage e Cache Storage são por ORIGEM,
// não por repositório. Isolar nomes no pacote de QA, sem mudar main.
function replaceExactly(file,from,to){
 const filename=path.join(dest,file),body=fs.readFileSync(filename,'utf8');
 const pieces=body.split(from);
 assert.equal(pieces.length,2,'Marcador obrigatório alterado em '+file+': '+from);
 fs.writeFileSync(filename,pieces.join(to));
}
replaceExactly('app.js',
 "const tokenStorageKey = 'ot_comercial_v12_sessao';",
 "const tokenStorageKey = 'ot_comercial_QA_v15_sessao';");
replaceExactly('app.js',
 "const offlineOwnerKey='ot_comercial_offline_owner_v1';",
 "const offlineOwnerKey='ot_comercial_QA_offline_owner_v15';");
replaceExactly('offline-vault.js',
 "const NAME='ot-comercial-encrypted-vault-v1',VERSION=1;",
 "const NAME='ot-comercial-QA-encrypted-vault-v15',VERSION=1;");
replaceExactly('sw.js',
 "const PREFIX='ot-comercial-shell-';",
 "const PREFIX='ot-comercial-QA-shell-';");
replaceExactly('sw.js',
 "const CACHE=PREFIX+'v1-5-gate-b';",
 "const CACHE=PREFIX+'v1-5-staging-v1';");
replaceExactly('sw.js',
 "(x.startsWith(PREFIX)||x.startsWith('ot-comercial-v13-shell-'))&&x!==CACHE",
 "x.startsWith(PREFIX)&&x!==CACHE");

const manifestFile=path.join(dest,'manifest.webmanifest');
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
manifest.name='OT Comercial — HOMOLOGAÇÃO';
manifest.short_name='OT Campo QA';
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));

const robotsFile=path.join(dest,'robots.txt');
fs.writeFileSync(robotsFile,'User-agent: *\nDisallow: /\n');


const indexFile=path.join(dest,'index.html');
let html=fs.readFileSync(indexFile,'utf8');
assert.ok(html.includes('<head>'),'Elemento head obrigatório ausente');
html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow,noarchive">');
const before='<main>';
if(html.split(before).length!==2)throw Error('Não foi possível marcar o preview');
const caution='<div id="qaFlag" role="status" style="position:relative;z-index:1;padding:11px 16px;'+
 'text-align:center;background:#3a270e;border-bottom:1px solid #a07023;'+
 'font:700 13px system-ui;color:#ffe3a3">'+
 'AMBIENTE DE HOMOLOGAÇÃO — USAR SOMENTE DADOS FICTÍCIOS · NÃO É O CRM OFICIAL'+
 '</div>';
html=html.replace(before,caution+'\n'+before);
html=html.replace('OT Comercial V1.5 | Premium + Offline Lab',
 'OT Comercial | HOMOLOGAÇÃO ISOLADA');
fs.writeFileSync(indexFile,html);

const outConfig=fs.readFileSync(path.join(dest,'config.js'),'utf8');
assert.ok(outConfig.includes(stagingRef));
assert.ok(!outConfig.includes(productionRef));
assert.ok(fs.readFileSync(indexFile,'utf8').includes('AMBIENTE DE HOMOLOGAÇÃO'));
assert.ok(fs.existsSync(path.join(dest,'solucoes','site.html')));
assert.ok(fs.existsSync(path.join(dest,'offline-vault.js')));
assert.ok(fs.existsSync(path.join(dest,'field-sync.js')));

for(const [file,required,forbidden] of [
 ['app.js','ot_comercial_QA_v15_sessao','ot_comercial_v12_sessao'],
 ['app.js','ot_comercial_QA_offline_owner_v15','ot_comercial_offline_owner_v1'],
 ['offline-vault.js','ot-comercial-QA-encrypted-vault-v15','ot-comercial-encrypted-vault-v1'],
 ['sw.js','ot-comercial-QA-shell-','ot-comercial-shell-']
]){
 const data=fs.readFileSync(path.join(dest,file),'utf8');
 assert.ok(data.includes(required),file+' não foi isolado: '+required);
 assert.ok(!data.includes(forbidden),file+' mantém recurso do CRM oficial: '+forbidden);
}
assert.ok(!fs.readFileSync(path.join(dest,'sw.js'),'utf8')
 .includes("x.startsWith('ot-comercial-v13-shell-')"),
 'Preview de QA não pode apagar caches antigos do CRM oficial');
assert.ok(fs.readFileSync(indexFile,'utf8').includes('noindex,nofollow,noarchive'));


console.log('PREVIEW DE HOMOLOGAÇÃO GERADO (NÃO PUBLICADO):',dest);
console.log('Supabase destinado ao preview:',stagingRef,'| nenhum segredo de admin incluído');
