/**
 * OT Comercial | Gate D | Teste autenticado em Supabase STAGING.
 *
 * Nunca use credenciais reais ou URL de produção. O teste só permite o ref
 * fixo de homologação. Executar localmente com variáveis de ambiente:
 * OT_QA_EMAIL, OT_QA_PASSWORD, OT_STAGING_PUBLIC_KEY.
 * Opcional: OT_QA_EMAIL_2 e OT_QA_PASSWORD_2 para teste de isolamento RLS.
 *
 * O fluxo gera APENAS dados fictícios; apaga somente os IDs que ele criou.
 * Não imprimir senhas, tokens, chaves nem respostas com dados pessoais.
 */
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';

const PROJECT_REF='efscgxwvaixwqhffwdqu';
const URL='https://'+PROJECT_REF+'.supabase.co';
const PRODUCTION_REF='agvjqxmrzffkksrgdndn';
const BUCKET='ot-clientes-privado';
const KEY=process.env.OT_STAGING_PUBLIC_KEY||'';
const EMAIL=process.env.OT_QA_EMAIL||'';
const PASSWORD=process.env.OT_QA_PASSWORD||'';
const EMAIL2=process.env.OT_QA_EMAIL_2||'';
const PASSWORD2=process.env.OT_QA_PASSWORD_2||'';
if(!KEY.startsWith('sb_publishable_'))throw Error('Informe apenas OT_STAGING_PUBLIC_KEY pública do staging.');
if(!EMAIL||!PASSWORD)throw Error('Conta fictícia faltando: OT_QA_EMAIL / OT_QA_PASSWORD.');
if(URL.includes(PRODUCTION_REF))throw Error('ALERTA: URL de produção proibida.');

const headers=(token,extra={})=>({
 apikey:KEY,
 ...(token?{Authorization:'Bearer '+token}:{}),
 ...extra
});
const toJSON=async response=>{
 const raw=await response.text();
 try{return raw?JSON.parse(raw):null}catch{return null}
};
async function api(method,route,token,data,{contentType='application/json',prefer}={}){
 const options={method,headers:headers(token,{...(data!==undefined?{'Content-Type':contentType}:{}),
  ...(prefer?{Prefer:prefer}:{})}),signal:AbortSignal.timeout(20000)};
 if(data!==undefined)options.body=contentType==='application/json'?JSON.stringify(data):data;
 const response=await fetch(URL+route,options);
 return {status:response.status,ok:response.ok,data:await toJSON(response)};
}
async function login(email,password){
 const result=await api('POST','/auth/v1/token?grant_type=password',null,{email,password});
 assert.equal(result.status,200,'Conta de testes não autenticou no staging');
 assert.ok(result.data?.access_token,'Sem token de teste');
 const user=await api('GET','/auth/v1/user',result.data.access_token);
 assert.equal(user.status,200,'Sessão de teste não autorizada');
 assert.match(user.data?.id||'',/^[a-f0-9-]{36}$/i);
 return {token:result.data.access_token,owner:user.data.id};
}
async function deleteById(table,id,token){
 await api('DELETE','/rest/v1/'+table+'?id=eq.'+encodeURIComponent(id),token);
}
async function test(){
 const a=await login(EMAIL,PASSWORD);
 const b=EMAIL2&&PASSWORD2?await login(EMAIL2,PASSWORD2):null;
 if(b)assert.notEqual(a.owner,b.owner,'Usuários de teste devem ser distintos');
 const companyId=randomUUID(),visitId=randomUUID(),photoId=randomUUID();
 const fileName=photoId+'.png';
 const path=a.owner+'/'+companyId+'/'+fileName;
 const encodedPath=path.split('/').map(encodeURIComponent).join('/');
 // PNG válido 1x1 transparente, sem pessoas ou dados de cliente.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+jVwAAAAASUVORK5CYII=','base64');
 const photoHash=createHash('sha256').update(png).digest('hex');
 let createdCompany=false,createdVisit=false,createdPhoto=false,uploaded=false;
 try{
  const company={
   id:companyId,nome:'QA OT HOMOLOGACAO '+companyId.slice(0,8),segmento:'Outro',
   bairro:'Teste isolado',cidade:'Valinhos',endereco:'',responsavel:'',
   whatsapp:'',presenca_digital:'',briefing:'Teste automatizado do CRM; nenhum cliente real',
   observacoes:'Apagar ao final',status:'Primeira visita',retorno_em:null
  };
  let r=await api('POST','/rest/v1/ot_empresas',a.token,company,{prefer:'return=representation'});
  assert.equal(r.status,201,'Empresa não inserida no staging');
  assert.equal(r.data?.[0]?.id,companyId);
  createdCompany=true;

  const visit={id:visitId,empresa_id:companyId,nota:'Visita fictícia de homologação',
   proximo_passo:'Validar sincronização offline',retorno_em:null,
   realizado_em:new Date().toISOString()};
  r=await api('POST','/rest/v1/ot_visitas',a.token,visit,{prefer:'return=representation'});
  assert.equal(r.status,201,'Visita não inserida no staging');
  assert.equal(r.data?.[0]?.id,visitId);
  createdVisit=true;

  const upload=await fetch(URL+'/storage/v1/object/'+BUCKET+'/'+encodedPath,{
   method:'POST',headers:headers(a.token,{'Content-Type':'image/png','x-upsert':'false'}),
   body:png,signal:AbortSignal.timeout(20000)
  });
  assert.equal(upload.status,200,'Upload de foto fictícia falhou');
  uploaded=true;

  const saved=await fetch(URL+'/storage/v1/object/authenticated/'+BUCKET+'/'+encodedPath,{
   headers:headers(a.token),signal:AbortSignal.timeout(20000)
  });
  assert.equal(saved.status,200,'Foto não acessível pela conta de teste');
  assert.equal(createHash('sha256').update(Buffer.from(await saved.arrayBuffer())).digest('hex'),
   photoHash,'Foto obtida não confere com a enviada');

  const photo={id:photoId,empresa_id:companyId,storage_path:path,arquivo_nome:fileName,
   categoria:'Fachada',descricao:'PNG de QA',bytes:png.length,publicacao_autorizada:false};
  r=await api('POST','/rest/v1/ot_fotos',a.token,photo,{prefer:'return=representation'});
  assert.equal(r.status,201,'Metadados de foto não inseridos');
  assert.equal(r.data?.[0]?.id,photoId);
  createdPhoto=true;

  for(const [table,id] of [['ot_empresas',companyId],['ot_visitas',visitId],['ot_fotos',photoId]]){
   r=await api('GET','/rest/v1/'+table+'?select=id&id=eq.'+id,a.token);
   assert.equal(r.status,200,'Falha GET de '+table);
   assert.equal(r.data?.length,1,'Confirmação HTTP não encontrou '+table);
   r=await api('GET','/rest/v1/'+table+'?select=id&id=eq.'+id,b?.token||null);
   if(b){assert.equal(r.status,200,'GET secundário não autorizado');assert.equal(r.data?.length,0,'RLS falhou em '+table)}
   else assert.ok([401,403].includes(r.status)||r.data?.length===0,'Anon viu um dado de '+table);
  }
  if(b){
   const forbidden=await fetch(URL+'/storage/v1/object/authenticated/'+BUCKET+'/'+encodedPath,{
    headers:headers(b.token),signal:AbortSignal.timeout(20000)
   });
   assert.ok([400,401,403,404].includes(forbidden.status),'Segundo usuário conseguiu ler imagem do primeiro');
  }
  // Simular retry com ID fixo. Deve recusar duplicata, não criar outra empresa.
  r=await api('POST','/rest/v1/ot_empresas',a.token,company,{prefer:'return=representation'});
  assert.equal(r.status,409,'Retry com mesmo UUID não foi barrado por PK');
  r=await api('GET','/rest/v1/ot_empresas?select=id&id=eq.'+companyId,a.token);
  assert.equal(r.data?.length,1,'Houve duplicação na nuvem');

  console.log('STAGING APROVADO: empresa, visita, foto privada, confirmação REST, PK idempotente'+
   (b?', RLS entre 2 usuários':' e leitura anônima bloqueada')+'.');
 }finally{
  // Limpeza somente dos UUIDs exclusivos desta execução, nunca por bairro/status ou data.
  if(createdPhoto)await deleteById('ot_fotos',photoId,a.token).catch(()=>{});
  if(uploaded)await fetch(URL+'/storage/v1/object/'+BUCKET+'/'+encodedPath,{
   method:'DELETE',headers:headers(a.token),signal:AbortSignal.timeout(20000)
  }).catch(()=>{});
  if(createdVisit)await deleteById('ot_visitas',visitId,a.token).catch(()=>{});
  if(createdCompany)await deleteById('ot_empresas',companyId,a.token).catch(()=>{});
  console.log('Limpeza de testes solicitada. Conferir dados residuais no painel staging.');
 }
}
await test();
