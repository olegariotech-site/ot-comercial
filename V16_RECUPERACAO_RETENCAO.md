# V1.6 — recuperação e retenção operacional

## Recuperação implementada e testada

Exportar em **Pronto para sair → Exportar cofre cifrado**, com cofre desbloqueado. O arquivo contém registros, operações pendentes e blobs cifrados AES-GCM, salt e verificador. Não contém senha/chave nem fichas em claro; metadados técnicos como owner/IDs/contagem não são anonimizados.

Guardar arquivo e senha original em locais seguros e separados. O arquivo tem limite de 128 MB; se exceder, interromper transferência, preservar o aparelho e sincronizar o que puder com confirmação. Nunca limpar dados para caber no backup.

Para perda/troca do aparelho: entrar **na mesma conta** em ambiente autorizado, criar/desbloquear cofre local no destino (senha pode ser diferente), selecionar arquivo e fornecer a senha usada **no backup original**. O importador autentica e decripta com chave original e recifra com chave local atual. Insere em uma única transação, sem sobrescrever conteúdo divergente e sem duplicar fila em repetição idêntica.

Se houver conflito: nenhum registro do lote é sobrescrito. Preservar o destino e restaurar num cofre novo/vazio de recuperação da mesma conta; comparar versões antes de sincronizar. Não automatizar preferência pela última escrita. Conta diferente, senha incorreta, ciphertext adulterado, vínculo inválido ou formato/tamanho inválido de foto são rejeitados.

Prova automática: IndexedDB/WebCrypto real em Chromium, novo cofre/salt, fila e fotos recuperados e novo desbloqueio; simulador testa ainda adulteração, conflito, repetição idempotente e owner incorreto. **Ensaio físico de aparelho perdido/novo e aceite da rotina continuam pendentes.**

Estado de cobertura/last sync não é levado como verdade para outro aparelho: após restauração, consultar e confirmar novamente a nuvem. CSV não substitui o backup cifrado. Sem arquivo/senha ou confirmação cloud, limpeza do navegador/perda do aparelho pode ser irrecuperável.

## Retenção e exclusão

Eventos comerciais preservam diagnóstico/desfechos por versões imutáveis. Atualizar estágio/concluir contato não apaga histórico. O cliente não tem DELETE direto de eventos; exclusão deliberada da empresa segue o fluxo autenticado existente e seus eventos associados são removidos por FK cascade. Pendências relacionadas bloqueiam descarte local indiscriminado; fotos devem ser tratadas pelo fluxo de exclusão para evitar órfãos.

Um aparelho offline não recebe revogação/exclusão remota. Após reconectar/autenticar/desbloquear e consultar uma lista remota completa, a reconciliação descarta cópias limpas removidas da nuvem; a fila não é descartada. Se a empresa tiver sido excluída enquanto outro aparelho tinha pendências, manter a empresa/filas visíveis para conferência e recuperação, sem recriar empresa remotamente de forma automática.

Backups exportados, CSV e Downloads não são eliminados pelo CRM. Inventariar aparelhos autorizados e cópias; registrar onde ficam, quem acessa e como descartar. O prazo operacional de guarda/revisão e a rotina de descarte devem ser aprovados pela direção antes de dados reais. Nenhum prazo legal ou margem de rentabilidade é presumido pelo software.

## Rotina proposta antes de lançamento

1. Preparar aparelho e verificar cobertura, fila e material; não assumir que material de outro dispositivo já está local.
2. Encerrar o dia conferindo fila zero por confirmação remota e leitura das últimas operações/fotos em outro aparelho autorizado.
3. Exportar backup cifrado antes de atualização relevante e enquanto houver pendências que ainda não chegaram à nuvem; conferir restauração com fixtures antes de confiar na rotina.
4. Revisar acesso/cópias/retornos e consumo Free periodicamente. Interromper ao detectar perda, duplicação, conflito sem resolução ou aumento de consumo não compreendido.
5. Registrar aceite dos limites de recuperação e retenção. Não lançar com dados reais antes de Auth/RLS HTTP e homologação física.
