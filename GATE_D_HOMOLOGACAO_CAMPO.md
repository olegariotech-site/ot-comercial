# OT Comercial V1.5 — Gate D | Homologação de Campo

**Situação:** Gate D no Chromium + Supabase HTTPS simulado aprovado. **Publicação e uso com clientes reais continuam bloqueados.**

## Evidência reproduzível
GitHub Actions: https://github.com/olegariotech-site/ot-comercial/actions/runs/41926119738

- Job `qa-premium`: **success**, testes estruturais, WebCrypto/IndexedDB e renderização visual.
- Job `field-e2e`: **success** executando `node tests/qa-field-http-e2e.mjs`.
- Backend de teste: `tests/mock-supabase-server.mjs` usa HTTPS em localhost com certificado efêmero. Nunca envia chamadas ao Supabase real.
- Autenticação: conta fictícia, credenciais de demonstração embutidas SOMENTE no mock local.
- Simulação: login, preparação do cofre, modo sem rede, nova empresa, visita e imagem PNG, fila de três pendências, encerramento e reabertura do Chrome, desbloqueio, reconexão, login e confirmação remota.
- Verificação: **1 empresa, 1 visita, 1 registro de foto e 1 arquivo**, sem INSERT ou upload duplicado.
- Capturas fictícias disponíveis no artefato `ot-v15-gate-d-campo`. O download de artefatos GitHub tem retenção limitada.

## Ajustes resultantes do teste
1. Servidor HTTPS de teste passou a responder `/` com `index.html` para instalação correta do Service Worker.
2. Clique real no botão foi simulado no teste de formulários para fornecer `SubmitEvent.submitter`.
3. O CRM procura um cofre único no próprio IndexedDB se o marcador de `localStorage` estiver ausente; a senha local segue obrigatória.
4. O contador de pendências é atualizado quando o cofre é reaberto offline (bug detectado e corrigido).

## Critérios de homologação física — só em ambiente isolado
1. Publicar uma prévia **de testes**, sem conectar ou alterar os dados do projeto Supabase de produção.
2. No Edge Android, com a conta de teste, preparar cofre local (senha própria de 12+ caracteres). Confirmar que a tela abre com internet.
3. Ativar modo avião; registrar empresa fictícia `LOJA TESTE OT — SÃO MARCOS`, uma visita e uma foto que não contenha pessoas, documentos ou dados comerciais reais.
4. Confirmar que aparecem `3 pendentes` e que cada item indica `Salvo no aparelho`.
5. Fechar totalmente o navegador; ainda no modo avião, reabrir o PWA e desbloquear com a senha local. Conferir os três itens.
6. Reativar a internet. Entrar na **mesma conta de testes**; usar `Sincronizar agora` se necessário.
7. Conferir no notebook de testes a mesma empresa, visita e foto, sem duplicações; registrar captura da tela sem dados reais.
8. Testar o compartilhamento de um card PNG e de um link no WhatsApp. Repetir em Safari iOS antes de aprovação multiplataforma.
9. Repetir com falha temporária na API, armazenamento local cheio, foto de 6 MB, duas abas e tentativa de login com outra conta.
10. Aprovar procedimento de recuperação de pendências (backup criptografado) e diretrizes LGPD antes de permitir dados reais no modo offline.

## Limitações que permanecem
- O teste em localhost **não valida o Supabase real**, as políticas de Storage nem RLS ponta a ponta.
- A sincronização automática depende do app aberto, internet disponível e autenticação da mesma conta; não é um serviço em segundo plano garantido.
- IndexedDB e cache podem ser apagados pelo sistema ou usuário. Dados pendentes requerem backup e política de recuperação.
- Alterações offline de empresas já existentes continuam bloqueadas para evitar conflitos não reconciliados.
- A produção V1.2 permanece no `main` (commit `f33d3329`); PR #5 segue rascunho, sem merge ou deploy.

**Gate para publicação: bloqueado** até ambiente de homologação isolado, testes Android/iOS e aprovação expressa de Alexandre.
