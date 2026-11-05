// Gate de isolamento do pacote QA no mesmo host github.io de outros projetos.
// Deve ser executado DEPOIS de: node tests/staging/build-preview.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'artifacts','staging-preview');
const read=p=>fs.readFileSync(path.join(output,p),'utf8');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const config=read('config.js'),app=read('app.js'),vault=read('offline-vault.js'),worker=read('sw.js');
const html=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest'));
assert.match(config,/https:\/\/efscgxwvaixwqhffwdqu\.supabase\.co/);
assert.doesNotMatch(config,/agvjqxmrzffkksrgdndn|sb_secret_|service_role|eyJhbGciOiJ/);
assert.match(app,/ot_comercial_QA_v15_sessao/);
assert.match(app,/ot_comercial_QA_offline_owner_v15/);
assert.doesNotMatch(app,/ot_comercial_v12_sessao|ot_comercial_offline_owner_v1/);
assert.match(vault,/ot-comercial-QA-encrypted-vault-v15/);
assert.doesNotMatch(vault,/ot-comercial-encrypted-vault-v1/);
assert.match(worker,/ot-comercial-QA-shell-/);
assert.match(worker,/v1-5-staging-v2/);
assert.doesNotMatch(worker,/ot-comercial-shell-|ot-comercial-v13-shell-/);
assert.match(html,/AMBIENTE DE HOMOLOGAÇÃO/);
assert.match(html,/noindex,nofollow,noarchive/);
assert.equal(manifest.name,'OT Comercial — HOMOLOGAÇÃO');
assert.equal(manifest.short_name,'OT Campo QA');
assert.ok(read('robots.txt').includes('Disallow: /'));
for(const f of ['index.html','app.js','config.js','style.css','sw.js','offline-vault.js','field-sync.js','ot-icon.svg']){
 assert.ok(fs.statSync(path.join(output,f)).size>0,f+' ausente ou vazio');
}
for(const p of ['app.js','offline-vault.js','sw.js']){
 assert.notEqual(read(p),source(p),p+' não recebeu namespace exclusivo');
}
assert.match(source('app.js'),/ot_comercial_v12_sessao/);
assert.match(source('offline-vault.js'),/ot-comercial-encrypted-vault-v1/);
console.log('ISOLAMENTO QA PASSOU: Supabase staging, sessões, cofre, cache e PWA distintos; fontes do CRM preservadas.');
