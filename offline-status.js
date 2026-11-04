/* Rede informativa; não simula salvamento nem sincronização offline. */
'use strict';
(()=>{
 const banner=document.getElementById('offlineNotice');
 const chip=document.getElementById('connectionState');
 if(!banner||!chip)return;
 let previous='';
 function update(){
  const offline=navigator.onLine===false;
  banner.hidden=!offline;
  if(offline){if(!previous)previous=chip.textContent;chip.textContent='Sem internet';}
  else if(previous){chip.textContent='Rede disponível — verificar nuvem';previous='';}
 }
 window.addEventListener('online',update);
 window.addEventListener('offline',update);
 update();
})();
