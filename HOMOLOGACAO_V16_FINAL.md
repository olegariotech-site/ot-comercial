# OT Comercial V1.6 — sessão física final consolidada

Candidata do PR #12 / Issue #11. **Somente dados fictícios.** Nenhuma aprovação de produção está implícita neste roteiro.

## Pré-requisitos de sessão

- URL QA **V1.6 separado** publicado somente após autorização específica. O staging RC1 atual não recebeu estes commits.
- Schema aditivo V1.6 validado/ativado em QA após backup privado, sem alterar dados/policies RC1. Dois titulares QA disponíveis, Auth/Storage HTTP negativos aprovados.
- Registrar HEAD da candidata, versão do SW `v1-6-staging-rc2`, aparelho/SO/browser, rede e hora de São Paulo. Namespace do cofre QA V1.6 é `ot-comercial-QA-encrypted-vault-v16`, distinto da RC1.
- Backup cifrado antes de qualquer atualização de candidato com dados locais. Não desinstalar PWA, limpar dados ou renomear cofre para corrigir falha.

## Dez cenários fictícios

Em **cada cenário**, cronometrar o cadastro rápido do início do toque em Nova prospecção até a confirmação de salvamento; registrar início/fim/segundos. Objetivo físico: **8 de 10 em ≤90 s**. As demais ações testam o fluxo completo e não entram no cronômetro de cadastro. Os tempos de script/CDP não substituem os tempos desta tabela.

| # | Empresa fictícia / exercício | Cadastro físico (s) | Resultado e evidência |
| --- | --- | --- | --- |
| 1 | Loja QA A: proprietário ausente, contato desconhecido, sem necessidade/data; aparecer A definir, sem tarefa Hoje inventada | PENDENTE | PENDENTE |
| 2 | Lanche QA B: decisor/contato válido, ação para hoje; abrir WhatsApp manualmente, sem envio automático | PENDENTE | PENDENTE |
| 3 | Serviço QA C: ação vencida; registrar desfecho e nova ação futura, histórico intacto e só uma sucessora aberta | PENDENTE | PENDENTE |
| 4 | Comércio QA D: próxima ação sem data; permanece em A definir; reagendar com nova versão, sem duplicar | PENDENTE | PENDENTE |
| 5 | Profissional QA E: responder diagnóstico parcial e registrar presença existente; mostrar case público, voltar à ficha sem dados privados na apresentação | PENDENTE | PENDENTE |
| 6 | Loja QA F: proposta com implantação + mensalidade proposta; MRR deve continuar zero | PENDENTE | PENDENTE |
| 7 | Oficina QA G: ganho direto com implantação e recorrência contratada; registrar escopo/entregas/frequência/data; conferir MRR e encerrar ações de negociação | PENDENTE | PENDENTE |
| 8 | Negócio QA H: perder com motivo e encerrar explícito; nenhum retorno automático; criar pós-venda apenas quando solicitado | PENDENTE | PENDENTE |
| 9 | Alimentação QA I: três fotos de aparelho A; aparelho B consulta/prepara 3/3, modo avião, fechar/reabrir, três imagens e três downloads, zero pendências | PENDENTE | PENDENTE |
| 10 | Empresa QA J: cadastro/ação/foto offline, fechar/reabrir, recuperar fila, reconectar e autenticar mesma conta; confirmar outro aparelho, sem duplicação | PENDENTE | PENDENTE |

Critério adicional: **100% das oportunidades ativas visíveis com ação/data ou A definir**. Ganho/perda não força passagem por proposta/negociação. Uma mesma empresa deve aceitar duas oportunidades de serviços distintos sem sobrescrever a primeira.

## Conferências finais na mesma sessão

- Carteira a um toque; busca, edição, notas, histórico, CSV antigo/comercial, showroom e apresentações anteriores funcionam.
- Conferir cadastro completo sem briefing obrigatório e enriquecer depois.
- Pronto para sair: rede não é prova de autenticação; cobertura/last sync/filas reais; arquivos públicos locais conferidos; sites externos identificados como dependentes de internet.
- Duas abas: uma sincronização por owner/projeto; edições concorrentes geram conflito explícito e fila preservada, sem sobrescrever. Trocar de conta/empresa durante operação não cruza associações.
- PWA: instalar/atualizar/reabrir sem perder fila; nenhuma limpeza/reset. Câmera/toque/downloads, legibilidade de valores BRL, foco/teclado/leitor de tela e navegação.
- Recuperação: exportar backup cifrado, confirmar que não há conteúdo em claro, restaurar em outro cofre/aparelho da mesma conta com nova senha local; conferir fotos/fila; senha errada/adulteração/conflito falham sem sobrescrever.
- Retenção: excluir uma fixture com pendências zeradas, reconectar o outro aparelho e conferir descarte das cópias limpas; guardar/destinar backups/Downloads conforme política aprovada.
- Android Edge/Chrome e Windows Edge/Chrome: registrar os que foram efetivamente usados. Safari/iOS físico: **PENDENTE** até aparelho disponível; WebKit automatizado não certifica iPhone.

## Registro e correção

Para cada falha: cenário, passos, esperado/obtido, screenshot com fixture, aparelho/browser/HEAD e se havia rede/cofre/fila. Não publicar senhas, tokens ou imagens de clientes.

Consolidar a lista de defeitos ao término da sessão. Correções na branch V1.6; suíte automática completa no novo HEAD, regressão física seletiva dos cenários afetados e decisão GO/NO-GO atualizada. PR #5, RC1 publicado e produção permanecem intactos até autorização específica.
