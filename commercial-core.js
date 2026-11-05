/* OT Comercial V1.6: regras puras de agenda e histórico comercial imutável. */
'use strict';
(function(root){
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const STAGES={diagnostico:'Diagnóstico',proposta:'Proposta',negociacao:'Negociação',ganho:'Ganho',perdido:'Perdido'};
 const SERVICES={diagnostico:'Diagnóstico digital',site:'Site profissional',google:'Google e SEO local',catalogo:'Catálogo',cardapio:'Cardápio',identidade:'Identidade visual',redes:'Redes sociais'};
 const active=s=>!['ganho','perdido'].includes(s);
 const id=(v,label='ID')=>{if(!UUID.test(v||''))throw Error(label+' inválido');return v};
 const text=(v,max=3000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('Texto inválido ou longo demais');return v.trim()};
 function date(v){if(!v)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('Data inválida');const d=new Date(v+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw Error('Data inválida');return v}
 function today(now=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=t=>p.find(x=>x.type===t).value;return get('year')+'-'+get('month')+'-'+get('day')}
 function cents(v){
  if(v==null||String(v).trim()==='')return null;
  let s=String(v).trim().replace(/^R\$\s*/,'');
  if(s.includes(',')){if(!/^\d{1,3}(?:\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(s))throw Error('Valor BRL inválido');s=s.replace(/\./g,'').replace(',','.')}
  else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Valor BRL inválido');
  const [whole,frac='']=s.split('.'),n=Number(whole)*100+Number(frac.padEnd(2,'0'));
  if(!Number.isSafeInteger(n)||n>100000000000)throw Error('Valor fora do limite');return n;
 }
 const money=n=>n==null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 function phone(v){let n=String(v||'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return /^55[1-9]{2}[2-9]\d{7,8}$/.test(n)?'https://wa.me/'+n:null}
 function amount(v){if(v==null)return null;if(!Number.isSafeInteger(v)||v<0||v>100000000000)throw Error('Valor em centavos inválido');return v}
 function opportunity(data){
  const o={titulo:text(data.titulo,150),servicos:Array.isArray(data.servicos)?[...new Set(data.servicos)]:[],estagio:data.estagio||'diagnostico',decisor:text(data.decisor,120),contato:text(data.contato,40),papel_contato:text(data.papel_contato,80),melhor_horario:text(data.melhor_horario,100),necessidade:text(data.necessidade),objecao:text(data.objecao,1000),origem_clientes:text(data.origem_clientes,1000),prioridade_cliente:text(data.prioridade_cliente,1000),jornada_online:text(data.jornada_online,1500),presenca_verificada:text(data.presenca_verificada,2000),case_id:text(data.case_id,50),implantacao_proposta:amount(data.implantacao_proposta),mensalidade_proposta:amount(data.mensalidade_proposta),valor_fechado:amount(data.valor_fechado),recorrencia_contratada:amount(data.recorrencia_contratada),recorrencia_status:data.recorrencia_status||'nao_contratada',escopo_mensal:text(data.escopo_mensal,2000),entregas_mensais:text(data.entregas_mensais,2000),frequencia:text(data.frequencia,200),contratado_em:date(data.contratado_em),motivo_perda:text(data.motivo_perda,1000)};
  if(!o.titulo||!STAGES[o.estagio]||o.servicos.some(s=>!SERVICES[s])||!['nao_contratada','ativa','encerrada'].includes(o.recorrencia_status))throw Error('Oportunidade inválida');
  if(o.estagio==='ganho'&&o.valor_fechado==null)throw Error('Informe o valor fechado, inclusive zero se acordado');
  if(o.recorrencia_status==='ativa'&&(o.estagio!=='ganho'||!(o.recorrencia_contratada>0)||!o.escopo_mensal||!o.entregas_mensais||!o.frequencia||!o.contratado_em))throw Error('Recorrência ativa exige ganho, valor contratado, data, escopo, entregas e frequência');
  if(o.estagio==='perdido'&&!o.motivo_perda)throw Error('Registre o motivo da perda');
  return o;
 }
 function action(data){
  const a={oportunidade_id:data.oportunidade_id?id(data.oportunidade_id):null,descricao:text(data.descricao,500),data_prevista:date(data.data_prevista),tipo:data.tipo||'retorno',estado:data.estado||'aberta',resultado:text(data.resultado),concluida_em:data.concluida_em||null,proxima_acao_id:data.proxima_acao_id?id(data.proxima_acao_id):null,encerramento:data.encerramento===true};
  if(!a.descricao||!['retorno','apresentacao','proposta','pos_venda','outro'].includes(a.tipo)||!['aberta','concluida','cancelada'].includes(a.estado))throw Error('Ação inválida');
  if(a.estado!=='aberta'&&(!a.resultado||!a.concluida_em||!Number.isFinite(Date.parse(a.concluida_em))))throw Error('Registre o desfecho e data da ação');
  if(a.estado==='concluida'&&!a.proxima_acao_id&&!a.encerramento)throw Error('Defina próxima ação ou encerramento explícito');
  return a;
 }
 function event(e,owner){
  id(e.id);id(e.entity_id);id(e.empresa_id);
  if(e.owner_id&&owner&&e.owner_id!==owner)throw Error('Evento de outro titular');
  if(!['opportunity','action'].includes(e.entity_type))throw Error('Tipo comercial inválido');
  if(e.parent_id)id(e.parent_id);if(e.parent_id===e.id)throw Error('Evento não pode depender de si');
  if(!Number.isFinite(Date.parse(e.occurred_at)))throw Error('Data do evento inválida');
  return {id:e.id,empresa_id:e.empresa_id,entity_id:e.entity_id,entity_type:e.entity_type,parent_id:e.parent_id||null,occurred_at:e.occurred_at,data:e.entity_type==='opportunity'?opportunity(e.data||{}):action(e.data||{})};
 }
 function make(type,company,data,previous=null,entityId=null,uuid=()=>crypto.randomUUID()){
  if(previous&&(previous.entity_type!==type||previous.empresa_id!==company))throw Error('Associação de entidade incorreta');
  return event({id:uuid(),empresa_id:company,entity_type:type,entity_id:previous?.entity_id||entityId||uuid(),parent_id:previous?.id||null,occurred_at:new Date().toISOString(),data});
 }
 function project(events,owner){
  const groups=new Map(),seen=new Map(),errors=[];
  for(const raw of events){
   let e;try{e=event(raw,owner)}catch{errors.push('Evento comercial inválido ou de outro titular');continue}
   if(seen.has(e.id)){if(JSON.stringify(seen.get(e.id))!==JSON.stringify(e))errors.push('ID comercial com conteúdos divergentes');continue}seen.set(e.id,e);
   const key=e.entity_type+':'+e.entity_id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
  }
  const opportunities=[],actions=[];
  for(const rows of groups.values()){
   const roots=rows.filter(r=>!r.parent_id),byParent=new Map();let conflict=roots.length!==1;
   for(const r of rows){if(r.parent_id){if(!byParent.has(r.parent_id))byParent.set(r.parent_id,[]);byParent.get(r.parent_id).push(r)}}
   let head=roots[0]||rows.slice().sort((a,b)=>a.id.localeCompare(b.id))[0],chain=[],visited=new Set();
   while(head&&!visited.has(head.id)){
    visited.add(head.id);chain.push(head);const next=byParent.get(head.id)||[];
    if(next.length>1){conflict=true;break}if(!next.length)break;
    if(next[0].empresa_id!==head.empresa_id){conflict=true;break}head=next[0];
   }
   if(visited.size!==rows.length)conflict=true;
   const value={...head.data,id:head.entity_id,empresa_id:head.empresa_id,head,history:rows,conflict};
   (head.entity_type==='opportunity'?opportunities:actions).push(value);
  }
  return {opportunities,actions,errors};
 }
 function agenda(companies,projection,now=new Date()){
  const day=today(now),groups={vencidos:[],hoje:[],proximos:[],definir:[]},byCompany=new Map(companies.map(c=>[c.id,c])),byOpp=new Map(projection.opportunities.map(o=>[o.id,o]));
  const planned=new Set();let openProposals=0;
  for(const o of projection.opportunities)if(['proposta','negociacao'].includes(o.estagio))openProposals++;
  for(const a of projection.actions){
   if(a.estado!=='aberta')continue;
   const c=byCompany.get(a.empresa_id),o=a.oportunidade_id?byOpp.get(a.oportunidade_id):null;
   if(!c)continue;
   if(o&&o.empresa_id!==c.id){projection.errors.push('Ação com associação inválida');continue}
   if(o&&!active(o.estagio)&&a.tipo!=='pos_venda')continue;
   if(!o&&['Cliente fechado','Sem interesse'].includes(c.status)&&a.tipo!=='pos_venda')continue;
   if(o)planned.add(o.id);
   const conflict=a.conflict||o?.conflict;
   const group=conflict||!a.data_prevista?'definir':a.data_prevista<day?'vencidos':a.data_prevista===day?'hoje':'proximos';
   groups[group].push({id:a.id,company:c,opportunity:o,action:a,planning:false,conflict:!!conflict});
  }
  for(const o of projection.opportunities){
   if(active(o.estagio)&&!planned.has(o.id)&&byCompany.has(o.empresa_id))groups.definir.push({id:o.id,company:byCompany.get(o.empresa_id),opportunity:o,planning:true,conflict:o.conflict});
  }
  for(const c of companies)if(!['Cliente fechado','Sem interesse'].includes(c.status)&&!projection.opportunities.some(o=>o.empresa_id===c.id)&&!projection.actions.some(a=>a.empresa_id===c.id&&a.estado==='aberta'))groups.definir.push({id:c.id,company:c,planning:true,legacy:true});
  for(const list of Object.values(groups))list.sort((a,b)=>(a.action?.data_prevista||'9999').localeCompare(b.action?.data_prevista||'9999')||a.company.nome.localeCompare(b.company.nome));
  return {day,groups,openProposals,actionCount:Object.values(groups).flat().filter(r=>!r.planning).length,planningCount:groups.definir.filter(r=>r.planning).length};
 }
 function metrics(p){
  const won=p.opportunities.filter(o=>o.estagio==='ganho'&&!o.conflict),closed=p.actions.filter(a=>a.estado==='concluida'&&!a.conflict);
  const dated=closed.filter(a=>a.data_prevista),onTime=dated.filter(a=>today(new Date(a.concluida_em))<=a.data_prevista);
  const proposed=p.opportunities.filter(o=>o.history.some(e=>['proposta','negociacao'].includes(e.data.estagio)));
  return {implantacao:won.reduce((s,o)=>s+(o.valor_fechado||0),0),mrr:won.filter(o=>o.recorrencia_status==='ativa').reduce((s,o)=>s+(o.recorrencia_contratada||0),0),propostasAbertas:p.opportunities.filter(o=>['proposta','negociacao'].includes(o.estagio)).length,retornosCumpridos:closed.length,pontuais:onTime.length,comData:dated.length,conversaoPropostas:proposed.length?proposed.filter(o=>o.estagio==='ganho'&&!o.conflict).length/proposed.length:null,stages:Object.fromEntries(Object.keys(STAGES).map(k=>[k,p.opportunities.filter(o=>o.estagio===k).length]))};
 }
 root.OTCommercial={UUID,STAGES,SERVICES,active,id,text,date,today,cents,money,phone,opportunity,action,event,make,project,agenda,metrics};
})(typeof window==='undefined'?globalThis:window);
