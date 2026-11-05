# OT Comercial V1.6 — RC2 integrada

05/11/2026 · [Issue #11](https://github.com/olegariotech-site/ot-comercial/issues/11) · [PR #12, draft](https://github.com/olegariotech-site/ot-comercial/pull/12).

**Entrega:** candidata integrada para preparar a homologação física final. **NO-GO para produção/dados reais.** O código comercial está implementado, com suíte automática e artefato QA; a ativação do novo schema em QA e a publicação de um URL V1.6 não foram executadas. O staging RC1 continua intacto. Não usar o URL RC1 para afirmar que testou V1.6.

## Mudanças em relação à RC1

Baseline preservada: `d559580fd2779e77a8374faed53032f341a747d6`. Desenvolvimento apenas em `feat/v1-6-comercial-completa`. PR #5 não recebeu commits, alterações de descrição, merge ou comentários desta missão. `main`/Supabase produção não foram alterados. QA compartilhado só foi consultado: **1 empresa / 2 visitas / 3 fotos / 3 objetos**, sem tabela V1.6 ativada.

| Entrega implementada | Comportamento |
| --- | --- |
| Minha Agenda Comercial | Tela inicial online e após desbloqueio offline. Vencidos/Hoje/Próximos/A definir, BRT explícito; ação, data, empresa, decisor e acesso à ficha/desfecho/reagendamento/WhatsApp válido |
| Planejamento sem tarefas fantasma | Empresa legada sem ação e oportunidade ativa sem próximo passo aparecem como itens de planejamento, separados de ações reais. Data legada não é combinada com nota de outra visita |
| Cadastro rápido | Nome essencial; contato, necessidade e segmento opcionais. Empresa/oportunidade/ação gravadas em lote cifrado atômico; não abre detalhes obrigatoriamente; briefing completo deixou de ser obrigatório também no formulário legado |
| Diagnóstico e apresentação | Três respostas opcionais, presença digital verificada, case pertinente, contato/decisor/papel/horário. `cases.html` público contém apenas portfólio autorizado, sem sessão/API/cofre ou notas privadas |
| Oportunidades | Várias por empresa; diagnóstico/proposta/negociação/ganho/perdido, serviços, necessidade, objeção, histórico de versões. É possível ganhar/perder diretamente sem passar por todas as fases |
| Implantação / recorrência | Proposta e contratação em campos separados e centavos inteiros BRL. MRR só inclui ganho, recorrência explicitamente ativa, valor/data/escopo/entregas/frequência definidos. Sem cálculo fictício de lucro |
| Desfecho e reagendamento | Nova versão preserva histórico. Conclusão exige próxima ação ou encerramento explícito. Reagendamento cancela a versão anterior e cria a ação sucessora; não avança estágio automaticamente |
| Encerramento / pós-venda | Ganho/perda encerra ações abertas de negociação em histórico. Pós-venda somente por solicitação explícita; pode ser ação de empresa sem criar uma nova oportunidade artificial |
| Indicadores / CSV | Ações concluídas, pontualidade, oportunidades por estágio, propostas abertas, ganhos entre propostas, implantação fechada e MRR; indicadores financeiros acessíveis em seção expansível, agenda priorizada. CSV legado preservado e CSV comercial adicional |
| Pronto para sair | Rede, cofre, fila, cobertura/última consulta, last sync, visitas, fotos locais relidas, quota e arquivos do material público realmente presentes no cache. Sites externos sempre identificados como dependentes de internet |
| Recuperação | Exportação cifrada de registros/fila/fotos; importação no mesmo owner, inclusive outro aparelho e nova senha/salt locais. Verifica autenticidade e conflitos antes de transação única; não sobrescreve registro divergente |
| Compatibilidade RC1 | Empresas/status/retorno legados, visitas, fotos privadas, consentimento, showroom, apresentações, busca, edição e exportação preservados |

O app exige cofre desbloqueado para as novas escritas comerciais. Um erro de nuvem mantém os eventos cifrados na fila e informa cobertura não confirmada; não representa gravação local como confirmação cloud. Empresas ausentes da listagem remota mas com pendência comercial continuam acessíveis e não desaparecem.

## Decisão de dados e sincronização

`commercial-core.js` contém regras puras; `commercial-ui.js` integra a interface existente. O novo histórico usa uma tabela **aditiva** `ot_comercial_eventos`, com entidades lógicas distintas (`opportunity` e `action`) e versões append-only. `entity_id` identifica a oportunidade/ação; `id` identifica a versão; `parent_id` liga à versão anterior. Dessa forma, o estado atual é projetado sem sobrescrever desfechos.

- PK e UUID estáveis; uma criação por entidade e um sucessor por parent. Duas edições concorrentes do mesmo parent causam conflito explícito e conservam a fila.
- FK composta empresa/owner; FK de parent também fixa entidade, tipo, empresa e owner. Ação só referencia oportunidade do mesmo titular/empresa, validada por trigger **SECURITY INVOKER**, com RLS normal. Nenhum SECURITY DEFINER ou bypass introduzido.
- RLS SELECT/INSERT por `auth.uid()` e role `authenticated`; sem UPDATE/DELETE direto de eventos pelo cliente. Exclusão deliberada de empresa respeita o fluxo existente e cascade dos seus eventos; não é exclusão indiscriminada de filas.
- CHECKs de estágio/forma/continuidade/valores/recorrência; nenhum orçamento é MRR contratado. Validação de leitura também rejeita eventos inválidos.
- Sync ordena empresa, dependências comerciais e versões; confirmação por GET antes de acknowledge; JSON comparado canonicamente e timestamptz normalizado. Retry de resposta perdida não duplica.
- Novo kind `commercial` e estado de cobertura cifrado nos stores RC1 existentes, **sem upgrade/reset de IndexedDB**. O pacote QA V1.6 usa namespace próprio para não tocar no cofre RC1 publicado.

## Schema, compatibilidade e ativação futura

Migração versionada: [`supabase/migrations/20261105180000_v16_commercial_events.sql`](supabase/migrations/20261105180000_v16_commercial_events.sql). Rollback conservador: [`supabase/rollback_v16.sql`](supabase/rollback_v16.sql).

A migração foi executada/testada num PostgreSQL 16 efêmero do GitHub, com fixtures e roles isolados. Um defeito de policy recursiva foi detectado no primeiro CI e corrigido por validação invoker, sem contornar RLS. **Não foi aplicada ao QA compartilhado nem a produção.**

Plano de compatibilidade para ativação em QA: manter tabelas/policies/dados RC1; exportar backup privado do QA e manifesto de contagens/hashes antes da alteração; aplicar apenas a tabela/indexes/policies/função/trigger novos com destino explicitamente verificado; rodar negativos HTTP com duas contas fictícias; confirmar contagens RC1 inalteradas e validar restauração. O script exige `ot.v16_target='isolated-test'` ou ref QA explícito e não contém migração de dados legados. A verificação do projeto real deve ser feita também pelo operador; a variável SQL não substitui conferir o destino.

A publicação do bundle depende de autorização específica e deve usar um **URL QA V1.6 distinto**, nunca substituir o staging RC1. Se o schema não estiver ativado, eventos comerciais ficam pendentes e a interface informa que a nuvem comercial não foi confirmada; esse estado bloqueia homologação cloud entre aparelhos e uso real.

## Matriz de verificação

O primeiro run completamente verde desta integração é [42082660307](https://github.com/olegariotech-site/ot-comercial/actions/runs/42082660307), commit `eaeaf73`. O comentário final do PR fixa o HEAD, o run final e seus artefatos. Não substituir checks do HEAD por checks de commit anterior.

| Gate | Situação e alcance |
| --- | --- |
| 53 testes RC1 + novos unitários/integrados | PASS local; snapshot final tem **71 testes**. Resultado de CI do HEAD no comentário final |
| Agenda/BRT/duplicidade/sem data/fechamento/MRR | PASS em testes de lógica e fluxo real de interface contra mock |
| Sync comercial/parent/idempotência/conflito/timestamp | PASS em lógica e E2E; falhas mantêm fila |
| Cofre AES-GCM/PBKDF2 / 12 fotos / quota / reparo | PASS local e CI |
| IndexedDB real, fechar/reabrir e restauração cifrada | PASS Chromium Linux em processos reais, incluindo restauração em novo cofre/salt e preservação de fila/fotos |
| PostgreSQL/RLS isolado | PASS: A/B por contexto SQL, anon, FK, imutabilidade, fork, MRR e rollback de fixtures |
| HTTP anônimo QA RC1 | PASS no CI, somente leitura |
| Auth/JWT/Storage cross-user HTTP QA real | **PENDENTE**. `tests/v16/qa-live-cross-user.mjs` foi invocado e retornou PENDENTE (exit 2), sem requisições, por ausência das quatro credenciais protegidas. Não existem contas/senhas novas criadas por esta execução |
| Fluxo V1.6, dois perfis independentes | PASS Chromium Linux HTTPS mock: cadastro/diagnóstico/case/proposta/ganho/recorrência/desfecho/reagendamento/fotos/offline/reabertura/reconexão |
| Fotos de outro dispositivo | PASS mock: 3/3 decodificadas depois de fechar/reabrir offline; três downloads com bytes originais; zero HTTP de API recebido offline; fila final zero |
| RC1 Gate D repetido | PASS nas três execuções consecutivas do job legado |
| Regressão visual | PASS renderização de vitrine/oito cards; capturas novas de agenda/indicadores/cases/fotos. Inspeção mobile motivou ajuste mínimo na quebra de valores monetários |
| Isolamento de preview | PASS: cofre/sessão/marker/cache QA V1.6 separados; nenhum deploy |
| 10 cadastros automatizados cronometrados | PASS integração; tempos iniciais 179–194 ms com preenchimento programático. **Não medem digitação humana** |
| ≥8/10 cadastros físicos em ≤90 s | **PENDENTE**, formulário de medição em `HOMOLOGACAO_V16_FINAL.md` |
| Android/Windows/iOS físicos, câmera, PWA, duas abas | **PENDENTE**. Dois perfis Chromium não são dois aparelhos físicos. iOS/WebKit não executados |
| Retenção e recuperação em aparelhos reais | Automação PASS; rotina operacional proposta, aprovação e ensaio físico **PENDENTES** |
| Merge / produção / custos novos | **Não executados / bloqueados** |

O script de navegador usa viewport móvel 390×844. Nenhuma promessa de aprovação física ou acessibilidade completa; controles têm labels, foco nativo de dialog, botões por toque e live regions, mas leitor de tela/teclado físico e viewports adicionais devem ser conferidos no aceite.

## Evidências e limites

Artefatos CI: pacote QA não publicado, `ot-v16-campo-integrado` com PNG/result.json, Gate D legado e vitrine/oito cards. Retenção de artefatos: 7 dias; código, testes e relatório permanecem versionados. Todos os nomes/imagens de testes são fictícios. O pacote ainda mantém nomes legados de alguns artefatos CI; o manifesto/run/HEAD identifica a V1.6.

Não havia Chromium local disponível; browser tests foram executados nos runners existentes. Plugin Browser indisponível. O E2E de fotos exige rolar à galeria para carregar imagens `loading=lazy`, como na navegação real; não aumentou timeout para mascarar a ausência de decodificação.

Riscos residuais: quota/limpeza de navegador/perda de aparelho antes de backup ou sync, senha esquecida, arquivos externos exportados, scripts da mesma origem alcançando sessão/cofre desbloqueado, exclusão remota só observável após reconectar, concorrência entre aparelhos resultando em conflito que exige conferência humana. Regras de retenção e escopo de recuperação constam em [`V16_RECUPERACAO_RETENCAO.md`](V16_RECUPERACAO_RETENCAO.md). Nenhum bloqueador herdado foi declarado resolvido sem evidência.

O backup limita cada arquivo a 128 MB, exige o mesmo owner e a senha original para autenticar; no destino, recifra com a chave local atual. Não guarda a senha no arquivo. Um conflito aborta a importação sem sobrescrever; recuperar num cofre novo vazio quando o destino já tem versões divergentes. CSV continua sendo exportação parcial, não backup completo.

## Rollout / rollback

1. Antes de homologar cloud: preparar backup privado do QA, aplicar/testar apenas a migração aditiva no destino QA conferido, executar negativos HTTP e autorizar URL V1.6 separado. Não tocar RC1/prod.
2. Executar **uma sessão física consolidada** com os dez cenários do roteiro, anotar tempos reais, aparelho/browser/commit e evidências fictícias. Consolidar defeitos; corrigir na mesma branch e repetir os cenários afetados e a suíte automática completa.
3. Somente depois de gates e aprovação expressa: eventual piloto restrito a aparelhos homologados. Sem iOS físico aprovado, nenhuma homologação universal. Acompanhar fila, duplicação, associação e consumo Free nas primeiras visitas.
4. Se falhar: interromper novas entradas; exportar backup cifrado e preservar aparelhos/fila; reverter **bundle de QA** para versão conhecida com nova versão de cache de shell, sem renomear/limpar IndexedDB.
5. Rollback de schema prefere **revogar INSERT** e preservar eventos; reativação por GRANT após correção. Nunca DROP com dados. Uma RC1 antiga não sabe sincronizar eventos V1.6: não fazer downgrade com fila comercial aberta. Restaurar/validar backup e zerar fila por confirmação remota antes de qualquer downgrade.
6. Conferir IDs/contagens/hashes no rollback e registrar nova decisão no PR. Frontend não recupera uma exclusão deliberada de dados: depende do backup validado antes da alteração.

## Comandos

```bash
node --test tests/qa-*.test.mjs tests/v16/*.test.mjs
node tests/qa-vault.mjs
node tests/qa-real-idb.mjs
node tests/qa-visual.mjs
node tests/qa-field-http-e2e.mjs
node tests/v16/qa-commercial-http-e2e.mjs
node tests/staging/build-preview.mjs
node tests/staging/verify-preview-isolation.mjs
node tests/staging/qa-anon-http.mjs
# Em PostgreSQL EFÊMERO, nunca Supabase compartilhado:
psql -f tests/v16/schema.test.sql
# Só com dois titulares QA e credenciais em ambiente protegido:
node tests/v16/qa-live-cross-user.mjs
```

**Recomendação de entrega:** candidata aceita para preparar homologação; **NO-GO para dados reais/produção**, aguardando ativação QA com backup, Auth/Storage HTTP real, aceite físico cronometrado e recuperação/retencão aprovados.
