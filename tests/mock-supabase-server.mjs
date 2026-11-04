/* OT Comercial Gate D — Supabase de teste inteiramente simulado em localhost.
 * Não chama servidores externos, não contém credenciais, não acessa dados reais.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
const USER='11111111-1111-4111-8111-111111111111';
const TOKEN='QA_TOKEN_NOT_A_REAL_TOKEN';
const REFRESH='QA_REFRESH_NOT_A_REAL_TOKEN';
const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const fail=(res,status,msg)=>json(res,status,{message:msg});
const body=async(req,limit=8*1024*1024)=>{let bytes=0;const parts=[];for await(const x of req){bytes+=x.length;if(bytes>limit)throw Error('Exceeds test size limit');parts.push(x)}return Buffer.concat(parts)};
export function startMockSupabase(root,tls=null){
 const map={ot_empresas:new Map(),ot_visitas:new Map(),ot_fotos:new Map()},media=new Map(),calls=[];
 const scheme=tls?'https':'http';
 const server=(tls?https:http).createServer(tls||{},async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const pathname=decodeURIComponent(url.pathname);
  try{
   if(pathname==='/config.js'){
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
    res.end('window.OT_CONFIG={url:"'+scheme+'://127.0.0.1:'+server.address().port+'",publishableKey:"sb_publishable_QA_MOCK_NOT_REAL"};');
    return;
   }
   if(pathname==='/auth/v1/token'){
    if(url.searchParams.get('grant_type')==='password'){
     const input=JSON.parse((await body(req)).toString());
     if(input.email!=='qa@ot.invalid'||input.password!=='SomenteTesteOT-2026!')
      return fail(res,400,'Login de teste inválido');
    }
    return json(res,200,{access_token:TOKEN,refresh_token:REFRESH,expires_in:3600,token_type:'bearer'});
   }
   if(pathname==='/auth/v1/user'){
    if(req.headers.authorization!=='Bearer '+TOKEN)return fail(res,401,'Credencial simulada inválida');
    return json(res,200,{id:USER,email:'qa@ot.invalid'});
   }
   if(pathname.startsWith('/rest/v1/')||pathname.startsWith('/storage/v1/')){
    if(req.headers.authorization!=='Bearer '+TOKEN)return fail(res,401,'Credencial simulada inválida');
   }
   if(pathname.startsWith('/rest/v1/')){
    const table=pathname.split('/')[3];
    if(!map[table])return fail(res,404,'Tabela de teste inexistente');
    if(req.method==='GET')return json(res,200,rows(table,url.searchParams,map));
    if(req.method==='POST'){
     const val=JSON.parse((await body(req)).toString());
     if(!val.id)return fail(res,400,'UUID explicito obrigatório');
     if(map[table].has(val.id))return fail(res,409,'duplicate key');
     if(table!=='ot_empresas'&&!map.ot_empresas.has(val.empresa_id))
      return fail(res,409,'FK: empresa não encontrada');
     const row={...val,owner_id:USER,
      created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
     if(table==='ot_visitas')row.realizado_em=val.realizado_em||new Date().toISOString();
     if(table==='ot_fotos'){row.descricao=val.descricao||'';row.publicacao_autorizada=!!val.publicacao_autorizada}
     map[table].set(val.id,row);calls.push('POST '+table+' '+val.id);return json(res,201,[row]);
    }
    if(req.method==='PATCH'){
     const match=url.searchParams.get('id')||'';
     if(!match.startsWith('eq.'))return fail(res,400,'ID obrigatório');
     const id=match.slice(3),record=map[table].get(id);
     if(!record)return json(res,200,[]);
     Object.assign(record,JSON.parse((await body(req)).toString()));
     calls.push('PATCH '+table+' '+id);return json(res,200,[record]);
    }
    return fail(res,405,'Verbo REST não simulado');
   }
   if(pathname.startsWith('/storage/v1/object/')){
    let key=pathname.slice('/storage/v1/object/'.length);
    if(key.startsWith('authenticated/'))key=key.slice('authenticated/'.length);
    if(!key.startsWith('ot-clientes-privado/'))return fail(res,404,'Bucket de teste inexistente');
    if(req.method==='GET'){
     const image=media.get(key);if(!image)return fail(res,404,'Object not found');
     res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.bytes.length,'Cache-Control':'no-store'});
     res.end(image.bytes);return;
    }
    if(req.method==='POST'){
     if(media.has(key))return fail(res,409,'Object already exists');
     const bytes=await body(req);media.set(key,{bytes,type:req.headers['content-type']||'image/png'});
     calls.push('PHOTO '+key);return json(res,200,{Key:key});
    }
    return fail(res,405,'Verbo Storage não simulado');
   }
   if(req.method!=='GET')return fail(res,405,'Somente GET permitido em arquivos');
   const staticPath=pathname==='/'?'/index.html':pathname;
   const safe=path.resolve(root,'.'+staticPath);
   if(!safe.startsWith(path.resolve(root)+path.sep))return fail(res,403,'Caminho fora dos testes');
   const stat=fs.existsSync(safe)&&fs.statSync(safe).isFile();
   if(!stat)return fail(res,404,'Arquivo ausente: '+pathname);
   const ext=path.extname(safe);
   res.writeHead(200,{'Content-Type':type[ext]||'application/octet-stream'});
   fs.createReadStream(safe).pipe(res);
  }catch(e){fail(res,500,'Erro no teste: '+e.message)}
 });
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({
  server,origin:scheme+'://127.0.0.1:'+server.address().port,map,media,calls,user:USER,
  close:()=>new Promise(r=>server.close(r))
 })));
}
function rows(table,params,map){
 let all=[...map[table].values()];
 const id=params.get('id');if(id?.startsWith('eq.'))all=all.filter(r=>r.id===id.slice(3));
 const company=params.get('empresa_id');if(company?.startsWith('eq.'))all=all.filter(r=>r.empresa_id===company.slice(3));
 return all;
}
