/* OT Comercial V1.2 — Frontend sem bibliotecas externas. Somente Supabase REST/Auth/Storage.
 * Não contém segredos. Configuração publicável em config.js; RLS é obrigatória.
 */
'use strict';
const $ = (id) => document.getElementById(id);
const cfg = window.OT_CONFIG || {};
const bucket = 'ot-clientes-privado';
const tokenStorageKey = 'ot_comercial_v12_sessao';
let session = null, userId = null, companies = [], active = null, photos = [], objectUrls = [];
const statusGood = new Set(['Interessado','Proposta solicitada','Em negociação']);
const fields = ['nome','segmento','bairro','cidade','endereco','responsavel','whatsapp','presenca_digital','briefing','observacoes','status','retorno_em'];
function show(id) { ['setupView','loginView','offlineView','appView'].forEach(x=>$(x).classList.toggle('hidden', x!==id)); $('logoutBtn').hidden=id!=='appView';if(window.OTOffline)queueMicrotask(()=>updateOfflineBar().catch(()=>{})); }
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
async function request(path,{method='GET',body,storage=false,retry=true,prefer=null}={}){
 await authenticated();const url=base+(storage?'/storage/v1/':'/rest/v1/')+path;
 const hs={...headers(true)};if(body!==undefined&&!storage)hs['Content-Type']='application/json';
 if(!storage&&['POST','PATCH'].includes(method))hs.Prefer=prefer||'return=representation';
 let res;try{res=await fetch(url,{method,headers:hs,body:body===undefined?undefined:storage?body:JSON.stringify(body)});}catch{throw Error('Sem conexão. Operação não concluída.');}
 if(res.status===401&&retry){await refreshSession();return request(path,{method,body,storage,prefer,retry:false});}
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
function logout(){storeSession(null);userId=null;companies=[];active=null;photos=[];destroyObjectUrls();Offline.lock();show('loginView');$('connectionState').textContent='Sessão encerrada';}
async function load(){
 if(!isOnline()||!session){await offlineLoad();return;}
 try{const items=await request('ot_empresas?select=*&order=created_at.desc');
   await cacheRemoteCompanies(items);
   if(localReady()){const local=await cachedCompanies(),pending=local.filter(x=>x._localState!=='synced');const pendingIds=new Set(pending.map(x=>x.id));companies=[...pending,...items.filter(x=>!pendingIds.has(x.id))];}
   else companies=items;
   render();await updateOfflineBar();
 }catch(e){if(localReady()){await offlineLoad();toast('Sem conexão. Exibindo dados locais protegidos.');}else throw e;}
}
function render(){const term=convertRaw($('search').value.trim());const status=$('statusFilter').value;
 const filtered=companies.filter(c=>(!status||c.status===status)&&(!term||convertRaw([c.nome,c.bairro,c.cidade,c.responsavel,c.segmento,c.whatsapp].join(' ')).includes(term)));
 $('countAll').textContent=companies.length;
 $('countHot').textContent=companies.filter(c=>statusGood.has(c.status)).length;
 $('countLate').textContent=companies.filter(c=>c.retorno_em&&c.retorno_em<dateToday()&&c.status!=='Cliente fechado').length;
 $('countWon').textContent=companies.filter(c=>c.status==='Cliente fechado').length;
 $('companyList').innerHTML=filtered.map(c=>`<button type="button" class="company-card" data-id="${esc(c.id)}"><div class="name">${esc(c.nome)}</div><div class="meta">${esc(c.segmento)} · ${esc(c.bairro||c.cidade)}</div><div class="meta">${esc(c.responsavel||'Contato a identificar')}</div><div class="brief">${esc((c.briefing||'').slice(0,140))}</div><div class="status">${esc(c.status)}${c.retorno_em?' · Retorno '+fmtDate(c.retorno_em):''}${c._localState&&c._localState!=='synced'?` <span class="pending-tag ${c._localState==='conflict'?'conflict':''}">${c._localState==='conflict'?'Conflito · revisar':'Salvo no aparelho'}</span>`:''}</div></button>`).join('')||'<div class="empty">Nenhuma empresa nesta seleção. Comece em “Nova empresa”.</div>';
}
function openForm(c=null){const form=$('companyForm');form.reset();form.dataset.id=c?.id||'';$('dialogTitle').textContent=c?'Editar ficha':'Nova empresa';if(c)for(const field of fields){const el=form.elements.namedItem(field);if(el)el.value=c[field]??'';}$('companyDialog').showModal();}
function formData(){const d={};for(const k of fields){const val=$('companyForm').elements.namedItem(k).value.trim();d[k]=k==='retorno_em'?(val||null):val;}return d;}
async function saveCompany(ev){ev.preventDefault();const btn=ev.submitter;btn.disabled=true;
 try{const data=formData();if(!data.nome||!data.briefing)throw Error('Informe o nome e o pedido do cliente.');
   const id=$('companyForm').dataset.id;
   if(localReady()){
     const savedId=await localSaveCompany(data,id||null);
     $('companyDialog').close();toast('Ficha salva com segurança no aparelho.');
     if(isOnline()&&session)await syncPending();
     await openCompany(savedId);
   }else{
     if(!isOnline())throw Error('Ative/desbloqueie o modo offline para salvar sem internet.');
     const p=id?`ot_empresas?id=eq.${encodeURIComponent(id)}`:'ot_empresas';
     const [record]=await request(p,{method:id?'PATCH':'POST',body:data});
     $('companyDialog').close();await load();toast('Ficha salva na nuvem.');if(record)await openCompany(record.id);
   }
 }catch(e){toast('Não salvou: '+safeErr(e));}finally{btn.disabled=false;}}
async function openCompany(id){active=companies.find(c=>c.id===id);if(!active)return;
 $('companyPanel').classList.remove('hidden');$('panelTitle').textContent=active.nome;
 $('panelInfo').textContent=`${active.bairro||'Bairro não informado'} · ${active.endereco||'Endereço não informado'} · ${active.responsavel||'Responsável não informado'} · ${active.whatsapp||'Sem WhatsApp'} · ${active.status}`;
 $('panelBriefing').textContent=active.briefing||'Sem briefing';$('panelNotes').textContent=active.observacoes||'Sem observações';
 $('visitForm').reset();$('photoConsent').checked=false;
 await Promise.all([loadVisits(id),loadPhotos(id)]);$('companyPanel').scrollIntoView({behavior:'smooth',block:'start'});}
async function loadVisits(id){
 let list=[];
 if(localReady())list=(await Offline.list('visit')).filter(x=>x.data.empresa_id===id).map(x=>({...x.data,_localState:x.meta.state}));
 if(isOnline()&&session){try{
   const remote=await request(`ot_visitas?select=*&empresa_id=eq.${encodeURIComponent(id)}&order=realizado_em.desc&limit=50`);
   if(localReady()){
     for(const v of remote){const current=await Offline.read('visit',v.id);if(!current||current.meta.state==='synced')await Offline.save('visit',v.id,v,{state:'synced'});}
     const pending=new Set(list.filter(x=>x._localState!=='synced').map(x=>x.id));list=[...list.filter(x=>x._localState!=='synced'),...remote.filter(x=>!pending.has(x.id))];
   }else list=remote;
 }catch(e){if(!localReady())throw e;}}
 list.sort((a,b)=>new Date(b.realizado_em)-new Date(a.realizado_em));
 $('visitList').innerHTML=list.map(v=>`<article><small>${new Date(v.realizado_em).toLocaleString('pt-BR')}</small><p class="note-text">${esc(v.nota)}</p><small>${esc(v.proximo_passo||'Sem próximo passo')}${v.retorno_em?' · '+fmtDate(v.retorno_em):''}${v._localState&&v._localState!=='synced'?' · SALVO NO APARELHO':''}</small></article>`).join('')||'<div class="empty">Nenhuma visita registrada ainda.</div>';
}
async function saveVisit(ev){ev.preventDefault();if(!active)return;const btn=ev.submitter;btn.disabled=true;
 try{const nota=$('visitNote').value.trim();if(!nota)throw Error('Descreva a conversa.');const retorno=$('visitReturn').value||null;
   if(localReady()){
     await localSaveVisit({nota,proximo_passo:$('visitNext').value.trim(),retorno_em:retorno});
     $('visitForm').reset();toast('Visita guardada no aparelho.');if(isOnline()&&session)await syncPending();
   }else{
     if(!isOnline())throw Error('Ative/desbloqueie o modo offline antes de registrar visitas.');
     await request('ot_visitas',{method:'POST',body:{empresa_id:active.id,nota,proximo_passo:$('visitNext').value.trim(),retorno_em:retorno}});
     if(retorno){await request(`ot_empresas?id=eq.${active.id}`,{method:'PATCH',body:{retorno_em:retorno}});active.retorno_em=retorno;}
     $('visitForm').reset();await loadVisits(active.id);render();toast('Visita e próximo passo salvos.');
   }
 }catch(e){toast('Atenção: '+safeErr(e)+' Confira o histórico antes de repetir.');}finally{btn.disabled=false;}}
async function loadPhotos(id){
 destroyObjectUrls();let list=[];
 if(localReady())list=(await Offline.list('photo')).filter(x=>x.data.empresa_id===id).map(x=>({...x.data,_localState:x.meta.state}));
 if(isOnline()&&session){try{
   const remote=await request(`ot_fotos?select=*&empresa_id=eq.${encodeURIComponent(id)}&order=created_at.desc`);
   if(localReady()){
      for(const p of remote){const c=await Offline.read('photo',p.id);if(!c||c.meta.state==='synced')await Offline.save('photo',p.id,p,{state:'synced'});}
      const pending=new Set(list.filter(x=>x._localState!=='synced').map(x=>x.id));list=[...list.filter(x=>x._localState!=='synced'),...remote.filter(x=>!pending.has(x.id))];
   }else list=remote;
 }catch(e){if(!localReady())throw e;}}
 photos=list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));renderPhotoCards();
 for(const photo of photos){if(active?.id!==id)break;
   try{
     let blob=null;
     if(photo._localState&&photo._localState!=='synced'&&localReady())blob=await Offline.image(photo.id);
     else if(isOnline()&&session){const resp=await request(`object/authenticated/${bucket}/${encodePath(photo.storage_path)}`,{storage:true});blob=await resp.blob();}
     if(blob){const url=URL.createObjectURL(blob);objectUrls.push(url);const im=document.getElementById('img-'+photo.id);if(im)im.src=url;}
   }catch{ /* Imagens antigas na nuvem exigem internet; nenhuma URL pública */ }
 }
}
function renderPhotoCards(){$('photoList').innerHTML=photos.map(p=>`<article class="photo-card"><img id="img-${esc(p.id)}" alt="${esc(p.categoria)} — ${esc(p.arquivo_nome)}" loading="lazy"><div class="photo-body"><strong>${esc(p.arquivo_nome)}</strong><p>${esc(p.categoria)}${p.publicacao_autorizada?' · uso autorizado':' · uso não autorizado'}${p._localState&&p._localState!=='synced'?' · SALVO NO APARELHO':''}</p><div class="photo-actions"><button class="btn secondary" data-download="${esc(p.id)}">↓ Baixar</button><button class="btn danger" data-delete-photo="${esc(p.id)}">Excluir</button></div></div></article>`).join('')||'<div class="empty">Ainda não há fotos. Use a câmera ou selecione imagens.</div>';}
async function uploadPhotos(fileList){if(!active||!fileList.length)return;
 const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'},selected=[...fileList];let done=0;
 for(const file of selected){try{
   if(!allowed[file.type])throw Error('Formato inválido. Use JPG, PNG ou WebP.');if(file.size>6*1024*1024)throw Error('Foto acima de 6 MB.');
   if(localReady()){
     await localUpload(file);done++;toast(`Foto ${done} de ${selected.length} guardada no aparelho.`);
   }else{
     if(!isOnline())throw Error('Ative/desbloqueie offline para fotografar sem sinal.');
     if(photos.length+done>=12)throw Error('Limite de 12 fotos por empresa.');
     const path=`${userId}/${active.id}/${crypto.randomUUID()}.${allowed[file.type]}`;
     await authenticated();await raw(`${base}/storage/v1/object/${bucket}/${encodePath(path)}`,{method:'POST',headers:{...headers(true),'Content-Type':file.type,'x-upsert':'false'},body:file});
     try{await request('ot_fotos',{method:'POST',body:{empresa_id:active.id,storage_path:path,arquivo_nome:safeFile(file.name),categoria:$('photoCategory').value,bytes:file.size,publicacao_autorizada:$('photoConsent').checked}});}catch(e){try{await request(`object/${bucket}/${encodePath(path)}`,{method:'DELETE',storage:true});}catch{}throw e;}
     done++;toast(`Foto ${done} de ${selected.length} salva na nuvem.`);
   }
 }catch(e){toast('Foto não salva: '+safeErr(e));}}
 $('photoCamera').value='';$('photoFiles').value='';
 if(done&&localReady()&&isOnline()&&session)await syncPending();
 try{await loadPhotos(active.id);await updateOfflineBar();}catch(e){toast('Falha ao atualizar galeria: '+safeErr(e));}
}
async function downloadPhoto(id){const p=photos.find(x=>x.id===id);if(!p)return;try{let blob;if(p._localState&&p._localState!=='synced'&&localReady())blob=await Offline.image(id);else{const resp=await request(`object/authenticated/${bucket}/${encodePath(p.storage_path)}`,{storage:true});blob=await resp.blob();}if(!blob)throw Error('Imagem não disponível neste aparelho.');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=p.arquivo_nome||'foto';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){toast('Download falhou: '+safeErr(e));}}
async function deletePhoto(id){if(!isOnline()||!session||photos.some(x=>x._localState&&x._localState!=='synced')){toast('Exclusão indisponível com pendências offline. Sincronize primeiro.');return;}const p=photos.find(x=>x.id===id);if(!p||!confirm('Excluir esta foto da nuvem permanentemente?'))return;
 try{await request(`object/${bucket}/${encodePath(p.storage_path)}`,{method:'DELETE',storage:true});await request(`ot_fotos?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});await loadPhotos(active.id);toast('Foto excluída.');}catch(e){toast('Exclusão incompleta: '+safeErr(e));}}
async function deleteCompany(){if(!isOnline()||!session||(localReady()&&await Offline.countPending())){toast('Sincronize todas as pendências antes de excluir empresas.');return;}if(!active||!confirm(`Excluir ${active.nome} e todo o histórico? A exclusão é definitiva.`))return;
 try{if(photos.length)throw Error('Baixe e exclua as fotos antes de remover a empresa, evitando arquivos órfãos.');await request(`ot_empresas?id=eq.${active.id}`,{method:'DELETE'});active=null;$('companyPanel').classList.add('hidden');await load();toast('Empresa removida.');}catch(e){toast('Não excluído: '+safeErr(e));}}
function exportCsv(){const columns=['nome','segmento','bairro','cidade','endereco','responsavel','whatsapp','presenca_digital','briefing','observacoes','status','retorno_em','created_at'];
 const clean=v=>{const s=String(v??'');return '"'+(/^[\s]*[=+@\-\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';};
 const rows=[columns.join(';'),...companies.map(c=>columns.map(k=>clean(c[k])).join(';'))];const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ot-comercial-empresas-${dateToday()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);toast('CSV exportado. Fotos precisam de download separado.');}
async function boot(){await initializeOffline();if(!connOk()){show('setupView');return;}
 $('connectionState').textContent='Projeto configurado';
 if(isOnline()&&await restore()){
   show('appView');try{await load();}catch(e){toast('Falha ao buscar carteira: '+safeErr(e));}
   await updateOfflineBar();
 }else if(!isOnline()&&initialOfflineProfile){show('offlineView');}
 else show('loginView');
}
$('loginForm').addEventListener('submit',async ev=>{ev.preventDefault();const btn=ev.submitter;btn.disabled=true;try{await login($('email').value,$('password').value);
 if(Offline.ready()&&Offline.user()!==userId){storeSession(null);Offline.lock();throw Error('Esta sessão pertence a outro usuário. Confira a conta.');}
 $('password').value='';show('appView');await load();toast('Login autorizado.');
 if(localReady())await syncPending();
 await updateOfflineBar();}catch(e){storeSession(null);toast('Falha ao entrar: '+safeErr(e));}finally{btn.disabled=false;}});
$('logoutBtn').addEventListener('click',logout);$('newBtn').addEventListener('click',()=>openForm());$('companyForm').addEventListener('submit',saveCompany);$('cancelCompany').addEventListener('click',()=>$('companyDialog').close());
$('companyList').addEventListener('click',ev=>{const b=ev.target.closest('[data-id]');if(b)openCompany(b.dataset.id).catch(e=>toast('Falha ao abrir: '+safeErr(e)));});
$('search').addEventListener('input',render);$('statusFilter').addEventListener('change',render);$('closePanel').addEventListener('click',()=>{active=null;destroyObjectUrls();$('companyPanel').classList.add('hidden');});
$('editBtn').addEventListener('click',()=>active&&openForm(active));$('deleteCompanyBtn').addEventListener('click',deleteCompany);$('visitForm').addEventListener('submit',saveVisit);$('photoFiles').addEventListener('change',ev=>uploadPhotos(ev.target.files));$('photoCamera').addEventListener('change',ev=>uploadPhotos(ev.target.files));
$('photoList').addEventListener('click',ev=>{const d=ev.target.closest('[data-download]'),x=ev.target.closest('[data-delete-photo]');if(d)downloadPhoto(d.dataset.download);if(x)deletePhoto(x.dataset.deletePhoto);});$('exportBtn').addEventListener('click',exportCsv);
/* OT Comercial V1.3 — orquestrador local-first.
 * Fichas são persistidas no cofre IndexedDB antes de tentar sincronizar.
 * A fila possui IDs estáveis para reenvios idempotentes; conflitos não são sobrescritos.
 */
const Offline=window.OTOffline;
let syncing=false;
let initialOfflineProfile=null;
const currentSnapshot=c=>Object.fromEntries(fields.map(k=>[k,c?.[k]??(k==='retorno_em'?null:'')]));
const sameSnapshot=(a,b)=>JSON.stringify(currentSnapshot(a))===JSON.stringify(currentSnapshot(b));
const isOnline=()=>navigator.onLine;
const localReady=()=>Offline.ready(userId);
async function updateOfflineBar(){
  const bar=$('offlineBar');bar.classList.toggle('hidden',$('appView').classList.contains('hidden'));
  if(bar.classList.contains('hidden'))return;
  const p=await Offline.profile().catch(()=>null), ready=localReady();
  const n=ready?await Offline.countPending():0;
  $('offlineSetupBtn').hidden=!!p;
  $('offlineUnlockBtn').hidden=!p||ready;
  $('syncBtn').hidden=!ready||!session;
  $('syncLoginBtn').hidden=!ready||!!session;
  $('offlineState').textContent=ready?(isOnline()?'Online · dados locais protegidos':'Offline · salvo neste aparelho'):(p?'Cofre offline bloqueado':'Modo offline ainda não ativado');
  $('offlineDetail').textContent=ready?`${n} registro(s) pendente(s) ou em conflito${!session?' · Entre novamente para enviar':''}`:'Ative ou desbloqueie para registrar sem internet.';
  $('connectionState').textContent=isOnline()?(session?'Nuvem conectada':'Sem sessão na nuvem'):'Sem internet';
}
async function cachedCompanies(){return (await Offline.list('company')).map(x=>({...x.data,_localState:x.meta.state}));}
async function cacheRemoteCompanies(list){
  if(!localReady())return;
  for(const c of list){const current=await Offline.read('company',c.id);if(current&&current.meta.state!=='synced')continue;
    await Offline.save('company',c.id,c,{state:'synced',base:currentSnapshot(c)});
  }
}
async function offlineLoad(){
  if(!localReady())throw Error('Ative e desbloqueie o armazenamento offline.');
  companies=await cachedCompanies();render();await updateOfflineBar();
}
async function localSaveCompany(data,id=null){
  if(!localReady())throw Error('Desbloqueie o modo offline antes de salvar.');
  const identifier=id||crypto.randomUUID();
  const previous=await Offline.read('company',identifier);
  const current=companies.find(x=>x.id===identifier);
  const state=previous?.meta?.state==='pending-create'?'pending-create':id?'pending-update':'pending-create';
  const base=previous?.meta?.base??(id?currentSnapshot(current):null);
  const merged={...(current||{}),...data,id:identifier,owner_id:userId};
  await Offline.save('company',identifier,merged,{state,base});
  await offlineLoad();return identifier;
}
async function localSaveVisit({nota,proximo_passo,retorno_em}){
  if(!active||!localReady())throw Error('Abra uma empresa com o cofre offline desbloqueado.');
  const id=crypto.randomUUID();
  await Offline.save('visit',id,{id,empresa_id:active.id,owner_id:userId,nota,proximo_passo,retorno_em,realizado_em:new Date().toISOString()},{state:'pending-create'});
  if(retorno_em){const saved=await Offline.read('company',active.id);const base=saved?.meta.base??currentSnapshot(active);
    const state=saved?.meta.state==='pending-create'?'pending-create':'pending-update';
    await Offline.save('company',active.id,{...active,retorno_em},{state,base});active.retorno_em=retorno_em;
  }
  await offlineLoad();await loadVisits(active.id);return id;
}
async function localUpload(file){
  if(!active||!localReady())throw Error('Desbloqueie o modo offline antes de fotografar.');
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  if(!ext)throw Error('Use JPG, PNG ou WebP.');
  if(file.size>6*1024*1024)throw Error('O limite por foto é 6 MB.');
  const count=(await Offline.list('photo')).filter(p=>p.data.empresa_id===active.id).length;
  if(count>=12)throw Error('Limite de 12 fotos por empresa nesta versão.');
  const id=crypto.randomUUID(),path=`${userId}/${active.id}/${id}.${ext}`;
  const meta={id,empresa_id:active.id,owner_id:userId,storage_path:path,arquivo_nome:safeFile(file.name),categoria:$('photoCategory').value,bytes:file.size,publicacao_autorizada:$('photoConsent').checked,created_at:new Date().toISOString()};
  await Offline.storeImage(id,file); // Primeiro guarda conteúdo, só depois cria o item pendente.
  try{await Offline.save('photo',id,meta,{state:'pending-create'});}catch(e){await Offline.removeImage(id);throw e;}
  return id;
}
async function fetchRemoteOne(table,id){const records=await request(`${table}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);return records[0]||null;}
async function safeInsert(table,payload,id){
  await request(`${table}?on_conflict=id`,{method:'POST',body:payload,prefer:'resolution=ignore-duplicates,return=representation'});
  const saved=await fetchRemoteOne(table,id);
  if(!saved)throw Error('Servidor não confirmou o registro. Mantido no aparelho.');
  return saved;
}
async function syncCompany(item){
  if(item.meta.state==='conflict')return;
  const id=item.id,data=item.data,remote=await fetchRemoteOne('ot_empresas',id);
  if(item.meta.state==='pending-create'){
    if(!remote){await safeInsert('ot_empresas',{...currentSnapshot(data),id},id);}else if(!sameSnapshot(remote,data)){
      await Offline.save('company',id,data,{...item.meta,state:'conflict',reason:'Outro conteúdo já existe para o ID'});return;
    }
  }else if(item.meta.state==='pending-update'){
    if(!remote){await Offline.save('company',id,data,{...item.meta,state:'conflict',reason:'Empresa removida do servidor'});return;}
    if(!sameSnapshot(remote,item.meta.base)){
      await Offline.save('company',id,data,{...item.meta,state:'conflict',reason:'Dados alterados no notebook enquanto estava offline'});return;
    }
    await request(`ot_empresas?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:currentSnapshot(data)});
  }else return;
  const confirmed=await fetchRemoteOne('ot_empresas',id);
  if(!confirmed||!sameSnapshot(confirmed,data))throw Error('Confirmação da empresa incompleta. Dados locais mantidos.');
  await Offline.save('company',id,confirmed,{state:'synced',base:currentSnapshot(confirmed)});
}
async function syncVisit(item){
  if(item.meta.state!=='pending-create')return;
  const v=item.data;
  const saved=await safeInsert('ot_visitas',{id:v.id,empresa_id:v.empresa_id,nota:v.nota,proximo_passo:v.proximo_passo,retorno_em:v.retorno_em,realizado_em:v.realizado_em},v.id);
  await Offline.save('visit',item.id,saved,{state:'synced'});
}
async function syncPhoto(item){
  if(item.meta.state!=='pending-create')return;
  const v=item.data;
  const blob=await Offline.image(item.id);if(!blob)throw Error('Imagem pendente indisponível no armazenamento do aparelho.');
  // Reinserção segura: se upload anterior chegou mas a resposta caiu, o objeto já pode existir.
  const path=encodePath(v.storage_path);
  let exists=false;
  try{const r=await request(`object/authenticated/${bucket}/${path}`,{storage:true});exists=r.ok;}catch(e){if(!/404|not found|not exist|does not exist/i.test(safeErr(e)))throw e;}
  if(!exists){await authenticated();try{await raw(`${base}/storage/v1/object/${bucket}/${path}`,{method:'POST',headers:{...headers(true),'Content-Type':blob.type,'x-upsert':'false'},body:blob});}catch(e){
      if(!/409|already exists|duplicate/i.test(safeErr(e)))throw e;
      await request(`object/authenticated/${bucket}/${path}`,{storage:true});
  }}
  const dbRecord=await safeInsert('ot_fotos',{id:v.id,empresa_id:v.empresa_id,storage_path:v.storage_path,arquivo_nome:v.arquivo_nome,categoria:v.categoria,bytes:v.bytes,publicacao_autorizada:v.publicacao_autorizada},v.id);
  await Offline.save('photo',item.id,dbRecord,{state:'synced'});
  await Offline.removeImage(item.id); // Só apagar depois da confirmação do registro remoto.
}
async function syncPending(){
  if(syncing||!isOnline()||!session||!localReady())return;
  syncing=true;$('syncBtn').disabled=true;
  let completed=0,errors=[];
  try{
    for(const kind of ['company','visit','photo']){
      const items=(await Offline.list(kind)).filter(x=>x.meta.state!=='synced'&&x.meta.state!=='conflict');
      for(const item of items){
        try{await authenticated();if(kind==='company')await syncCompany(item);else if(kind==='visit')await syncVisit(item);else await syncPhoto(item);completed++;}
        catch(e){errors.push(`${kind}: ${safeErr(e)}`);if(!isOnline())break;}
      }
      if(!isOnline())break;
    }
    if(completed){await load();if(active)await Promise.allSettled([loadVisits(active.id),loadPhotos(active.id)]);}
    if(errors.length)toast(`Sincronização incompleta. ${errors.length} pendência(s) com erro. Dados locais preservados.`);
    else if(completed)toast(`${completed} registro(s) enviados e conferidos no Supabase.`);
  }finally{syncing=false;$('syncBtn').disabled=false;await updateOfflineBar();}
}
async function afterUnlocked(){
  userId=Offline.user();show('appView');await offlineLoad();
  if(session&&isOnline()){try{await load();await syncPending();}catch(e){toast('Modo local disponível: '+safeErr(e));}}
}
async function startOfflineUnlock(){
  const p=await Offline.profile();if(!p){toast('Ative o modo offline após entrar com internet.');return;}
  show('offlineView');$('offlineUnlockPass').value='';
}
async function initializeOffline(){
  initialOfflineProfile=await Offline.profile().catch(()=>null);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
  window.addEventListener('online',async()=>{await updateOfflineBar();if(session&&localReady())syncPending().catch(e=>toast(safeErr(e)));});
  window.addEventListener('offline',()=>updateOfflineBar());
  $('openOfflineBtn').addEventListener('click',startOfflineUnlock);
  $('backToLoginBtn').addEventListener('click',()=>show('loginView'));
  $('offlineUnlockBtn').addEventListener('click',startOfflineUnlock);
  $('offlineUnlockForm').addEventListener('submit',async e=>{e.preventDefault();try{
    const owner=await Offline.unlock($('offlineUnlockPass').value);if(session&&userId&&userId!==owner){Offline.lock();throw Error('Cofre pertence a outro usuário.');}
    await afterUnlocked();
  }catch(err){toast(safeErr(err));}});
  $('offlineSetupBtn').addEventListener('click',()=>$('offlineSetupDialog').showModal());
  $('cancelOffline').addEventListener('click',()=>$('offlineSetupDialog').close());
  $('offlineSetupForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.target;try{
    if(!session||!userId)throw Error('Entre na nuvem antes de ativar o modo offline.');
    const pass=f.elements.namedItem('pass').value,confirm=f.elements.namedItem('confirm').value;
    if(pass!==confirm)throw Error('Frases secretas diferentes.');
    await Offline.activate(userId,pass);await Offline.persistPermission().catch(()=>false);$('offlineSetupDialog').close();f.reset();await load();await updateOfflineBar();toast('Modo offline ativado neste aparelho. Guarde sua frase secreta.');
  }catch(err){toast(safeErr(err));}});
  $('syncBtn').addEventListener('click',()=>syncPending().catch(e=>toast(safeErr(e))));
  $('syncLoginBtn').addEventListener('click',()=>show('loginView'));
}

boot();