'use strict';
/* Exportação local de card OT 1080x1920 (9:16).
 * Não contém dados do CRM, nem carrega fontes/imagens externas.
 * O logotipo oficial é carregado da cópia original via ot-logo.js.
 */
window.OTCardExport=(()=>{
 const WIDTH=1080,HEIGHT=1920;
 const color={white:'#F4F8FF',pale:'#D5E6FA',muted:'#B5C6E1',cyan:'#81E4FF'};
 function wrap(ctx,text,maxW,maxLines=6){
  const words=String(text).trim().split(/\s+/);const lines=[];let line='';
  for(const word of words){
   const next=line?line+' '+word:word;
   if(ctx.measureText(next).width<=maxW){line=next;continue;}
   if(line)lines.push(line);
   if(lines.length===maxLines){const prev=lines[maxLines-1];lines[maxLines-1]=prev.replace(/\s*\S+$/,'')+'…';return lines}
   line=word;
  }
  if(line)lines.push(line);
  return lines.slice(0,maxLines);
 }
 function lines(ctx,txt,x,y,maxW,lineH,maxLines=5){
  const arr=wrap(ctx,txt,maxW,maxLines);
  for(let i=0;i<arr.length;i++)ctx.fillText(arr[i],x,y+i*lineH);
  return y+arr.length*lineH;
 }
 function rectangle(ctx,x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
  ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
  ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
 }
 function render(service,logo){
  if(!service?.title||!service?.intro||!service?.benefit)throw Error('Card incompleto');
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponível');
  const bg=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);bg.addColorStop(0,'#081320');bg.addColorStop(.55,'#19294A');bg.addColorStop(1,'#211538');ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
  const blue=ctx.createRadialGradient(970,360,40,970,360,900);blue.addColorStop(0,'#285E9Baa');blue.addColorStop(1,'#285E9B00');ctx.fillStyle=blue;ctx.fillRect(0,0,WIDTH,HEIGHT);
  const purple=ctx.createRadialGradient(30,1460,0,30,1460,760);purple.addColorStop(0,'#6440A666');purple.addColorStop(1,'#6440A600');ctx.fillStyle=purple;ctx.fillRect(0,700,WIDTH,HEIGHT-700);
  // Premium Clean: textura de partículas somente na periferia, sem competir com textos.
  // Antes: grade de ~300 pontos em toda a peça; agora: ~25 pontos discretos nas bordas.
  ctx.save();
  ctx.fillStyle='rgba(130,204,255,0.085)';
  for(let y=350;y<=1620;y+=135){
   for(const x of [43,1038]){
    ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill();
   }
  }
  // Pequena constelação superior direita, fora das áreas de título e benefício.
  ctx.fillStyle='rgba(130,204,255,0.055)';
  for(const x of [832,924,1016]){ctx.beginPath();ctx.arc(x,376,1.05,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  ctx.fillStyle='#8EDEFF';ctx.fillRect(90,135,90,7);
  if(logo){ctx.save();rectangle(ctx,832,130,160,160,20);ctx.clip();ctx.drawImage(logo,832,130,160,160);ctx.restore();}
  ctx.fillStyle=color.white;ctx.font='800 43px system-ui, sans-serif';ctx.fillText('OLEGARIO TECH',90,235);
  ctx.fillStyle=color.muted;ctx.font='500 23px system-ui, sans-serif';ctx.fillText('SOLUÇÕES DIGITAIS PARA NEGÓCIOS',90,277);
  ctx.fillStyle='#A7DFF7';ctx.font='700 25px system-ui, sans-serif';ctx.fillText(String(service.tag||'SOLUÇÃO DIGITAL').toUpperCase().slice(0,45),92,460);
  ctx.font='800 112px system-ui, sans-serif';ctx.fillStyle=color.white;
  let last=lines(ctx,service.title,88,600,880,126,3);
  ctx.fillStyle=color.pale;ctx.font='400 43px system-ui, sans-serif';
  last=lines(ctx,service.intro,92,Math.max(790,last+100),890,65,6);
  const benefitY=Math.max(1235,Math.min(1370,last+90));
  rectangle(ctx,72,benefitY,936,255,32);ctx.fillStyle='#061626bb';ctx.fill();
  ctx.strokeStyle='#78CFFF7f';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=color.cyan;ctx.font='700 25px system-ui, sans-serif';ctx.fillText('POR QUE VALE A PENA',112,benefitY+61);
  ctx.fillStyle=color.white;ctx.font='500 38px system-ui, sans-serif';
  lines(ctx,service.benefit,110,benefitY+118,855,52,3);
  ctx.fillStyle='#75CFFF';ctx.fillRect(90,1668,900,2);
  ctx.fillStyle=color.white;ctx.font='800 39px system-ui, sans-serif';ctx.fillText('CONHEÇA A OT',91,1750);
  ctx.fillStyle=color.pale;ctx.font='500 30px system-ui, sans-serif';ctx.fillText('olegariotech.com.br',91,1814);
  ctx.fillStyle=color.muted;ctx.font='400 18px system-ui, sans-serif';ctx.fillText('Apresentação ilustrativa. Soluções e investimento sujeitos a diagnóstico.',90,1870);
  return canvas;
 }
 function toBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Falha ao gerar PNG')),'image/png'))}
 function fileName(s){return 'OT-'+String(s.id||'apresentacao').replace(/[^a-z0-9-]/gi,'').slice(0,40)+'-1080x1920.png'}
 let logoPromise;
 async function loadLogo(){
  if(!window.OTBrandLogo)return null;
  if(!logoPromise)logoPromise=new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=window.OTBrandLogo});
  return logoPromise;
 }
 async function create(service){const canvas=render(service,await loadLogo());const blob=await toBlob(canvas);return new File([blob],fileName(service),{type:'image/png'})}
 function download(file){const u=URL.createObjectURL(file);const a=document.createElement('a');a.href=u;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
 async function save(service){const file=await create(service);download(file);return file}
 async function share(service){
  const file=await create(service);
  if(navigator.share&&navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:'OLEGARIO TECH | '+service.title});return 'shared'}
   catch(e){if(e?.name==='AbortError')return 'canceled';}
  }
  download(file);return 'downloaded';
 }
 return {create,save,share};
})();
