import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const presentation = read('apresentacao-ot.html');
const cardSource = read('card-export.js');
const logos = read('ot-logo.js');
const index = read('index.html');
const workflow = read('.github/workflows/deploy-pages.yml');
const serviceMatch = presentation.match(/const SERVICES=(\[[\s\S]*?\]);\s*const KITS=/);
assert.ok(serviceMatch, 'Catálogo SERVICES deve existir');
const services = vm.runInNewContext('(' + serviceMatch[1] + ')');

test('Catálogo comercial contém oito serviços únicos, sem campos privados', () => {
  assert.equal(services.length, 8);
  assert.equal(new Set(services.map(service => service.id)).size, 8);
  for (const service of services) {
    for (const prop of ['id','title','intro','benefit','solve','includes','price']) {
      assert.ok(service[prop], service.id + ' missing ' + prop);
    }
    assert.match(service.id,/^[a-z][a-z0-9-]+$/);
  }
  assert.doesNotMatch(presentation,/ot_empresas|ot_fotos|access_token|sessionStorage|service_role/);
});

test('O acesso à apresentação está dentro da área de CRM protegida por login', () => {
  assert.ok(index.indexOf('id="appView"') >= 0);
  assert.ok(index.indexOf('ot-presentation') > index.indexOf('id="appView"'));
  assert.match(index, /href="apresentacao-ot\.html"/);
});

test('Páginas individuais oferecem compartilhar, WhatsApp, imagem e metadados sociais', () => {
  for (const service of services) {
    const path = 'solucoes/' + service.id + '.html';
    const html = read(path);
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:description"/);
    assert.match(html, /<script src="\.\.\/ot-logo\.js"><\/script>/);
    assert.match(html, /<script src="\.\.\/card-export\.js"><\/script>/);
    for (const action of ['share', 'whats','copy','png','shareImg']) {
      assert.ok(html.includes('id="' + action + '"'),path+' missing action '+action);
    }
    assert.doesNotMatch(html,/ot_empresas|ot_fotos|access_token|service_role|sessionStorage/);
    for (const part of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]) {
      assert.doesNotThrow(() => new vm.Script(part[1],{filename:path}));
    }
  }
});

test('Vitrine e gerador possuem JavaScript válido', () => {
  for (const part of [...presentation.matchAll(/<script>([\s\S]*?)<\/script>/g)])
    assert.doesNotThrow(() => new vm.Script(part[1]));
  assert.doesNotThrow(()=>new vm.Script(cardSource));
  assert.doesNotThrow(()=>new vm.Script(logos));
});

test('Identidade original embutida; pipeline empacota todos os arquivos', () => {
  assert.match(logos,/window\.OTBrandLogo\s*=\s*"data:image\/webp;base64,UklGR/);
  assert.match(workflow,/cp -R solucoes _site\//);
  assert.match(workflow,/card-export\.js ot-logo\.js _site\//);
  assert.match(workflow,/branches:\s*\[main\]/);
  assert.match(presentation,/solucoes\/'\+id\+'\.html'/);
});

function fakeBrowser() {
  const calls = [],canvas = {width:0,height:0};
  const noop=()=>{};
  const ctx = {
    font:'',fillStyle:'',strokeStyle:'',lineWidth:1,
    createLinearGradient(){return {addColorStop:noop}},
    createRadialGradient(){return {addColorStop:noop}},
    fillRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,
    closePath:noop,stroke:noop,fill:noop,save:noop,restore:noop,clip:noop,
    arc(...p){calls.push(['point',...p])},
    drawImage(...p){calls.push(['logo',...p.slice(1)])},
    fillText(t,x,y){calls.push(['text',String(t),x,y,this.font])},
    measureText(s){const size=Number(this.font.match(/(\d+)px/)?.[1]||40);
      return {width:[...String(s)].reduce((n,c)=>n+size*(c===' '?0.28:0.5),0)}}
  };
  canvas.getContext=()=>ctx;
  canvas.toBlob=cb=>cb({type:'image/png'});
  class FakeImage{set src(src){if(src.startsWith('data:image/webp;base64,'))this.onload?.()}}
  class FakeFile{constructor(chunks,name,options){this.name=name;this.type=options.type}}
  const browser = {
    window:{OTBrandLogo:'data:image/webp;base64,AAAA'},
    document:{createElement(name){assert.equal(name,'canvas');return canvas}},
    Image:FakeImage,File:FakeFile,URL:{},navigator:{},setTimeout:noop
  };
  vm.runInNewContext(cardSource,browser);
  return {api:browser.window.OTCardExport,canvas,calls};
}

test('Oito cards 1080x1920: somente 23 pontos periféricos, com logo e texto na área',async()=>{
  const t=fakeBrowser();
  for (const service of services) {
    t.calls.length=0;
    const file=await t.api.create(service);
    const pts=t.calls.filter(x=>x[0]==='point');
    const logo=t.calls.filter(x=>x[0]==='logo');
    const lines=t.calls.filter(x=>x[0]==='text');
    assert.equal(t.canvas.width,1080);
    assert.equal(t.canvas.height,1920);
    assert.equal(pts.length,23,'Partículas: '+service.id);
    assert.ok(pts.every(p=>[43,1038,832,924,1016].includes(p[1])),'Partículas apenas nas bordas: '+service.id);
    assert.equal(logo.length,1,'Logo oficial: '+service.id);
    assert.ok(lines.length>=8,'Conteúdo: '+service.id);
    assert.ok(lines.every(line=>line[3]>0&&line[3]<1920),'Texto dentro do card: '+service.id);
    assert.match(file.name,/^OT-[a-z-]+-1080x1920\.png$/);
    assert.equal(file.type,'image/png');
  }
});
