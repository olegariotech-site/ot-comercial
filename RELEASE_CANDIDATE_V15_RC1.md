# OT Comercial V1.5 — Release Candidate RC1

Data: 05/11/2026. Missão: [Issue #8](https://github.com/olegariotech-site/ot-comercial/issues/8). Entrega: [PR #5](https://github.com/olegariotech-site/ot-comercial/pull/5), mantido em draft.

**Decisão: NO-GO para piloto com dados reais e para produção. GO somente para continuar homologação com dados fictícios.** O início pretendido em 09/11 depende dos gates abaixo e de autorização expressa posterior da direção OT. Uma RC documentada não constitui aprovação de lançamento.

## Escopo e rastreabilidade

- Base auditada: `f89a9bc858558c767acb65865802bcdd15a038bc`.
- Correção inicial: [`67a4716545975a308f1a7794a032c8c388f6efb7`](https://github.com/olegariotech-site/ot-comercial/commit/67a4716545975a308f1a7794a032c8c388f6efb7).
- Código e este relatório na branch `feat/v1-5-integracao-premium-offline`. Refinamentos posteriores constam no histórico e no comentário final do PR.
- `main`, configuração de produção e Supabase produtivo não foram alterados. Nenhum merge, deploy, contratação, mudança de senha ou migração de schema/policies executados.
- QA utilizado: `efscgxwvaixwqhffwdqu`. Apenas inspeções e teste SQL transacional com fixtures sintéticas e **ROLLBACK**. Dados originais conferidos antes/depois: **1 empresa, 2 visitas, 3 fotos, 3 objetos, 0 órfãos**. Sem divergência de bytes ou de associação de paths.
- Interface, vitrine, apresentações, formulários, CSV, identidade visual e arquitetura existentes preservados. Nenhuma dependência de aplicação adicionada.
- O build RC gera cache QA **`v1-5-staging-v7-rc1`**, mantendo IndexedDB `ot-comercial-QA-encrypted-vault-v15`, versão 1, e as chaves QA de sessão/owner existentes. Este pacote **não foi publicado**; o staging público anterior continua v6. Não testar a RC supondo que esse URL já recebeu estes commits.

## Diagnóstico e correções

| Achado demonstrado | Mudança | Evidência/limite |
| --- | --- | --- |
| `cachePhoto` considerava a existência das linhas suficiente; um ciphertext inválido não era reparado | Ler e decifrar antes de confirmar; reparar somente cópia limpa; gravação metadata/blob na mesma transação | Cofre WebCrypto testa adulteração, rejeição e reparo; IndexedDB real testa abort por quota |
| Cópias locais continuavam presentes após exclusão remota | Reconciliação apenas após lista remota completa e autenticada; preservar qualquer operação pendente; remover cópias limpas e blobs de registros excluídos | Testes verificam que exclusão limpa não reaparece, enquanto foto/visita pendente permanece |
| Uma consulta pode ser truncada pelo servidor | Paginar com `count=exact`/`Content-Range`, avanço pelo tamanho efetivo da página e ordem estável por ID; rejeitar contagem variável, página repetida, resposta sem total, lote acima de 5.000 e páginas incompletas antes de reconciliar | Teste de limite menor no servidor e falha de segunda página; nenhuma limpeza autorizada por consulta parcial |
| Metadados podiam apontar a outra empresa, owner, extensão ou path inválido | Validar UUID, owner opcional retornado por RLS, empresa, path exato de três segmentos, extensão, MIME e bytes; conferência de quota antes do download e antes da cifragem | Quota insuficiente não transfere foto no preparo; falhas não geram sucesso N/M |
| Upload online legado usava UUID do path diferente do UUID gerado pelo banco | Novos uploads online enviam ID explícito igual ao nome do objeto; leitor aceita path legado com UUID próprio, sob mesmo owner/empresa, sem reescrever arquivos antigos | QA atual tinha 0 divergências ID/path; isto é correção preventiva demonstrada pelo fluxo de código, **não** causa atribuída à terceira foto do Android |
| Um erro de resposta de metadados podia provocar exclusão do objeto embora o POST tivesse sido confirmado no servidor | Removida a exclusão compensatória automática de um objeto com estado remoto incerto | Mantém arquivo existente; risco de objeto órfão caso metadado realmente falhe exige reconciliação administrativa, sem exclusão automática |
| Metadados remotos já existentes permitiam reconhecer foto sem verificar o arquivo | Verificar SHA-256 e tamanho também ao retomar operação com metadados existentes, sem reenviar/overwrite | Ausência/divergência do objeto conserva a pendência |
| Duas chamadas podiam renovar a mesma sessão simultaneamente | Renovação compartilhada por Promise; resposta de sessão anterior não pode substituir login/logout atual | Teste paralelo e troca de sessão em voo |
| Uma leitura assíncrona podia terminar depois de bloquear/trocar cofre | Revalidar referência do cofre antes de devolver dados; verificar owner antes de reconhecer sincronização | Teste lock durante leitura e troca de conta durante GET; fila preservada |
| Sincronização era protegida só na aba atual | Web Locks por projeto/owner para sincronização; escritas do cofre serializadas por namespace/owner; toques repetidos no preparo bloqueados | Trava exige navegador compatível; stress de duas abas com rede real continua pendente |
| Troca de empresa durante resposta/lote podia renderizar galeria anterior ou vincular a próxima foto à nova ficha | Capturar owner/empresa/consentimento no início do lote, interromper lote após troca e ignorar respostas obsoletas por revisão da consulta | Dois testes falharam antes da correção e passaram depois; associação preservada |
| Mensagens de erro poderiam reproduzir paths/URLs/chaves retornados por serviço | Redação de credenciais, JWT, URL e UUID/path antes da apresentação, tamanho limitado | Teste de sanitização; nenhum segredo inserido em código/relatório |

O preparo informa quantidade efetivamente relida do cofre, valida a associação da foto e só baixa ausentes/inválidas. Não usa `stagePhoto`, não cria pendências nem modifica a nuvem. Repetir o preparo com cópias válidas não transfere as imagens de novo. Galerias de **1, 3 e 12** fotos estão cobertas por testes de lógica/cofre; o cenário completo do navegador usa 3 imagens PNG sintéticas decodificáveis e downloads conferidos byte a byte.

### Intermitência de reconexão

O [job histórico que falhou](https://github.com/olegariotech-site/ot-comercial/actions/runs/42063088963/job/127369965942) recuperou cofre/carteira/fila e depois expirou em `reautenticação ou sync`. O ensaio aguardava apenas `navigator.onLine` e imediatamente chamava `.click()` em Sincronizar. `updateFieldState()` depende de duas leituras assíncronas do IndexedDB: a rede pode já estar disponível enquanto o botão continua desabilitado; `.click()` nesse estado não dispara ação.

A corrida foi reproduzida deterministicamente com uma leitura pendente controlada, executando a função real da aplicação. O E2E agora aguarda botão habilitado, login exibido ou fila confirmada em zero. Não houve aumento de timeout nem retry que esconda falha. Três execuções consecutivas passaram no [run 42067571818](https://github.com/olegariotech-site/ot-comercial/actions/runs/42067571818). Novas falhas guardam screenshot e diagnóstico do botão, rede, pendências e mensagem.

**Limite causal:** os logs históricos não registravam o estado do botão. O mecanismo reproduzido explica o timeout, mas não prova que toda falha histórica ou futura de rede tenha a mesma causa. O refresh concorrente é um defeito separado corrigido com reprodução própria. Reconexão física com sinal instável ainda requer aceite.

## Segurança e dados

### RLS / isolamento de QA

Foram lidos os predicados completos das 12 policies das tabelas e das 3 policies de `storage.objects`:

- SELECT/DELETE das tabelas: `owner_id = auth.uid()`, role `authenticated`.
- INSERT: `WITH CHECK` de owner. UPDATE: `USING` e `WITH CHECK` de owner.
- Visitas/fotos: FK composta `(empresa_id, owner_id)` para empresa, impedindo vínculo a empresa alheia.
- Storage SELECT/DELETE: bucket privado e primeiro segmento igual ao uid. INSERT exige prefixo próprio e empresa correspondente. Sem policy UPDATE; app não usa upsert/overwrite.
- Bucket privado, 6.291.456 bytes; JPEG/PNG/WebP. Sem views públicas ou funções `SECURITY DEFINER` públicas no QA inspecionado.
- HTTP anônimo real: **401 nas três tabelas**; teste de rota privada sem autenticação rejeitado. Não confundir rota inexistente do teste com prova de isolamento de um objeto existente.
- [qa-rls-rc-rollback.sql](tests/staging/qa-rls-rc-rollback.sql), efetivamente executado no QA: contextos JWT A/B simulados, SELECT/UPDATE/DELETE entre titulares negados, INSERT com owner forjado negado, mudança de owner negada por WITH CHECK, FK entre contas negada, anon negado; Storage SELECT permitido a A e negado a B. Fixtures revertidas e contagens originais verificadas.
- **PENDENTE:** Auth e JWT reais por HTTP usando as duas contas QA existentes; Storage INSERT/DELETE negativos cross-user por HTTP, 401/refresh real e limpeza confirmada de fixtures HTTP. Não havia credenciais dessas contas disponíveis nesta execução. Não foram criadas contas, enviadas mensagens de login ou alteradas senhas.
- O script existente `tests/staging/qa-live-api.mjs` é ponto de partida para o gate HTTP, mas seus testes negativos atuais não cobrem toda a matriz INSERT/UPDATE/DELETE; ampliar/registrar o restante antes de sinalizar PASS. Utilizar variáveis de ambiente protegidas, nunca credenciais em issue/PR.
- Advisor de QA: aviso **Leaked Password Protection Disabled**. Não foi habilitado nem contratado recurso. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Confirmar disponibilidade sem custo antes de qualquer decisão; este relatório não recomenda upgrade pago.

### Criptografia, autenticação e privacidade

- AES-GCM 256, IV aleatório de 12 bytes por cifragem, AAD com owner/tipo/ID; salt de 16 bytes; PBKDF2 SHA-256, 310.000 iterações. CryptoKey não extraível; senha e chave do cofre não são persistidas. `lock` descarta a referência da chave, sem promessa de zerar memória do runtime.
- Registros, fila e bytes de fotos cifrados em IndexedDB; owner, UUID, tipo, datas operacionais e contadores permanecem metadados de índice em claro. Criptografia local não é anonimização.
- Sessão cloud fica em **sessionStorage**, além da memória; não é uma senha/chave de cofre. É acessível a JavaScript da mesma origem. `Sair` bloqueia o cofre e remove sessão local; não há revogação global de todos os tokens no servidor. Autorização dos dados depende do servidor/RLS.
- QA/prod possuem namespaces separados, inclusive cache e storage markers. **Isto evita colisões acidentais, mas não é isolamento de segurança entre aplicações maliciosas na mesma origem `github.io`**: um XSS em outra aplicação da mesma origem é risco residual. Cofre bloqueado continua cifrado, mas um script comprometido pode alcançar dados de uma sessão desbloqueada.
- HTML de dados usa escape/textContent; nomes de arquivo tratados; CSV neutraliza fórmulas; consentimento de publicação inicia desmarcado e não é presumido. Não foi feita auditoria de penetração completa nem declarada ausência universal de XSS. Cabeçalhos CSP/isolamento por origem permanecem revisão de lançamento.
- SW intercepta apenas shell público permitido, na própria origem/escopo; não grava respostas Auth, REST, Storage ou imagens privadas no Cache Storage. Atualização muda só cache público, não nomes/versão do cofre.
- Exclusão remota só pode ser observada por um aparelho quando ele voltar a consultar a nuvem com o cofre aberto. Um dispositivo permanentemente offline conserva cópias cifradas. Não há revogação remota de uma chave offline já existente.
- **Retenção operacional pendente:** definir prazo de guarda, procedimento de exclusão em todos os aparelhos, controle de CSV/fotos baixadas e evidência de descarte. Cópias exportadas, backups de aparelho e arquivos em Downloads não são eliminados pelo CRM.

### Integridade, redundância e custo

IDs fixos e paths determinísticos impedem duplicação de inserts/uploads em retries; retorno HTTP e releitura precisam confirmar antes de retirar operação da fila. Falha de HTTP, quota, hash, sessão ou conflito mantém a pendência. Cópias limpas removidas na reconciliação são dados já ausentes da lista completa remota, não pendências em espera. Reconciliação não tenta reenviar registros apagados.

IndexedDB não é backup. `navigator.storage.persist()` pode ser negado; cota estimada pode variar e falha real ainda é tratada pela transação. Limpar dados do navegador, reinstalar PWA, perder aparelho ou esquecer senha pode perder pendências não sincronizadas. **Não existe exportação/importação portátil de backup cifrado das pendências nesta versão.** CSV não cobre fila, histórico completo ou fotos.

Sem infraestrutura nova ou dependência paga. Foram usados workflows existentes e plano QA já provisionado; não foi aprovada contratação. Não se promete tráfego ilimitado: preparo evita downloads repetidos, mas upload SHA-256 exige leitura de confirmação. Observar consumo real de Storage/egress no Free e interromper antes de ultrapassar limites; não habilitar auto-upgrade.

## Matriz de gates

| Gate | Estado | Evidência e alcance |
| --- | --- | --- |
| Premium / integração / sync / photo-storage / history / prepare-gallery | PASS local | **53 testes** no snapshot que acompanha este relatório; CI final no comentário do PR |
| WebCrypto/cofre | PASS local e CI inicial | Cifragem real, senha errada, adulteração, quota, 12 fotos, pendências preservadas |
| IndexedDB real / reabertura / atomicidade de falha | PASS CI inicial | Chromium Linux, dois processos e abort de gravação de blob por quota |
| E2E offline completo e reconexão | PASS CI inicial, 3/3 execuções | Empresa/visita/foto, fechar/reabrir, login/sync sem duplicar, 3 imagens reais, 3 downloads exatos, 0 HTTP offline, 0 pendências |
| Capturas da vitrine e 8 cards | PASS CI inicial | Renderização em Chromium; interface preservada |
| staging-preview e verify-preview-isolation | PASS local e CI inicial | Pacote isolado **não publicado** |
| RLS catálogo e contextos SQL A/B | PASS no QA | Policies completas + fixtures com rollback; não é JWT real |
| HTTP anônimo real | PASS | Negado nas três tabelas QA; rota privada sem autenticação rejeitada |
| Auth/JWT e Storage cross-user por HTTP real | **PENDENTE / bloqueador** | Duas contas existentes, credenciais não disponíveis nesta sessão |
| Windows Edge/Chrome físicos na RC | **PENDENTE** | Evidências históricas Windows são parciais e anteriores à RC |
| Android Edge/Chrome físicos: 3/3 após fechar/reabrir offline | **PENDENTE / bloqueador** | Relato anterior comprovou 2 fotos offline e 3 online. Ainda não comprova a RC |
| Safari/iPhone físico e WebKit automatizado | **PENDENTE** | Nenhum desses ensaios foi executado nesta sessão; não alegar homologação iOS |
| Duas abas reais, troca de conta, perda de rede durante sync, atualização de PWA | **PARCIAL** | Proteções e testes de lógica presentes; stress físico/duas abas e upgrade com dados de QA pendentes |
| Câmera, instalação PWA, compartilhamento, teclado/leitor de tela | **PENDENTE físico** | Labels e live regions existem; não há auditoria completa de acessibilidade |
| Recuperação de pendências após perda do aparelho e retenção LGPD | **PENDENTE / risco bloqueador para uso real** | Formalizar recuperação/aceite da limitação, sem representar CSV como backup completo |
| Merge / produção | **BLOQUEADO** | Depende de autorização expressa depois dos gates |

O run inicial é [42067571818](https://github.com/olegariotech-site/ot-comercial/actions/runs/42067571818), no commit `67a4716`. O HEAD com paginação por total exato e refinamentos finais deve ser avaliado pelo **run final vinculado no comentário do PR**; resultados do run anterior não substituem checks do HEAD.

Artefatos desse run: `ot-v15-preview-staging-nao-publicado`, `ot-v15-gate-d-campo` (subpastas 1/2/3, PNG e result.json), `ot-v14-qa-visual`. Retenção atual: 7 dias. Baixar evidências antes de expirar; relatórios, código e scripts são versionados. As imagens são exclusivamente fictícias.

## Checklist físico para a direção OT

Usar **QA, conta de testes e empresa fictícia**, nunca cliente real. Conferir que o pacote instalado corresponde ao commit da RC, cache `v1-5-staging-v7-rc1` e cofre QA existente. Não apagar dados/site/PWA, não renomear o cofre e não desinstalar para atualizar.

1. No Windows, entrar online, desbloquear o cofre e confirmar empresa e visitas. No Android com a mesma conta, repetir; senha local é por dispositivo.
2. Abrir a empresa, tocar **Preparar fotos offline** e guardar evidência do resultado exato **3 de 3 disponíveis offline — confirmado**. A tela online sozinha não aprova o gate.
3. Ativar modo avião; fechar completamente e reabrir navegador/PWA; desbloquear; abrir a empresa. Conferir **as 3 imagens**, baixar cada uma e verificar conteúdo; confirmar **0 pendências**. Registrar aparelho, versão do sistema/browser, commit, hora e resultado.
4. Ainda offline, cadastrar empresa/visita/foto fictícias. Fechar/reabrir, conferir recuperação da fila. Reconectar, aguardar o botão habilitar e autenticar com a mesma conta se solicitado. Sincronizar uma vez; confirmar 0 pendências e contagens remotas sem duplicação.
5. Com duas abas de QA, tocar Sincronizar nas duas: uma deve manter exclusividade, a outra avisar; não pode haver upload ou insert duplicado. Alternar contas durante uma operação e verificar que nenhuma fila da conta A é reconhecida como B.
6. Excluir uma foto fictícia em um aparelho online, consultar a galeria no outro com cofre aberto e só então retornar offline. A foto excluída não deve reaparecer. Aparelho que nunca reconectou ainda não recebeu a exclusão.
7. Repetir 1/3/12 fotos, formatos permitidos, limite 6 MB, HTTP de erro/quota em fixture isolada, câmera, downloads e navegação; verificar botão repetido e perda de rede no meio do envio.
8. Validar instalação e atualização PWA sem perda; botões por toque/teclado, foco, textos anunciados e ausência de cortes nos aparelhos. iOS requer Safari físico; WebKit automatizado seria apenas pré-gate.

## Rollout e reversão — plano, não executado

### Antes de aprovar qualquer publicação

- Fechar Auth/Storage HTTP cross-user, Android/Windows RC e recuperação/retencão. Se iOS continuar pendente, eventual piloto só pode ser restrito aos aparelhos efetivamente homologados e isso precisa ser aceito explicitamente.
- Garantir 0 pendências em cada aparelho por **confirmação remota**, não apenas por label. Exportar CSV e baixar fotos permitidas; essas exportações complementam, mas não substituem backup completo. Guardar manifesto de IDs, contagens e hashes sem publicar conteúdo de clientes no GitHub.
- Registrar commit de aplicação, artefato e versão do SW de referência; preservar cópia do bundle anterior. Validar backup/restauração de dados por método já disponível sem contratar plano e sem migração destrutiva. Se não houver recuperação validada, manter NO-GO.
- Promover o pacote para QA somente após os checks automatizados, mantendo o isolamento, e executar o smoke físico. Eventual merge/publicação produtiva exige gates fechados e autorização expressa específica da direção. Esta execução não promoveu nenhum ambiente.

### Piloto eventual aprovado

Acesso restrito à OT e aos aparelhos aprovados. Começar com poucas visitas; a cada visita conferir ID, associação empresa/visita/foto, pendências, sincronização e leitura em outro aparelho. Conferir quota/egress e erros sem gravar tokens ou conteúdo privado em logs. Interromper ao primeiro registro ausente, duplicação, falha de decriptação, acesso cross-user ou subida inesperada de consumo.

### Rollback

1. Interromper novas entradas e preservar os aparelhos/pendências; não limpar cache de dados, IndexedDB ou credenciais locais para tentar corrigir.
2. Reverter somente o bundle da aplicação/SW para artefato conhecido, com **nova versão de cache de shell** para forçar atualização; manter namespaces, IndexedDB versão 1, owner e salt/chaves existentes. Sem `reset`, `deleteDatabase`, downgrade de schema ou alteração de Supabase.
3. Antes de publicar o rollback, testar com cópia de QA que os registros criados pela RC ainda decifram e a fila permanece íntegra. Se existir fila incerta, manter o aparelho intacto e não forçar downgrade.
4. Conferir IDs/contagens/hashes e efetuar smoke online/offline e outro aparelho. Resolver órfãos apenas por IDs de fixture comprovados e autorização específica; nunca deletar por prefixo amplo/data/status.
5. Registrar o incidente e nova recomendação GO/NO-GO no PR. Rollback de frontend não restaura dados deliberadamente excluídos; recuperar dados depende do backup validado previamente.

## Comandos reproduzíveis

```bash
node --test tests/qa-*.test.mjs
node tests/qa-vault.mjs
node tests/qa-real-idb.mjs
node tests/qa-visual.mjs
OT_E2E_ITERATION=1 node tests/qa-field-http-e2e.mjs
node tests/staging/build-preview.mjs
node tests/staging/verify-preview-isolation.mjs
node tests/staging/qa-anon-http.mjs
```

Chromium não estava instalado no executor local; a tentativa de obtenção retornou arquivo inválido. Usaram-se os runners Chromium existentes do GitHub para os testes reais de browser (plugin Browser indisponível). Isso não simula certificação física de Windows/Android/iOS. A suíte não chama produção; o teste HTTP anônimo tem ref QA fixo. O script SQL de rollback só deve ser executado no ref QA indicado, nunca em produção.
