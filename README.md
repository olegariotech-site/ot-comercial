# OT Comercial — V1.2 | Publicação GitHub Pages

Frontend separado do site oficial da Olegario Tech.

## O que publicar
`index.html`, `style.css`, `app.js`, `config.js`, `.nojekyll` e `robots.txt`.

## Implantação
1. Criar repositório **novo** `ot-comercial` na conta `olegariotech-site` (GitHub Pages no plano Free exige repositório público).
2. Publicar os arquivos acima na raiz de `main`, sem subir `schema.sql`, fotos de clientes ou credenciais privadas.
3. Settings > Pages > Source: Deploy from a branch > Branch: main > /(root) > Save.
4. Após o Pages fornecer a URL, testar o login via Supabase com a conta institucional.
5. Testar cadastro de empresa **fictícia**, edição, visita, upload/download de imagem de teste, logout, pesquisa e exportação.
6. Confirmar que usuários não autenticados não conseguem ler/escrever dados (RLS), inclusive via API.
7. Só então usar dados reais.

## Segurança
`config.js` usa a chave **publicável** do Supabase, intencionalmente visível no navegador.
Nunca inserir `service_role`, `sb_secret_*`, senha do usuário, tokens de sessão ou dados pessoais no repositório.
O frontend ficará acessível publicamente; a proteção de cadastros depende do Supabase Auth, RLS e Storage privado.
`robots.txt`/`noindex` não são medidas de proteção.
Limites: até 12 fotos/cliente na interface, JPG/PNG/WebP com até 6 MB; sem modo offline.
GitHub Pages não é hospedagem privada de aplicativos. Verificar adequação e termos da plataforma antes de tratar a aplicação como sistema definitivo.
