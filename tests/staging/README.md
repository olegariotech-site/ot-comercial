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
1. Confirmar com Alexandre a organização **e** obter cotação oficial de R$ 0. Não criar projeto se houver custo.
2. Criar projeto separado, nunca uma branch paga ou compartilhando dados com produção.
3. Aplicar o schema no projeto de homologação APENAS, usando migração controlada.
4. Conferir as verificações com `verify.sql` e assessoria de segurança do Supabase.
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
