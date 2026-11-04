# OT Comercial V1.5 — Gate A | Integração Premium + Base Offline

**Status:** branch de integração; NÃO publicada; ainda NÃO homologada para cadastros offline.

## Origens preservadas
- main: V1.2 publicada e conectada ao Supabase.
- feat/v1-4-vitrine-premium: visual premium, apresentação, PNG e WhatsApp.
- feat/v1-3-offline-first: protótipo de cache e IndexedDB sem uso real.

## Já integrado
- Mantida a lógica original de cadastros, visitas e fotos do CRM V1.2.
- Mantidos os módulos premium da V1.4.
- Manifest PWA e ícone SVG com os bytes WebP da arte oficial da OT.
- Service Worker para cache somente dos recursos públicos da interface e apresentações; nunca dados do Supabase.
- Aviso explícito de modo sem internet, sem prometer salvamento offline.
- Cofre IndexedDB criptografado com AES-GCM/PBKDF2 carregado, mas ainda SEM ligação aos formulários. O módulo legado sem criptografia foi retirado.
- Testes automáticos de escopo e isolamento do Service Worker.
- Nenhuma alteração no banco, RLS, Storage, produção ou serviços pagos.

## Bloqueios antes de utilizar sem sinal
1. Cofre local criptografado, segregado por usuário e protegido por desbloqueio (código desenvolvido, validação em andamento).
2. Autorização de acesso offline após primeiro login online.
3. Cadastro, visita e foto com persistência local confirmada antes da mensagem de sucesso.
4. IDs estáveis e sincronização idempotente após retorno de conexão, com contador de pendências.
5. Tratamento de conflitos notebook/celular e perda de conexão após upload parcial.
6. Proteção de pendências contra logout, limpeza de armazenamento e lotação do aparelho.
7. Teste físico completo em modo avião: câmera, fechar app, reabrir, reconectar e verificar no notebook.
8. Verificação Edge Android / Safari iOS / Edge Windows, com Web Share de imagem real.

## Regras do gate
Não cadastrar dados reais no modo offline desta branch: interface em cache NÃO é sinônimo de salvamento.
navigator.onLine não comprova acesso ao Supabase; mostrar confirmação da nuvem somente após resposta positiva.
Cache pode ser apagado pelo usuário/navegador. Nenhum dado pessoal deve ser gravado em texto puro.
Somente main publica GitHub Pages; PR permanece em draft até homologação e autorização expressa.

## Próximo gate B
Implementar cofre local criptografado e fila com IDs estáveis, executar testes com dados fictícios, só depois integrar aos formulários.

## Atualização Gate B — cripto local
- Novo módulo offline-vault.js: senha local derivada via PBKDF2 (310.000 iterações SHA-256), AES-GCM com IV aleatório e AAD por registro, cripto de imagem e operações em transações IndexedDB.
- Chaves e senha não são gravadas em disco; desbloqueio exige senha de pelo menos 12 caracteres.
- O módulo não é integrado aos formulários do CRM nem cria sessões offline por conta própria.
- Antes de abrir para clientes reais: homologar UI, persistência com navegador fechado, política de recuperação, upload idempotente e segurança do dispositivo.


## Gate C — Fluxo de campo implementado em branch (04/11/2026)
- CRM: nova empresa, visita e fotografia passam primeiro pelo cofre AES-GCM quando desbloqueado; a interface informa **Salvo no aparelho** até receber confirmação remota.
- Novo desbloqueio local ao abrir sem internet; usuário deve preparar o cofre numa sessão autenticada online e guardar uma senha local própria.
- Fichas e históricos consultados online ficam em snapshot criptografado, sem criar operações de reenvio; pendências locais não são sobrescritas pelo snapshot.
- Fila: contador, botão Sincronizar agora, retomada ao receber evento online quando há sessão válida; sem sessão, solicita autenticação da MESMA conta antes de enviar.
- Envio de empresa, visita, fotos com IDs UUID fixos, ordem de dependência, releitura de confirmação e proteção contra duplicidade após timeout.
- Fotografias: caminho de Storage determinístico por proprietário/empresa/foto, verificação por SHA-256 quando o arquivo existe, depois inserção de metadados.
- Conflitos detectados por campos relevantes: o registro local não é descartado se divergir da nuvem.
- Exclusões de registros pendentes bloqueadas; alterações offline de empresas existentes bloqueadas até implementar conciliação específica.
- Nenhum dado real de cliente foi usado nos testes. Nenhuma alteração foi aplicada ao Supabase de produção.

### Evidências parciais
- Testes de idempotência: inserção depois de timeout, visita com retorno parcial, upload parcial, conflito e ordem de dependências.
- WebCrypto e IndexedDB real em Chromium/localhost: criação, saída do Chrome, reabertura, senha incorreta rejeitada, fotos e fila recuperadas.
- Testes de interface estática, preservação do Premium e renderização dos cards no Chrome.

### Gate de produção ainda BLOQUEADO
- Testar no Edge Android real, Safari iOS e Edge Windows, especialmente câmera e armazenamento após fechar o aplicativo.
- Conferir cadastros/sincronização end-to-end em ambiente de teste isolado do Supabase antes de usar dados reais.
- Exercitar falha de rede enquanto o aparelho indica online, falhas de quota e recuperação/backup de dados pendentes.
- Validar conflitos de atualizações existentes, multiabas, logout e senhas esquecidas.
- Confirmar política de armazenamento local/LGPD e limite de 12 fotos/empresa.
- Aprovação expressa antes de merge/publicação; a V1.2 permanece a única versão de produção.
