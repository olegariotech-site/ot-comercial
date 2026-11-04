# OT Comercial V1.5 — Supabase de homologação (Gate D)

**Separado da produção. Nenhuma cópia de clientes. Nenhuma publicação.**

## Fatos verificados em 04/11/2026
- Organização Supabase disponível: `alex.atendimento@gmail.com's Org`, ID `jmvzceepqgdosghqgiad`. Plano atual: Free.
- Projeto existente/produção: `ot-comercial`, ID `agvjqxmrzffkksrgdndn`, região `sa-east-1`.
- A documentação do Supabase prevê dois projetos no Free. **Confirmar organização e custo zero pelo fluxo oficial antes de criar o staging.**
- Destino proposto: novo projeto `ot-comercial-homologacao`, região `sa-east-1`. Não criar em outra organização sem confirmação.

## Arquivos preparados
- `schema.sql`: esquema independente com 3 tabelas vazias, UUIDs, FKs compostas, 12 políticas RLS, três políticas do Storage e bucket privado (6 MB, JPEG/PNG/WebP).
- `verify.sql`: inspeções somente leitura de RLS, bucket, relações e confirmação de banco vazio.

## Execução segura
1. CONFIRMADO: organização aprovada por Alexandre, cotação oficial US$ 0/mês, segundo projeto criado em São Paulo.
2. CONCLUÍDO: staging `efscgxwvaixwqhffwdqu`, `ot-comercial-homologacao` (Supabase Free); projeto de produção isolado.
3. CONCLUÍDO: esquema aplicado por migração somente ao staging (três tabelas vazias, 12 políticas RLS, bucket privado e políticas Storage).
4. CONCLUÍDO: `verify.sql` validado, sem dados, e Security Advisor sem alertas na consulta inicial.
5. Criar uma conta de teste nova. Não reutilizar o acesso real da OT nem guardar senhas no repositório ou GitHub Actions.
6. Configurar credenciais públicas de *staging* em preview isolado, sem mudar o site `main` do GitHub Pages.
7. Validar registro/visita/foto: 3 pendências offline → zero após confirmação da API, sem duplicação.
8. Repetir com segunda conta autenticada e conferir que RLS/Storage impedem acesso cruzado.
9. Verificar resultados em Edge Android, Windows e Safari iOS antes da publicação.
10. Apagar apenas dados de testes após registrar os resultados e fazer backup das evidências.

## Bloqueadores
- Custo não autorizado se a cotação for diferente de zero.
- Homologação em dispositivos físicos ainda não executada.
- Proteção de backup de itens pendentes e política de expiração do armazenamento local.
- PR #5 é *draft*. `main` permanece a V1.2 em produção.

**Não copiar usuários, senhas, fotos, dados de clientes nem Storage da produção.**

## Estado confirmado após execução
- **Staging:** https://supabase.com/dashboard/project/efscgxwvaixwqhffwdqu
- **API staging:** https://efscgxwvaixwqhffwdqu.supabase.co
- **Organização:** `jmvzceepqgdosghqgiad` (Free); cotação de criação US$ 0/mês.
- **Migração aplicada no staging:** `ot_comercial_staging_inicial_20261104`.
- **Banco vazio** após migração: nenhuma empresa, visita, foto ou usuário de produção importado.
- **Permissões:** anon sem leitura nas 3 tabelas, role authenticated autorizada sob RLS por owner.
- **Pendente:** usuários de testes separados via Auth, preview HTTPS isolado para Android/iOS e fluxo HTTP real ponta a ponta.
- **Institucionalização OT:** adicionar `olegariotech.oficial@gmail.com` como administradora via convites da organização após homologação, sem remover o acesso do proprietário antes de conferir os privilégios.

## Teste REST real preparado, ainda NÃO executado
- Script: `tests/staging/qa-live-api.mjs`.
- Exige uma conta de testes **criada somente no projeto de homologação** e duas variáveis de ambiente com e-mail/senha de testes, sem inserir segredos no repositório.
- Usa chave `sb_publishable_` do staging, jamais service_role/secret.
- Só permite URL fixa do staging `efscgxwvaixwqhffwdqu`, impedindo uso acidental do projeto real.
- Fluxo: autenticar → criar empresa/visita/foto fictícios → verificar API, Storage e RLS → tentar duplicação → solicitar exclusão pelos UUIDs usados neste teste.
- Opcional: segunda conta fictícia para comprovar isolamento cruzado (recomendado antes da homologação).
- A conta de testes pode ser criada no painel Supabase Auth > Users. **Não colar senha nesta conversa ou no GitHub**.
- A sintaxe do script é verificada pela CI; a execução real aguarda usuário de teste e validação do ambiente.
- **Ainda não existe URL pública de preview para Android.** Não utilizar o CRM produtivo para testes offline.
