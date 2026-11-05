/* Somente portfólio público autorizado. Nenhum acesso ao cofre, sessão ou CRM. */
'use strict';
(()=>{
 const cases=[
  {id:'dudu',segment:'alimentacao',name:'Açaí do Dudu',url:'https://acaidodudu.com.br/',description:'Identidade visual e apresentação de sabores e cardápio, com acesso aos canais de contato.'},
  {id:'adega',segment:'alimentacao',name:'Adega São Marcos',url:'https://adegasaomarcos.com.br/',description:'Apresentação de produtos e opções de chopp, com informações para solicitar atendimento.'},
  {id:'armazem',segment:'comercio',name:'Armazém Ripamonti',url:'https://armazemripamonti.com.br/',description:'Apresentação do comércio local, seus produtos e canais de atendimento.'},
  {id:'kl',segment:'servicos',name:'K.L Transporte Express',url:'https://kltransporteexpress.com.br/',description:'Apresentação dos serviços de transporte e caminhos para solicitar orçamento.'},
  {id:'cintia',segment:'servicos',name:'Cíntia Almeida Advocacia',url:'https://cintiaalmeidaadvocacia.com.br/',description:'Presença institucional com identidade visual e informações de contato profissional.'}
 ];
 const select=document.getElementById('caseSegment'),initial=new URLSearchParams(location.search).get('segment');if(['todos','alimentacao','comercio','servicos'].includes(initial))select.value=initial;
 function render(){document.getElementById('caseCards').innerHTML=cases.filter(c=>select.value==='todos'||c.segment===select.value).map(c=>'<article class="card"><h2>'+c.name+'</h2><p>'+c.description+'</p><a class="btn secondary" href="'+c.url+'" target="_blank" rel="noopener">Visitar site · requer internet</a></article>').join('');document.getElementById('caseNetwork').textContent=navigator.onLine===false?'Apresentação local offline. Sites externos precisam de conexão.':'Cases públicos autorizados; nenhuma ficha privada é exibida.'}
 select.addEventListener('change',render);window.addEventListener('online',render);window.addEventListener('offline',render);render();
})();
