/* OT Comercial V1.5 Gate C — sincronização explícita, idempotente por ID.
 * Sem Supabase no módulo: comunicação é injetada pelo CRM autenticado.
 * NUNCA remove fila sem confirmação de leitura/gravação no servidor.
 */
'use strict';
window.OTFieldSync=(()=>{
 const KIND_ORDER={company:0,visit:1,photo:2};
 const TABLE={company:'ot_empresas',visit:'ot_visitas',photo:'ot_fotos'};
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function requireUuid(id,label){if(typeof id!=='string'||!UUID.test(id))throw Error(label+' não é UUID válido.');return id}
 function data(kind,row){
  if(kind==='company'){
   const keys=['id','nome','segmento','bairro','cidade','endereco','responsavel','whatsapp','presenca_digital','briefing','observacoes','status','retorno_em'];
   const out={};for(const k of keys)if(row[k]!==undefined)out[k]=row[k];
   return out;
  }
  if(kind==='visit'){
   const keys=['id','empresa_id','nota','proximo_passo','retorno_em','realizado_em'];
   const out={};for(const k of keys)if(row[k]!==undefined)out[k]=row[k];
   return out;
  }
  if(kind==='photo'){
   const keys=['id','empresa_id','storage_path','arquivo_nome','categoria','descricao','bytes','publicacao_autorizada'];
   const out={};for(const k of keys)if(row[k]!==undefined)out[k]=row[k];
   return out;
  }
  throw Error('Tipo inválido');
 }
 function matches(kind,remote,local){
  const keys=kind==='company'?['id','nome','briefing']:kind==='visit'?['id','empresa_id','nota']:['id','empresa_id','storage_path','bytes'];
  return keys.every(key=>String(remote[key]??'')===String(local[key]??''));
 }
 function extension(mime){return {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime]}
 function deterministicPhotoPath(owner,record){
  requireUuid(owner,'Proprietário');requireUuid(record.empresa_id,'Empresa');requireUuid(record.id,'Foto');
  const ext=extension(record.mime);
  if(!ext)throw Error('Formato de foto inválido');
  return owner+'/'+record.empresa_id+'/'+record.id+'.'+ext;
 }
 function withoutExtras(kind,payload){return data(kind,payload)}
 async function sync({vault,api,owner,online,onProgress}){
  if(!vault||!api)throw Error('Cofre e API obrigatórios');
  requireUuid(owner,'Proprietário');
  if(vault.activeOwner()!==owner)throw Error('Desbloqueie o cofre correto antes de sincronizar');
  if(typeof online==='function'&&!online())throw Error('Dispositivo sem conexão; dados preservados no cofre');
  if(api.owner!==owner)throw Error('Sessão de outro usuário. Nenhum dado foi enviado.');
  const ops=await vault.pending();
  const sorted=ops.slice().sort((a,b)=>(KIND_ORDER[a.kind]??99)-(KIND_ORDER[b.kind]??99)||a.createdAt-b.createdAt);
  const result={total:sorted.length,synced:0,failed:0,pending:sorted.length,errors:[]};
  for(const task of sorted){
   try{
    if(typeof online==='function'&&!online())throw Error('Conexão perdida');
    if(vault.activeOwner()!==owner||api.owner!==owner)throw Error('Sessão alterada durante sincronização');
    if(task.payload.action!=='upsert')throw Error('Operação ainda não suportada: '+task.payload.action);
    const kind=task.kind,id=requireUuid(task.payload.id,'Registro');
    if(!TABLE[kind])throw Error('Tipo de registro não reconhecido');
    const remote=await api.getRow(TABLE[kind],id);
    if(remote){
     let local;
     if(kind==='photo'){
      const photo=await vault.getPhoto(id);if(!photo)throw Error('Foto local não encontrada');
      local={...photo.metadata,storage_path:deterministicPhotoPath(owner,photo.metadata)};
     }else local=await vault.get(kind,id);
     if(!local||!matches(kind,remote,local))throw Error('Conflito: registro com o mesmo ID foi alterado na nuvem');
     if(kind==='visit'&&local.retorno_em)await api.updateReturn(local.empresa_id,local.retorno_em);
     await vault.acknowledge(task.opId);result.synced++;result.pending--;onProgress?.(result);continue;
    }
    let local;
    if(kind==='photo'){
     const photo=await vault.getPhoto(id);
     if(!photo)throw Error('Imagem criptografada indisponível no aparelho');
     local={...photo.metadata,storage_path:deterministicPhotoPath(owner,photo.metadata)};
     // Upload determinístico: se a resposta anterior se perdeu, comparar o SHA-256.
     await api.ensurePhoto(local.storage_path,photo.blob);
    }else{
     local=await vault.get(kind,id);
     if(!local)throw Error('Registro local indisponível');
    }
    const row=withoutExtras(kind,local);
    try{await api.insertRow(TABLE[kind],row)}
    catch(err){
     // A resposta de um POST pode se perder depois do commit. Releitura confirma.
     const existing=await api.getRow(TABLE[kind],id);
     if(!existing||!matches(kind,existing,row))throw err;
    }
    const confirmed=await api.getRow(TABLE[kind],id);
    if(!confirmed||!matches(kind,confirmed,row))throw Error('Servidor não confirmou o registro');
    if(kind==='visit'&&row.retorno_em)await api.updateReturn(row.empresa_id,row.retorno_em);
    await vault.acknowledge(task.opId);
    result.synced++;result.pending--;
   }catch(e){
    result.failed++;result.errors.push({id:task.payload?.id||'',kind:task.kind,message:e instanceof Error?e.message:String(e)});
    try{await vault.failed(task.opId)}catch{}
    // Se falhou uma empresa, visitas e fotos relacionadas não devem ser removidas.
   }
   onProgress?.(result);
  }
  return result;
 }
 return {sync,deterministicPhotoPath,data};
})();
