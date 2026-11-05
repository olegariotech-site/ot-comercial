/* OT Comercial V1.6 — integração da agenda com o CRM, sem dados privados em páginas públicas. */
'use strict';
window.OTCommercialUI=(()=>{
 const c=window.OTCommercial,q=id=>document.getElementById(id);
 const state={events:[],projection:c.project([]),coverage:null,error:'',ticket:0,owner:null};
 const fmt=v=>v?v.split('-').reverse().join('/'):'A definir';
 const segment=s=>({'Alimentação':'alimentacao','Comércio':'comercio','Serviços':'servicos'}[s]||'todos');
 const safe=message=>typeof safeErr==='function'?safeErr(message):'Operação não concluída';
 function notify(message){toast(message)}
 function requireVault(){if(!fieldReady())throw Error('Prepare / desbloqueie o cofre para registrar o trabalho comercial');return userId}
 function setView(view){q('agendaView').hidden=view!=='agenda';q('walletView').hidden=view!=='wallet';q('agendaTab').setAttribute('aria-pressed',String(view==='agenda'));q('walletTab').setAttribute('aria-pressed',String(view==='wallet'));q('companyPanel').classList.add('hidden')}
 async function refresh(){
  const ticket=++state.ticket,owner=userId;if(!owner)return clear();
  let remote=[],coverage=fieldReady()?await OTOfflineVault.getState('commercial'):null,error='';
  if(!offlineMode&&navigator.onLine!==false){
   try{
    remote=await cloudRows('ot_comercial_eventos','&owner_id=eq.'+encodeURIComponent(owner));
    for(const e of remote)c.event(e,owner);
    if(owner!==userId||ticket!==state.ticket)return;
    coverage={updatedAt:new Date().toISOString(),complete:true,count:remote.length};
    if(fieldReady()){await OTOfflineVault.snapshot('commercial',remote);await OTOfflineVault.setState('commercial',coverage)}
   }catch(e){error='Nuvem comercial não confirmada: '+safe(e)}
  }
  if(owner!==userId||ticket!==state.ticket)return;
  const local=fieldReady()?await OTOfflineVault.list('commercial'):[],byId=new Map(remote.map(e=>[e.id,e]));
  for(const e of local)if(!byId.has(e.id))byId.set(e.id,e);
  if(owner!==userId||ticket!==state.ticket)return;
  state.events=[...byId.values()];state.projection=c.project(state.events,owner);state.coverage=coverage;state.error=error;state.owner=owner;
  render();if(active)company(active.id);
 }
 function render(){
  if(!userId||state.owner!==userId)return;
  const a=c.agenda(companies,state.projection),m=c.metrics(state.projection),proposalOnly=q('agendaFilter').value==='proposals';
  q('agendaToday').textContent='Hoje, '+fmt(a.day)+' · horário de São Paulo';
  q('commercialCoverage').textContent=(offlineMode||navigator.onLine===false?'Dados do aparelho. ':'')+(state.coverage?'Última consulta comercial completa: '+new Date(state.coverage.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'. ':'Cobertura comercial offline ainda não confirmada. ')+(fieldReady()?'Cofre desbloqueado. ':'Desbloqueie o cofre para editar e preparar offline. ')+(state.error||'')+(state.projection.errors.length?' Há registros inválidos/conflitos a conferir.':'');
  const counts=[['Vencidos',a.groups.vencidos.length],['Hoje',a.groups.hoje.length],['Próximos',a.groups.proximos.length],['A definir',a.groups.definir.length],['Propostas abertas',m.propostasAbertas],['Implantação fechada',c.money(m.implantacao)],['MRR contratado',c.money(m.mrr)],['Ações concluídas',m.retornosCumpridos]];
  const cards=rows=>rows.map(([label,n])=>'<div class="card metric'+(typeof n==='string'?' financial':'')+'"><span>'+esc(label)+'</span><strong>'+esc(n)+'</strong></div>').join('');
  q('commercialMetrics').innerHTML=cards(counts.slice(0,4));q('businessMetrics').innerHTML=cards(counts.slice(4));
  q('agendaFilter').options[1].textContent='Propostas a retomar ('+m.propostasAbertas+')';
  q('commercialFunnel').textContent=a.actionCount+' ações abertas · '+a.planningCount+' itens a planejar. Estágios atuais: '+Object.entries(m.stages).map(([k,n])=>c.STAGES[k]+': '+n).join(' · ')+'. Retornos na data: '+m.pontuais+'/'+m.comData+'. Ganhos entre oportunidades que tiveram proposta: '+(m.conversaoPropostas==null?'sem base':Math.round(m.conversaoPropostas*100)+'%')+'. Valores de receita, sem estimativa de lucro.';
  q('agendaGroups').innerHTML=Object.entries({vencidos:'Vencidos',hoje:'Hoje',proximos:'Próximos',definir:'A definir'}).map(([key,label])=>{
   const rows=a.groups[key].filter(r=>!proposalOnly||['proposta','negociacao'].includes(r.opportunity?.estagio));
   return '<section class="agenda-section"><h2>'+label+' <small>('+rows.length+')</small></h2>'+rows.map(row=>{
    const o=row.opportunity,act=row.action,wa=c.phone(o?.contato||row.company.whatsapp),owner=o?.decisor||row.company.responsavel;
    return '<article class="agenda-row" data-agenda-row="'+esc(row.id)+'"><strong>'+esc(row.company.nome)+'</strong><p>'+esc(owner||'Decisor a identificar')+'</p><span class="agenda-badge">'+esc(o?c.STAGES[o.estagio]:row.company.status)+' · '+esc(act?fmt(act.data_prevista):'Planejamento necessário')+'</span><p>'+esc(act?.descricao||'Definir próxima ação concreta')+'</p>'+(row.legacy&&row.company.retorno_em?'<small>Retorno legado '+esc(fmt(row.company.retorno_em))+' — confirme a ação correspondente.</small>':'')+(row.conflict?'<p role="status">Conflito de versões. Dados preservados; reabra e confira antes de continuar.</p>':'')+'<div class="ot-heading-actions"><button type="button" class="btn secondary" data-open-company="'+esc(row.company.id)+'">Abrir ficha</button><button type="button" class="btn primary" data-action-plan="'+esc(row.id)+'">'+(row.planning?'Planejar contato':'Registrar desfecho')+'</button>'+(!row.planning?'<button type="button" class="btn secondary" data-reschedule="'+esc(act.id)+'">Reagendar</button>':'')+(wa?'<a class="btn secondary" target="_blank" rel="noopener" href="'+esc(wa)+'">WhatsApp</a>':'')+'</div></article>';
   }).join('')+(rows.length?'':'<p class="empty">Nenhuma ação nesta seção.</p>')+'</section>';
  }).join('');
 }
 function company(id){
  if(!userId||state.owner!==userId)return;
  const list=state.projection.opportunities.filter(o=>o.empresa_id===id),co=companies.find(x=>x.id===id);
  q('companyCasesLink').href='cases.html?segment='+segment(co?.segmento);
  q('opportunityList').innerHTML=list.map(o=>{
   const tasks=state.projection.actions.filter(a=>a.oportunidade_id===o.id),wa=c.phone(o.contato);
   return '<article class="opportunity-card"><strong>'+esc(o.titulo)+'</strong><p>'+esc(c.STAGES[o.estagio])+' · '+esc(o.servicos.map(s=>c.SERVICES[s]).join(', ')||'Solução a diagnosticar')+'</p><p>'+esc(o.necessidade||'Necessidade ainda não registrada')+'</p><p>Implantação proposta: '+esc(c.money(o.implantacao_proposta))+' · mensalidade proposta: '+esc(c.money(o.mensalidade_proposta))+'</p><p>Fechado: '+esc(c.money(o.valor_fechado))+' · MRR: '+esc(o.estagio==='ganho'&&o.recorrencia_status==='ativa'?c.money(o.recorrencia_contratada):'não contratado')+'</p>'+(o.conflict?'<p>Conflito: versões preservadas; edição bloqueada até conferência.</p>':'')+'<div class="ot-heading-actions"><button class="btn secondary" type="button" data-edit-opportunity="'+esc(o.id)+'">Diagnóstico / proposta</button><button class="btn secondary" type="button" data-plan-opportunity="'+esc(o.id)+'">Próxima ação</button>'+(wa?'<a class="btn secondary" href="'+esc(wa)+'" target="_blank" rel="noopener">WhatsApp</a>':'')+'</div><details><summary>Histórico comercial ('+(o.history.length+tasks.reduce((s,a)=>s+a.history.length,0))+')</summary>'+o.history.map(e=>'<p><small>'+esc(new Date(e.occurred_at).toLocaleString('pt-BR'))+'</small> · '+esc(c.STAGES[e.data.estagio])+' · '+esc(e.data.necessidade||e.data.titulo)+'</p>').join('')+tasks.flatMap(a=>a.history).map(e=>'<p>'+esc(e.data.descricao)+' · '+esc(e.data.estado)+' · '+esc(e.data.resultado||fmt(e.data.data_prevista))+'</p>').join('')+'</details></article>';
  }).join('')||'<p class="empty">Nenhuma oportunidade registrada. Comece pelo diagnóstico.</p>';
 }
 async function save(entries){
  const owner=requireVault();await OTOfflineVault.stageBatch(entries);
  if(owner!==userId)throw Error('Conta alterada; registros preservados no cofre original');
  await load();await updateFieldState();
  if(!offlineMode&&navigator.onLine!==false)await syncNow();
 }
 function openQuick(){try{requireVault();q('quickForm').reset();q('quickDialog').showModal()}catch(e){notify(safe(e));prepareVault().catch(x=>notify(safe(x)))}}
 function formValue(form,name){return form.elements.namedItem(name)?.value?.trim()||''}
 function oppById(id){return state.projection.opportunities.find(o=>o.id===id)}
 function actionById(id){return state.projection.actions.find(a=>a.id===id)}
 function openOpportunity(id=null){
  try{requireVault();const o=id?oppById(id):null;if(o?.conflict)throw Error('Conflito: reabra a ficha e confira as versões.');if(!active&&!o)throw Error('Abra uma empresa');
   const f=q('opportunityForm');f.reset();f.dataset.company=o?.empresa_id||active.id;f.dataset.entity=id||'';f.dataset.head=o?.head.id||'';
   for(const el of f.elements){if(!el.name||el.type==='checkbox')continue;const value=o?.[el.name];if(value!=null)el.value=['implantacao_proposta','mensalidade_proposta','valor_fechado','recorrencia_contratada'].includes(el.name)?(value/100).toFixed(2).replace('.',','):value}
   for(const box of f.querySelectorAll('[name="servicos"]'))box.checked=!!o?.servicos.includes(box.value);
   if(!o){const co=companies.find(x=>x.id===f.dataset.company);f.elements.namedItem('titulo').value='Diagnóstico e solução digital';f.elements.namedItem('decisor').value=co?.responsavel||'';f.elements.namedItem('contato').value=co?.whatsapp||''}
   q('financeDetails').open=['ganho','perdido'].includes(f.elements.namedItem('estagio').value);q('opportunityDialog').showModal();
  }catch(e){notify(safe(e))}
 }
 function openAction({companyId,opportunityId=null,actionId=null,mode='plan'}){
  try{requireVault();const a=actionId?actionById(actionId):null,o=opportunityId?oppById(opportunityId):a?oppById(a.oportunidade_id):null;
   if(a?.conflict||o?.conflict)throw Error('Conflito: versões preservadas; confira a ficha.');
   const f=q('actionForm');f.reset();f.dataset.company=companyId||a?.empresa_id||o?.empresa_id||active?.id;f.dataset.opp=o?.id||'';f.dataset.action=a?.id||'';f.dataset.head=a?.head.id||'';f.dataset.mode=mode;
   q('actionTitle').textContent=mode==='complete'?'Registrar desfecho':mode==='reschedule'?'Reagendar sem apagar histórico':'Planejar próximo passo';
   q('actionContext').textContent=(companies.find(x=>x.id===f.dataset.company)?.nome||'')+(a?' · '+a.descricao:'');
   q('outcomeFields').hidden=mode!=='complete';q('nextActionFields').hidden=false;
   if(a){f.elements.namedItem('descricao').value=a.descricao;f.elements.namedItem('tipo').value=a.tipo}
   if(o&&!c.active(o.estagio))f.elements.namedItem('tipo').value='pos_venda';q('actionDialog').showModal();
  }catch(e){notify(safe(e))}
 }
 async function submitQuick(ev){
  ev.preventDefault();const button=ev.submitter;button.disabled=true;
  try{
   requireVault();const f=q('quickForm'),get=n=>formValue(f,n),name=get('nome');if(name.length<2)throw Error('Informe pelo menos 2 caracteres no nome');
   const companyId=crypto.randomUUID(),o=c.make('opportunity',companyId,{titulo:get('necessidade')||'Diagnóstico inicial',necessidade:get('necessidade'),decisor:get('decisor'),contato:get('contato'),papel_contato:get('papel_contato'),melhor_horario:get('melhor_horario')});
   const entries=[{kind:'company',record:{id:companyId,nome:name,segmento:get('segmento'),responsavel:get('decisor'),whatsapp:get('contato'),briefing:'',observacoes:'',status:get('status'),cidade:'Valinhos',bairro:'',endereco:'',presenca_digital:'',retorno_em:null}},{kind:'commercial',record:o}];
   if(get('proxima'))entries.push({kind:'commercial',record:c.make('action',companyId,{oportunidade_id:o.entity_id,descricao:get('proxima'),data_prevista:get('data')})});
   await save(entries);q('quickDialog').close();f.reset();setView('agenda');render();notify('Prospecção preservada. Próximo passo disponível na agenda.');
  }catch(e){notify('Não concluiu cadastro: '+safe(e))}finally{button.disabled=false}
 }
 async function submitOpportunity(ev){
  ev.preventDefault();const button=ev.submitter;button.disabled=true;
  try{
   const f=q('opportunityForm'),previous=f.dataset.entity?oppById(f.dataset.entity):null;
   if(previous&&previous.head.id!==f.dataset.head)throw Error('Oportunidade mudou. Reabra antes de salvar.');
   const data={};for(const el of f.elements)if(el.name&&el.name!=='servicos')data[el.name]=el.value.trim();
   data.servicos=[...f.querySelectorAll('[name="servicos"]:checked')].map(el=>el.value);
   for(const key of ['implantacao_proposta','mensalidade_proposta','valor_fechado','recorrencia_contratada'])data[key]=c.cents(data[key]);
   const record=c.make('opportunity',f.dataset.company,data,previous?.head),entries=[{kind:'commercial',record}];
   if(!c.active(record.data.estagio))for(const a of state.projection.actions.filter(a=>a.oportunidade_id===record.entity_id&&a.estado==='aberta'&&a.tipo!=='pos_venda'))entries.push({kind:'commercial',record:c.make('action',a.empresa_id,{...a.head.data,estado:'cancelada',resultado:'Oportunidade encerrada: '+c.STAGES[record.data.estagio],encerramento:true,concluida_em:new Date().toISOString()},a.head)});
   await save(entries);q('opportunityDialog').close();notify('Oportunidade registrada no histórico.');
  }catch(e){q('financeDetails').open=true;notify('Não salvou oportunidade: '+safe(e))}finally{button.disabled=false}
 }
 async function submitAction(ev){
  ev.preventDefault();const button=ev.submitter;button.disabled=true;
  try{
   const f=q('actionForm'),get=n=>formValue(f,n),mode=f.dataset.mode,previous=f.dataset.action?actionById(f.dataset.action):null;
   if(previous&&(previous.head.id!==f.dataset.head||previous.estado!=='aberta'))throw Error('Ação mudou ou já foi concluída. Reabra a agenda.');
   let o=f.dataset.opp?oppById(f.dataset.opp):null;const companyId=f.dataset.company,entries=[];
   if(!o&&mode==='plan'&&get('tipo')!=='pos_venda'){const co=companies.find(x=>x.id===companyId),record=c.make('opportunity',companyId,{titulo:'Contato e diagnóstico',decisor:co?.responsavel||'',contato:co?.whatsapp||''});entries.push({kind:'commercial',record});o={id:record.entity_id,estagio:'diagnostico',head:record}}
   const closing=mode==='complete'&&get('continuidade')==='encerrar';let next=null;
   if(!closing){next=c.make('action',companyId,{oportunidade_id:o?.id||previous?.oportunidade_id,descricao:get('descricao'),data_prevista:get('data_prevista'),tipo:get('tipo')});if(o&&!c.active(o.estagio)&&next.data.tipo!=='pos_venda')throw Error('Oportunidade encerrada aceita apenas pós-venda solicitado');entries.push({kind:'commercial',record:next})}
   if(previous){const result=mode==='reschedule'?'Reagendado para '+(get('data_prevista')||'A definir'):get('resultado');if(!result)throw Error('Registre o desfecho');entries.push({kind:'commercial',record:c.make('action',companyId,{...previous.head.data,estado:mode==='reschedule'?'cancelada':'concluida',resultado:result,concluida_em:new Date().toISOString(),proxima_acao_id:next?.entity_id||null,encerramento:closing},previous.head)});
    if(closing&&o&&c.active(o.estagio)){
     entries.push({kind:'commercial',record:c.make('opportunity',companyId,{...o.head.data,estagio:'perdido',motivo_perda:result},o.head)});
     for(const other of state.projection.actions.filter(a=>a.oportunidade_id===o.id&&a.id!==previous.id&&a.estado==='aberta'))entries.push({kind:'commercial',record:c.make('action',companyId,{...other.head.data,estado:'cancelada',resultado:'Encerramento explícito da oportunidade',concluida_em:new Date().toISOString(),encerramento:true},other.head)});
    }
   }
   await save(entries);q('actionDialog').close();notify('Ação registrada; histórico preservado.');
  }catch(e){notify('Não concluiu ação: '+safe(e))}finally{button.disabled=false}
 }
 async function ready(){
  if(!userId)return;const owner=userId,lines=[];
  lines.push('Rede: '+(navigator.onLine===false?'sem internet':'disponível; autorização confirmada apenas nas consultas à nuvem'));
  lines.push('Autenticação: '+(session?.access_token?'sessão cloud presente; validade confirmada nas consultas':'sem sessão cloud; autentique ao reconectar'));
  lines.push('Cofre: '+(fieldReady()?'desbloqueado':'bloqueado'));
  if(fieldReady()){
   const pending=await OTOfflineVault.pending(),visits=await OTOfflineVault.list('visit'),photos=await OTOfflineVault.list('photo');
   lines.push('Fila: '+pending.length+' pendências');lines.push('Visitas no cofre: '+visits.length+'; carteira preparada conforme última consulta. Histórico global inicial pode conter só as 200 recentes.');
   let count=0;for(const p of photos)try{if((await OTOfflineVault.getPhoto(p.id))?.blob.size===Number(p.bytes))count++}catch{}
   lines.push('Fotos locais verificadas: '+count+'/'+photos.length+'. Abra cada empresa e use Preparar fotos offline para conferir também as fotos de outros aparelhos.');
   const info=await OTOfflineVault.getState('commercial');lines.push('Agenda: '+(info?.complete?'consulta completa em '+new Date(info.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'cobertura ainda não confirmada'));
   const synced=await OTOfflineVault.getState('lastSync');lines.push('Última sincronização confirmada: '+(synced?.at?new Date(synced.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'ainda não registrada'));
   const estimate=await OTOfflineVault.estimate();lines.push('Armazenamento: '+(estimate?.quota?Math.round(100*estimate.usage/estimate.quota)+'% da quota estimada':'quota não informada pelo navegador'));
  }
  let cached=0;const needed=['index.html','app.js','commercial-core.js','commercial-ui.js','offline-vault.js','field-sync.js','offline-status.js','config.js','cases.html','cases.js','style.css','apresentacao-ot.html','apresentacao-servico.css','card-export.js','ot-logo.js',...['landing','site','cardapio','google','catalogo','marca','redes','diagnostico'].map(s=>'solucoes/'+s+'.html')];
  if('caches' in window)for(const path of needed)if(await caches.match(new URL(path,location.href).href))cached++;
  lines.push('Material público local: '+cached+'/'+needed.length+' arquivos conferidos neste aparelho. Sites externos dos clientes exigem rede.');
  if(owner!==userId)return;
  q('readyReport').innerHTML=lines.map(line=>'<p>'+esc(line)+'</p>').join('');
 }
 function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2500)}
 function exportCommercial(){
  if(!userId||state.owner!==userId)return;
  const clean=v=>'"'+(/^[\s]*[=+@\-]/.test(String(v??''))?"'":'')+String(v??'').replace(/"/g,'""')+'"';
  const header=['empresa','oportunidade','estagio','implantacao_proposta_BRL','mensalidade_proposta_BRL','implantacao_fechada_BRL','recorrencia_contratada_BRL','recorrencia_status'];
  const rows=state.projection.opportunities.map(o=>[companies.find(x=>x.id===o.empresa_id)?.nome,o.titulo,c.STAGES[o.estagio],o.implantacao_proposta,o.mensalidade_proposta,o.valor_fechado,o.recorrencia_contratada,o.recorrencia_status].map((x,i)=>clean(i>=3&&i<=6&&x!=null?(x/100).toFixed(2):x)).join(';'));
  download(new Blob(['\ufeff'+[header.join(';'),...rows].join('\r\n')],{type:'text/csv;charset=utf-8'}),'ot-oportunidades-'+c.today()+'.csv');
 }
 function clear(){state.ticket++;state.events=[];state.projection=c.project([]);state.coverage=null;state.owner=null;for(const id of ['agendaGroups','commercialMetrics','businessMetrics','commercialFunnel','opportunityList','readyReport'])q(id).textContent='';for(const d of ['quickDialog','opportunityDialog','actionDialog','readyDialog'])q(d).close();setView('agenda')}
 q('agendaTab').addEventListener('click',()=>setView('agenda'));q('walletTab').addEventListener('click',()=>setView('wallet'));q('quickNewBtn').addEventListener('click',openQuick);q('quickForm').addEventListener('submit',submitQuick);q('opportunityForm').addEventListener('submit',submitOpportunity);q('actionForm').addEventListener('submit',submitAction);q('agendaFilter').addEventListener('change',render);q('newOpportunityBtn').addEventListener('click',()=>openOpportunity());q('planCompanyBtn').addEventListener('click',()=>openAction({companyId:active?.id}));q('exportCommercialBtn').addEventListener('click',exportCommercial);
 q('opportunityForm').elements.namedItem('estagio').addEventListener('change',ev=>{if(['ganho','perdido'].includes(ev.target.value))q('financeDetails').open=true});
 q('actionForm').elements.namedItem('continuidade').addEventListener('change',ev=>q('nextActionFields').hidden=ev.target.value==='encerrar');
 document.addEventListener('click',ev=>{const close=ev.target.closest('[data-close]');if(close)q(close.dataset.close).close();const b=ev.target.closest('[data-open-company],[data-action-plan],[data-reschedule],[data-edit-opportunity],[data-plan-opportunity]');if(!b)return;
  if(b.dataset.openCompany)openCompany(b.dataset.openCompany).catch(e=>notify(safe(e)));
  else if(b.dataset.editOpportunity)openOpportunity(b.dataset.editOpportunity);
  else if(b.dataset.planOpportunity)openAction({opportunityId:b.dataset.planOpportunity});
  else if(b.dataset.reschedule)openAction({actionId:b.dataset.reschedule,mode:'reschedule'});
  else {const a=actionById(b.dataset.actionPlan),o=oppById(b.dataset.actionPlan);openAction(a?{actionId:a.id,mode:'complete'}:o?{opportunityId:o.id}:{companyId:b.dataset.actionPlan})}
 });
 q('serviceOptions').innerHTML=Object.entries(c.SERVICES).map(([key,label])=>'<label><input type="checkbox" name="servicos" value="'+key+'">'+label+'</label>').join('');
 q('readyBtn').addEventListener('click',()=>{q('readyDialog').showModal();ready().catch(e=>notify(safe(e)))});q('refreshReadyBtn').addEventListener('click',()=>ready().catch(e=>notify(safe(e))));
 q('backupVaultBtn').addEventListener('click',async ev=>{ev.target.disabled=true;try{requireVault();const data=await OTOfflineVault.exportBackup();download(new Blob([JSON.stringify(data)],{type:'application/json'}),'ot-cofre-cifrado-'+c.today()+'.json');notify('Backup cifrado exportado. Guarde também a senha local separadamente.')}catch(e){notify(safe(e))}finally{ev.target.disabled=false}});
 q('restoreVaultForm').addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.submitter;b.disabled=true;try{requireVault();const file=q('restoreVaultFile').files[0];if(!file||file.size>128*1024*1024)throw Error('Selecione backup válido de até 128 MB');const result=await OTOfflineVault.importBackup(JSON.parse(await file.text()),q('restoreVaultPassword').value);q('restoreVaultPassword').value='';await load();notify('Backup verificado e mesclado sem sobrescrever: '+result.records+' registros, '+result.pending+' pendências.')}catch(e){notify('Restauração não concluída: '+safe(e))}finally{q('restoreVaultPassword').value='';b.disabled=false}});
 return {refresh,company,clear,ready};
})();
