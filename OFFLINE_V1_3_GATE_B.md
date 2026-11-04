# OT Comercial V1.3 — Gate B (rascunho)

Branch de desenvolvimento isolada, SEM publicacao e SEM alterar o Supabase.

Entregue: shell de cache limitado aos arquivos publicos, manifesto inicial de PWA e modulo IndexedDB com tabelas locais e fila de operacoes por usuario.

Nao entregue: integracao dos formularios existentes com a fila; sincronizacao real; login offline apos fechar o aplicativo; criptografia dos dados locais; icones de instalacao PWA; testes reais de Android e reconciliacao de conflitos.

NENHUM DADO REAL DE CLIENTE DEVE SER INSERIDO NA PROVA DE CONCEITO.

Gate de homologacao futuro: gravar empresa, briefing, visita e fotos offline, reabrir aplicativo, recuperar dados, reconectar, enviar de modo idempotente, verificar no notebook e impedir duplicados. Verificar a protecao local dos dados, expiracao de sessao, logout, limites de armazenamento e perda da conexao durante upload.

Apenas depois desses testes e autorizacao expressa: considerar merge na main.