# OT Comercial V1.3 — Offline First (candidato de revisão, NÃO publicado)

## Objetivo
Cadastro de empresas, briefings, visitas e fotos em campo sem conexão, com envio posterior ao Supabase. Preservar a V1.2 na `main` e todos os dados reais.

## Arquitetura
- **GitHub Pages**: apenas shell estático (index.html, CSS, JavaScript, service worker).
- **Supabase**: Auth, REST/RLS e Storage privado existentes. Nenhuma migration para o banco de produção nesta etapa.
- **IndexedDB**: dados locais por usuário criptografados em AES-GCM. Chave derivada da frase offline por PBKDF2 (310.000 iterações). Frase/segredos não armazenados.
- **Service Worker**: guarda somente arquivos públicos do aplicativo para abrir sem internet; não armazena dados, tokens ou respostas do Supabase.
- **IDs determinísticos por operação**: UUID gerado antes do envio e reutilizado nos retries (PostgREST ignore-duplicates + leitura de confirmação).
- **Fluxo**: empresas primeiro, visitas em seguida e fotografias depois. Se não houver confirmação, a pendência permanece no aparelho.
- **Conflitos**: edição de empresa já existente é bloqueada se o conteúdo no servidor divergir da versão anterior; não sobrescreve silenciosamente. Revisão manual exigida (V1.3 ainda não oferece interface de resolução).

## Preparação do Android
1. Abrir o CRM com internet e entrar na conta institucional.
2. Tocar **Ativar modo offline**, criar uma frase secreta diferente da senha da nuvem (mínimo 10 caracteres), guardá-la com segurança.
3. Abrir e sincronizar empresas a consultar em campo. Em Android/Edge, **Adicionar à tela inicial** pode criar apenas um atalho de navegador, não necessariamente um WebAPK.
4. Ativar modo avião e, com o aplicativo aberto, cadastrar uma empresa de TESTE, nota e foto.
5. Fechar/reabrir e desbloquear com a frase local. Verificar os dados pendentes.
6. Reativar internet, entrar novamente na conta do Supabase se solicitado e tocar **Sincronizar agora**. Conferir no notebook.

## Cuidados e limites
- Não apagar dados do site nem limpar cache/armazenamento do navegador com pendências.
- A sincronização ocorre quando o app está aberto; Android pode não executar tarefas fechadas em segundo plano.
- A cota local depende do aparelho; solicitar persistência não garante que o navegador nunca remova dados.
- Fotos já existentes na nuvem não são baixadas automaticamente para o uso offline; novas fotos capturadas offline ficam criptografadas até confirmação de envio.
- Mudanças conflitantes ficam pendentes para resolução manual; **não use para atualização simultânea da mesma empresa em dois aparelhos antes de homologar**.
- Para continuar a consulta após fechar o navegador sem internet, é obrigatório desbloquear com a frase local. Para sincronizar, exige sessão de nuvem válida.
- Existe um risco residual de falha entre gravar foto e gravar metadados locais em caso de encerramento brusco. Testar desligamento forçado antes de liberar uso real.
- Fotos e informações reais exigem controle de acesso ao dispositivo, cuidados LGPD e autorizações de publicação.

## Homologação obrigatória antes de merge
- Node `--check` do JS, validação do manifesto e HTML.
- Desktop + Android Edge: cadastro offline, foto, retorno, fechamento/reabertura, reconexão, reenvio idempotente e download.
- Falha de upload após receber arquivo e antes do registro: confirmar retry sem duplicar.
- Conflito remoto: confirmar que o local não sobrescreve o remoto, sem perda do rascunho.
- Logout/alternância de usuário: nunca mostrar cache de outro usuário.
- Teste de RLS, Storage privado e sessão expirada.
- Observar o limite de armazenamento e a disponibilidade após um reboot Android.

**Gate:** RC técnico não homologado. Não realizar merge nem publicação de produção antes dos testes.