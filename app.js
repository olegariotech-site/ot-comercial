/* OT Comercial V1.2 — Frontend sem bibliotecas externas. Somente Supabase REST/Auth/Storage.
 * Não contém segredos. Configuração publicável em config.js; RLS é obrigatória.
 */
'use strict';
const $ = (id) => document.getElementById(id);
const cfg = window.OT_CONFIG || {};
const bucket = 'ot-clientes-privado';
const tokenStorageKey = 'ot_comercial_v12_sessao';
let session = null, userId = null, companies = [], active = null, photos = [], objectUrls = [];
let offlineMode=false, syncBusy=false;
const offlineOwnerKey='ot_comercial_offline_owner_v1';
function fieldReady(){return !!(userId&&window.OTOfflineVault?.activeOwner()===userId);}
function rememberedOwner(){try{return localStorage.getItem(offlineOwnerKey)||'';}catch{return '';}}
function rememberOwner(owner){try{localStorage.setItem(offlineOwnerKey,owner);}catch{}}
const statusGood = new Set(['Interessado','Proposta solicitada','Em negociação']);
const fields = ['nome','segmento','bairro','cidade','endereco','responsavel','whatsapp','presenca_digital','briefing','observacoes','status','retorno_em'];
function show(id) { ['setupView','loginView','offlineLoginView','appView'].forEach(x=>$(x).classList.toggle('hidden', x!==id)); $('logoutBtn').hidden=id!=='appView'; }
function toast(msg) { const el=$('toast');el.textContent=msg;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',6000); }
function fmtDate(v){ if(!v)return 'Não agendado'; const [y,m,d]=v.split('-');return `${d}/${m}/${y}`; }
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function safeFile(s){return String(s||'imagem').replace(/[\r\n\t]/g,' ').slice(0,130);}
function qs(obj){return Object.entries(obj).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');}
function safeErr(e){return e instanceof Error? e.message:String(e);}
function connOk(){try{const u=new URL(cfg.url);return u.protocol==='https:'&&!!cfg.publishableKey&&cfg.publishableKey!=='sb_publishable_SUA_CHAVE'&&!cfg.publishableKey.includes('service_role')&&!cfg.publishableKey.startsWith('sb_secret_');}catch{return false;}}
const base = connOk()?cfg.url.replace(/\/$/,''):'';
function headers(access=true){const h={'apikey':cfg.publishableKey};if(access&&session?.access_token)h.Authorization=`Bearer ${session.access_token}`;return h;}
function storeSession(value){session=value;try{if(value)sessionStorage.setItem(tokenStorageKey,JSON.stringify(value));else sessionStorage.removeItem(tokenStorageKey);}catch{ /* storage indisponível: sessão só em memória */ }}
async function raw(url,opts={}){let response;try{response=await fetch(url,opts);}catch{throw Error('Sem conexão com a internet. Dados não foram salvos.');}if(!response.ok){let msg=`Erro HTTP ${response.status}`;try{const d=await response.json();msg=d.msg||d.error_description||d.message||d.error||msg;}catch{}throw Error(msg);}return response;}
async function refreshSession(){if(!session?.refresh_token)throw Error('Faça login novamente.');
 const r=await raw(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{...headers(false),'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
 const d=await r.json();storeSession({...d,expires_at:Math.floor(Date.now()/1000)+d.expires_in});return d;}
async function authenticated(){if(!session?.access_token)throw Error('Você precisa entrar novamente.');
 if((session.expires_at||0)-Math.floor(Date.now()/1000)<60)await refreshSession();}
async function request(path,{method='GET',body,storage=false,retry=true}={}){
 await authenticated();const url=base+(storage?'/storage/v1/':'/rest/v1/')+path;
 const hs={...headers(true)};if(body!==undefined&&!storage)hs['Content-Type']='application/json';
 if(!storage&&['POST','PATCH'].includes(method))hs.Prefer='return=representation';
 let res;try{res=await fetch(url,{method,headers:hs,body:body===undefined?undefined:storage?body:JSON.stringify(body)});}catch{throw Error('Sem conexão. Operação não concluída.');}
 if(res.status===401&&retry){await refreshSession();return request(path,{method,body,storage,retry:false});}
 if(!res.ok){let msg=`Falha (${res.status})`;try{const d=await res.json();msg=d.message||d.error||d.msg||msg;}catch{}throw Error(msg);}
 if(storage)return res;
 if(res.status===204||res.headers.get('content-length')==='0')return [];
 const rawtxt=await res.text();return rawtxt?JSON.parse(rawtxt):[];
}
function encodePath(p){return p.split('/').map(encodeURIComponent).join('/');}
function convertRaw(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function dateToday(){return new Date().toLocaleDateString('en-CA');}
function destroyObjectUrls(){for(const u of objectUrls)URL.revokeObjectURL(u);objectUrls=[];}
async function login(email,password){const r=await raw(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{...headers(false),'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 const d=await r.json();storeSession({...d,expires_at:Math.floor(Date.now()/1000)+d.expires_in});
 const me=await raw(base+'/auth/v1/user',{headers:headers(true)});userId=(await me.json()).id;if(!userId)throw Error('Não foi possível validar o usuário.');}
async function restore(){try{const s=JSON.parse(sessionStorage.getItem(tokenStorageKey)||'null');if(!s)return false;session=s;await authenticated();const me=await raw(base+'/auth/v1/user',{headers:headers(true)});const u=await me.json();if(!u.id)throw Error('Sessão inválida');userId=u.id;return true;}catch{storeSession(null);userId=null;return false;}}
function logout(){window.OTOfflineVault?.lock();offlineMode=false;storeSession(null);userId=null;companies=[];active=null;photos=[];destroyObjectUrls();show('loginView');$('connectionState').textContent='Sessão encerrada';updateFieldState().catch(()=>{});}
async function updateFieldState(){
 const label=$('fieldState'),count=$('pendingCount'),button=$('syncPendingBtn');
 if(!label||!count||!button)return;
 if(!fieldReady()){
  label.textContent='Cofre bloqueado — prepare antes das visitas';
  count.textContent='Pendências não consultadas';button.disabled=true;return;
 }
 const p=await window.OTOfflineVault.pending();
 label.textContent=offlineMode?'Trabalhando com dados criptografados no aparelho':'Cofre desbloqueado — pronto para o campo';
 count.textContent=p.length+' pendente'+(p.length===1?'':'s');
 button.disabled=syncBusy||!p.length||navigator.onLine===false;
}
async function prepareVault(){
 if(!userId||offlineMode){toast('Entre na nuvem para preparar seu dispositivo.');return}
 const exists=await window.OTOfflineVault.has(userId);
 $('vaultExplanation').textContent=exists
  ?'Digite sua senha local para desbloquear os registros protegidos deste aparelho.'
  :'Crie uma senha local de pelo menos 12 caracteres. Sem ela, pendências não sincronizadas não podem ser recuperadas.';
 $('vaultPassword').value='';
 $('vaultForm').dataset.existing=exists?'yes':'no';
 $('vaultDialog').showModal();
}
async function handleVaultSetup(ev){
 ev.preventDefault();
 const btn=ev.submitter;btn.disabled=true;
 try{
  if(!userId||offlineMode)throw Error('Entre na nuvem primeiro.');
  const pass=$('vaultPassword').value;
  if($('vaultForm').dataset.existing==='yes')await window.OTOfflineVault.unlock(userId,pass);
  else await window.OTOfflineVault.create(userId,pass);
  $('vaultPassword').value='';$('vaultDialog').close();
  rememberOwner(userId);
  await window.OTOfflineVault.persist();
  await load();toast('Cofre local desbloqueado. Fichas consultadas ficam protegidas no aparelho.');
  await updateFieldState();
 }catch(e){toast('Cofre não ativado: '+safeErr(e));}
 finally{btn.disabled=false;}
}
async function unlockOffline(ev){
 ev.preventDefault();const btn=ev.submitter;btn.disabled=true;
 try{
  const owner=rememberedOwner();
  if(!owner||!await window.OTOfflineVault.has(owner))throw Error('Nenhum cofre offline preparado neste aparelho.');
  await window.OTOfflineVault.unlock(owner,$('offlinePassword').value);
  $('offlinePassword').value='';userId=owner;offlineMode=true;
  show('appView');$('connectionState').textContent='Offline — salvo no aparelho';
  await load();toast('Cofre desbloqueado. Registros feitos aqui aguardam a nuvem.');
 }catch(e){toast('Acesso offline negado: '+safeErr(e));}finally{btn.disabled=false;}
}
function cloudApi(owner){
 return {
  owner,
  getRow:async(table,id)=>{
   const rows=await request(table+'?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1');
   return rows[0]||null;
  },
  insertRow:async(table,row)=>request(table,{method:'POST',body:row}),
  updateReturn:async(companyId,date)=>request('ot_empresas?id=eq.'+encodeURIComponent(companyId),{
   method:'PATCH',body:{retorno_em:date}
  }),
  ensurePhoto:async(path,blob)=>{
   const url=base+'/storage/v1/object/'+bucket+'/'+encodePath(path);
   const readExisting=async(retry=true)=>{
    await authenticated();
    let resp;
    try{resp=await fetch(base+'/storage/v1/object/authenticated/'+bucket+'/'+encodePath(path),{
     headers:headers(true)
    });}catch{throw Error('Falha de conexão ao conferir a fotografia.');}
    if(resp.status===401&&retry){await refreshSession();return readExisting(false)}
    if(resp.status===404)return null;
    if(!resp.ok)throw Error('Não foi possível conferir fotografia na nuvem (HTTP '+resp.status+').');
    return resp.blob();
   };
   const fingerprint=async b=>{
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()));
    return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
   };
   const verify=async existing=>{
    if(!existing)return false;
    if(existing.size!==blob.size||await fingerprint(existing)!==await fingerprint(blob))
     throw Error('Conflito: o arquivo remoto é diferente do arquivo local.');
    return true;
   };
   if(await verify(await readExisting()))return;
   await authenticated();let resp;
   try{resp=await fetch(url,{method:'POST',headers:{...headers(true),'Content-Type':blob.type,
    'x-upsert':'false'},body:blob})}catch{throw Error('Envio interrompido; foto mantida no cofre.');}
   if(!resp.ok){
    if(resp.status===409&&await verify(await readExisting()))return;
    throw Error('Upload não concluído (HTTP '+resp.status+').');
   }
   if(!await verify(await readExisting()))throw Error('Servidor ainda não confirmou o arquivo.');
  }
 };
}
async function syncNow(){
 if(syncBusy||!fieldReady())return;
 if(navigator.onLine===false){toast('Sem internet: seus registros permanecem no aparelho.');return}
 syncBusy=true;await updateFieldState();
 try{
  if(offlineMode||!session?.access_token){
   const owner=window.OTOfflineVault.activeOwner(),ok=await restore();
   if(!ok||owner!==userId){
    offlineMode=false;show('loginView');
    toast('Entre na nuvem com a MESMA conta para sincronizar os dados locais.');return;
   }
   offlineMode=false;show('appView');
  }
  await authenticated();
  const summary=await window.OTFieldSync.sync({vault:window.OTOfflineVault,api:cloudApi(userId),
   owner:userId,online:()=>navigator.onLine!==false});
  if(summary.failed){
   toast(summary.synced+' sincronizados; '+summary.pending+' pendentes. Nenhum registro local foi descartado.');
  }else if(summary.synced){toast(summary.synced+' registros confirmados na nuvem.');}
  if(!offlineMode)await load();
 }catch(e){toast('Sincronização não concluída: '+safeErr(e));}
 finally{syncBusy=false;await updateFieldState();}
}
async function load(){
 if(offlineMode){
  if(!fieldReady())throw Error('Cofre bloqueado');
  companies=await window.OTOfflineVault.list('company');
  render();return;
 }
 const items=await request('ot_empresas?select=*&order=created_at.desc');
 if(fieldReady())await window.OTOfflineVault.snapshot('company',items);
 const locals=fieldReady()?await window.OTOfflineVault.list('company'):[];
 const byId=new Map(items.map(item=>[item.id,item]));
 if(fieldReady()){
  const pending=await window.OTOfflineVault.pending();
  const pendingIds=new Set(pending.filter(x=>x.kind==='company').map(x=>x.payload.id));
  for(const local of locals)if(pendingIds.has(local.id)&&!byId.has(local.id))byId.set(local.id,local);
 }
 companies=[...byId.values()];render();await updateFieldState();
}
function render(){const term=convertRaw($('search').value.trim());const status=$('statusFilter').value;
 const filtered=companies.filter(c=>(!status||c.status===status)&&(!term||convertRaw([c.nome,c.bairro,c.cidade,c.responsavel,c.segmento,c.whatsapp].join(' ')).includes(term)));
 $('countAll').textContent=companies.length;
 $('countHot').textContent=companies.filter(c=>statusGood.has(c.status)).length;
 $('countLate').textContent=companies.filter(c=>c.retorno_em&&c.retorno_em<dateToday()&&c.status!=='Cliente fechado').length;
 $('countWon').textContent=companies.filter(c=>c.status==='Cliente fechado').length;
 $('companyList').innerHTML=filtered.map(c=>`<button type="button" class="company-card" data-id="${esc(c.id)}"><div class="name">${esc(c.nome)}</div><div class="meta">${esc(c.segmento)} · ${esc(c.bairro||c.cidade)}</div><div class="meta">${esc(c.responsavel||'Contato a identificar')}</div><div class="brief">${esc((c.briefing||'').slice(0,140))}</div><div class="status">${esc(c.status)}${c.retorno_em?' · Retorno '+fmtDate(c.retorno_em):''}</div></button>`).join('')||'<div class="empty">Nenhuma empresa nesta seleção. Comece em “Nova empresa”.</div>';
}
function openForm(c=null){const form=$('companyForm');form.reset();form.dataset.id=c?.id||'';$('dialogTitle').textContent=c?'Editar ficha':'Nova empresa';if(c)for(const field of fields){const el=form.elements.namedItem(field);if(el)el.value=c[field]??'';}$('companyDialog').showModal();}
function formData(){const d={};for(const k of fields){const val=$('companyForm').elements.namedItem(k).value.trim();d[k]=k==='retorno_em'?(val||null):val;}return d;}
async function saveCompany(ev){ev.preventDefault();const btn=ev.submitter;btn.disabled=true;
 try{
  const data=formData(),id=$('companyForm').dataset.id;
  if(!data.nome||!data.briefing)throw Error('Informe nome e pedido.');
  if(id&&(offlineMode||navigator.onLine===false))throw Error('Edição de ficha existente requer internet.');
  if(!id&&fieldReady()){
   const r=await OTOfflineVault.stage('company',{id:crypto.randomUUID(),...data});
   $('companyDialog').close();companies.unshift({id:r.id,...data});render();
   await updateFieldState();toast('Ficha criptografada no aparelho. Envio pendente.');
   await openCompany(r.id);
   if(!offlineMode&&navigator.onLine!==false)await syncNow();
   return;
  }
  if(offlineMode||navigator.onLine===false)throw Error('Desbloqueie o cofre antes de usar sem internet.');
  const p=id?'ot_empresas?id=eq.'+encodeURIComponent(id):'ot_empresas';
  const [record]=await request(p,{method:id?'PATCH':'POST',body:data});
  $('companyDialog').close();await load();toast('Ficha salva na nuvem.');
  if(record)await openCompany(record.id);
 }catch(e){toast('Não salvou: '+safeErr(e));}finally{btn.disabled=false;}
}
async function openCompany(id){active=companies.find(c=>c.id===id);if(!active)return;
 $('companyPanel').classList.remove('hidden');$('panelTitle').textContent=active.nome;
 $('panelInfo').textContent=`${active.bairro||'Bairro não informado'} · ${active.endereco||'Endereço não informado'} · ${active.responsavel||'Responsável não informado'} · ${active.whatsapp||'Sem WhatsApp'} · ${active.status}`;
 $('panelBriefing').textContent=active.briefing||'Sem briefing';$('panelNotes').textContent=active.observacoes||'Sem observações';
 $('visitForm').reset();$('photoConsent').checked=false;
 await Promise.all([loadVisits(id),loadPhotos(id)]);$('companyPanel').scrollIntoView({behavior:'smooth',block:'start'});}
async function loadVisits(id){
 let remote=[];
 if(!offlineMode&&navigator.onLine!==false){
  remote=await request('ot_visitas?select=*&empresa_id=eq.'+encodeURIComponent(id)+'&order=realizado_em.desc&limit=50');
  if(fieldReady())await OTOfflineVault.snapshot('visit',remote);
 }
 const local=fieldReady()?(await OTOfflineVault.list('visit')).filter(v=>v.empresa_id===id):[];
 const merged=new Map(remote.map(row=>[row.id,row]));
 for(const visit of local)if(!merged.has(visit.id))merged.set(visit.id,visit);
 const pending=new Set(fieldReady()?(await OTOfflineVault.pending()).filter(x=>x.kind==='visit').map(x=>x.payload.id):[]);
 const list=[...merged.values()].sort((a,b)=>String(b.realizado_em||'').localeCompare(String(a.realizado_em||'')));
 $('visitList').innerHTML=list.map(v=>'<article><small>'+
  esc(v.realizado_em?new Date(v.realizado_em).toLocaleString('pt-BR'):'Sem data')+
  (pending.has(v.id)?' · Salvo no aparelho':'')+'</small><p class="note-text">'+esc(v.nota)+
  '</p><small>'+esc(v.proximo_passo||'Sem próximo passo')+
  (v.retorno_em?' · '+fmtDate(v.retorno_em):'')+'</small></article>').join('')||
  '<div class="empty">Nenhuma visita registrada ainda.</div>';
}
async function saveVisit(ev){ev.preventDefault();if(!active)return;const btn=ev.submitter;btn.disabled=true;
 try{const nota=$('visitNote').value.trim();if(!nota)throw Error('Descreva a conversa.');const retorno=$('visitReturn').value||null;
 await request('ot_visitas',{method:'POST',body:{empresa_id:active.id,nota,proximo_passo:$('visitNext').value.trim(),retorno_em:retorno}});
 if(retorno){await request(`ot_empresas?id=eq.${active.id}`,{method:'PATCH',body:{retorno_em:retorno}});active.retorno_em=retorno;}
 $('visitForm').reset();await loadVisits(active.id);render();toast('Visita e próximo passo salvos.');
 }catch(e){toast('Atenção: '+safeErr(e)+' Confira o histórico antes de repetir.');}finally{btn.disabled=false;}}
async function loadPhotos(id){destroyObjectUrls();photos=await request(`ot_fotos?select=*&empresa_id=eq.${encodeURIComponent(id)}&order=created_at.desc`);renderPhotoCards();
 for(const photo of photos){if(active?.id!==id)break;try{const resp=await request(`object/authenticated/${bucket}/${encodePath(photo.storage_path)}`,{storage:true});const blob=await resp.blob();const url=URL.createObjectURL(blob);objectUrls.push(url);const im=document.getElementById('img-'+photo.id);if(im)im.src=url;}catch{ /* restrição/falha isolada: não oferece imagem publicamente */ }} }
function renderPhotoCards(){$('photoList').innerHTML=photos.map(p=>`<article class="photo-card"><img id="img-${esc(p.id)}" alt="${esc(p.categoria)} — ${esc(p.arquivo_nome)}" loading="lazy"><div class="photo-body"><strong>${esc(p.arquivo_nome)}</strong><p>${esc(p.categoria)}${p.publicacao_autorizada?' · uso autorizado':' · uso não autorizado'}</p><div class="photo-actions"><button class="btn secondary" data-download="${esc(p.id)}">↓ Baixar</button><button class="btn danger" data-delete-photo="${esc(p.id)}">Excluir</button></div></div></article>`).join('')||'<div class="empty">Ainda não há fotos. Use a câmera ou selecione imagens.</div>';}
async function uploadPhotos(fileList){if(!active||!fileList.length)return;const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};const selected=[...fileList];let done=0;
 for(const file of selected){try{if(!allowed[file.type])throw Error(`Formato não aceito (${file.name}). Use JPG, PNG ou WebP.`);if(file.size>6*1024*1024)throw Error(`Foto acima de 6 MB: ${file.name}`);if(photos.length+done>=12)throw Error('Limite inicial de 12 fotos por empresa.');
 const path=`${userId}/${active.id}/${crypto.randomUUID()}.${allowed[file.type]}`;
 await authenticated();const upload=await raw(`${base}/storage/v1/object/${bucket}/${encodePath(path)}`,{method:'POST',headers:{...headers(true),'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!upload.ok)throw Error('Falha no envio da foto.');
 try{await request('ot_fotos',{method:'POST',body:{empresa_id:active.id,storage_path:path,arquivo_nome:safeFile(file.name),categoria:$('photoCategory').value,bytes:file.size,publicacao_autorizada:$('photoConsent').checked}});}catch(e){try{await request(`object/${bucket}/${encodePath(path)}`,{method:'DELETE',storage:true});}catch{}throw e;}
 done++;toast(`Foto ${done} de ${selected.length} salva na nuvem.`);
 }catch(e){toast('Foto não salva: '+safeErr(e));}}
 $('photoCamera').value='';$('photoFiles').value='';try{await loadPhotos(active.id);}catch(e){toast('Fotos enviadas, mas atualização da galeria falhou: '+safeErr(e));}}
async function downloadPhoto(id){const p=photos.find(x=>x.id===id);if(!p)return;try{const resp=await request(`object/authenticated/${bucket}/${encodePath(p.storage_path)}`,{storage:true});const blob=await resp.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=p.arquivo_nome||'foto';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){toast('Download falhou: '+safeErr(e));}}
async function deletePhoto(id){const p=photos.find(x=>x.id===id);if(!p||!confirm('Excluir esta foto da nuvem permanentemente?'))return;
 try{await request(`object/${bucket}/${encodePath(p.storage_path)}`,{method:'DELETE',storage:true});await request(`ot_fotos?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});await loadPhotos(active.id);toast('Foto excluída.');}catch(e){toast('Exclusão incompleta: '+safeErr(e));}}
async function deleteCompany(){if(!active||!confirm(`Excluir ${active.nome} e todo o histórico? A exclusão é definitiva.`))return;
 try{if(photos.length)throw Error('Baixe e exclua as fotos antes de remover a empresa, evitando arquivos órfãos.');await request(`ot_empresas?id=eq.${active.id}`,{method:'DELETE'});active=null;$('companyPanel').classList.add('hidden');await load();toast('Empresa removida.');}catch(e){toast('Não excluído: '+safeErr(e));}}
function exportCsv(){const columns=['nome','segmento','bairro','cidade','endereco','responsavel','whatsapp','presenca_digital','briefing','observacoes','status','retorno_em','created_at'];
 const clean=v=>{const s=String(v??'');return '"'+(/^[\s]*[=+@\-\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';};
 const rows=[columns.join(';'),...companies.map(c=>columns.map(k=>clean(c[k])).join(';'))];const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ot-comercial-empresas-${dateToday()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);toast('CSV exportado. Fotos precisam de download separado.');}
async function boot(){if(!connOk()){show('setupView');return;}
 $('connectionState').textContent='Projeto configurado';if(await restore()){show('appView');$('connectionState').textContent='Nuvem conectada';try{await load();}catch(e){toast('Falha ao buscar carteira: '+safeErr(e));}}else show('loginView');}
$('loginForm').addEventListener('submit',async ev=>{ev.preventDefault();const btn=ev.submitter;btn.disabled=true;try{await login($('email').value,$('password').value);$('password').value='';show('appView');$('connectionState').textContent='Nuvem conectada';await load();toast('Login autorizado.');}catch(e){storeSession(null);toast('Falha ao entrar: '+safeErr(e));}finally{btn.disabled=false;}});
$('logoutBtn').addEventListener('click',logout);$('newBtn').addEventListener('click',()=>openForm());$('companyForm').addEventListener('submit',saveCompany);$('cancelCompany').addEventListener('click',()=>$('companyDialog').close());
$('companyList').addEventListener('click',ev=>{const b=ev.target.closest('[data-id]');if(b)openCompany(b.dataset.id).catch(e=>toast('Falha ao abrir: '+safeErr(e)));});
$('search').addEventListener('input',render);$('statusFilter').addEventListener('change',render);$('closePanel').addEventListener('click',()=>{active=null;destroyObjectUrls();$('companyPanel').classList.add('hidden');});
$('editBtn').addEventListener('click',()=>active&&openForm(active));$('deleteCompanyBtn').addEventListener('click',deleteCompany);$('visitForm').addEventListener('submit',saveVisit);$('photoFiles').addEventListener('change',ev=>uploadPhotos(ev.target.files));$('photoCamera').addEventListener('change',ev=>uploadPhotos(ev.target.files));
$('photoList').addEventListener('click',ev=>{const d=ev.target.closest('[data-download]'),x=ev.target.closest('[data-delete-photo]');if(d)downloadPhoto(d.dataset.download);if(x)deletePhoto(x.dataset.deletePhoto);});$('exportBtn').addEventListener('click',exportCsv);
boot();
