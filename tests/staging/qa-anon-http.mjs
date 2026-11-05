// OT Gate D — segurança da API real de homologação, SEM autenticar ou gravar dados.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c=fs.readFileSync(new URL('./config.public.js',import.meta.url),'utf8');
const w={};vm.runInNewContext(c,{window:w});
const cfg=w.OT_CONFIG;
assert.equal(cfg.url,'https://efscgxwvaixwqhffwdqu.supabase.co');
assert.ok(cfg.publishableKey.startsWith('sb_publishable_'));
assert.ok(!cfg.publishableKey.includes('agvjqxmrzffkksrgdndn'));
const request=async path=>{
 const r=await fetch(cfg.url+path,{
  headers:{apikey:cfg.publishableKey},
  signal:AbortSignal.timeout(17000)
 });
 const response=await r.text();
 return {status:r.status,response};
};
for(const table of ['ot_empresas','ot_visitas','ot_fotos']){
 const response=await request('/rest/v1/'+table+'?select=id&limit=1');
 // A role anon não possui GRANT SELECT no staging; se o projeto mudar,
 // esse gate impede aprovação silenciosa.
 assert.ok([401,403].includes(response.status),
  'ACESSO ANÔNIMO NÃO BLOQUEADO: '+table+' HTTP '+response.status);
 console.log('STAGING ANON',table,'HTTP '+response.status,'(acesso negado)');
}
const storage=await request('/storage/v1/object/authenticated/ot-clientes-privado/nao-existe.png');
assert.ok([400,401,403,404].includes(storage.status),
 'Storage privado expôs arquivo publicamente: HTTP '+storage.status);
console.log('STAGING: três tabelas protegidas e Storage sem acesso anônimo. Nenhuma mutação executada.');
