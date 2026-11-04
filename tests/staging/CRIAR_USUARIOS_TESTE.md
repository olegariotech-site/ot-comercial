# OT Comercial — criação segura de contas de teste (Supabase STAGING)

**Projeto EXCLUSIVO:** `ot-comercial-homologacao`, ref `efscgxwvaixwqhffwdqu`.
**Proibido:** criar usuários fictícios no projeto de produção `agvjqxmrzffkksrgdndn`.

## Procedimento pelo painel oficial

1. Abrir: https://supabase.com/dashboard/project/efscgxwvaixwqhffwdqu/auth/users
2. Conferir o nome do projeto **ot-comercial-homologacao**.
3. Clicar em **Add user** → **Create new user** (o texto do painel pode variar).
4. Criar dois usuários de teste com emails distintos controlados pelo proprietário; aliases de Gmail com `+otqa1` e `+otqa2` são opções possíveis, caso desejado.
5. Usar **senhas fortes diferentes**, guardadas em gerenciador de senhas. **Nunca incluir senhas ou tokens em chats, issues, GitHub, prints ou arquivos do repositório.**
6. Caso o painel permita confirmar o e-mail do usuário de teste durante a criação, utilizá-lo apenas nas contas de staging. Não desativar globalmente a confirmação de e-mail do serviço sem necessidade.
7. Verificar que apenas os dois usuários fictícios aparecem no projeto de homologação. Não importar Auth da produção.
8. Avisar no chat somente **"duas contas de homologação criadas"**, sem divulgar email exato, senha, token ou código de acesso.

## Próxima etapa após a criação
- Verificar Auth HTTPS real com `tests/staging/qa-live-api.mjs` usando variáveis de ambiente protegidas localmente.
- Conferir RLS entre usuários distintos (empresa/visita/fotos do usuário A invisíveis para B).
- Confirmar armazenamento privado, retries com UUID estável, remoção apenas dos registros fictícios.
- Executar prévia `artifacts/staging-preview/` em endereço HTTPS isolado — o ZIP do GitHub Actions não é um website público.
- Realizar Gate de campo no Edge Android e em Safari iOS com dados inventados, câmera e desconexão.

## Estado de segurança de hoje
- Segundo projeto no plano Free, cotação US$ 0/mês.
- Esquema SQL aplicado ao staging e 13/13 asserções estruturais aprovadas.
- HTTP anônimo efetivo devolveu **401** em `ot_empresas`, `ot_visitas` e `ot_fotos`.
- Pacote de preview seguro gerado e armazenado como artefato de CI; **não publicado**.
- Nenhuma conta Auth de teste criada até aqui por esta automação; ferramenta conectada não tem acesso à Auth Admin API.
- O módulo offline V1.5 ainda não está aprovado para dados reais ou publicação.
