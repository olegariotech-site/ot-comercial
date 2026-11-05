# ASTRA — OT COMERCIAL V1.4 | PREMIUM SALES HUB

**Empresa:** OLEGARIO TECH | Soluções Digitais para Negócios
**Repositório:** `olegariotech-site/ot-comercial`
**Branch de trabalho:** `feat/v1-4-vitrine-premium`
**Base:** `main` V1.2; comparar HEAD real antes de qualquer alteração
**Branch paralela:** `feat/v1-3-offline-first` — NÃO misturar até reconciliação de escopo
**Status:** rascunho para auditoria e homologação. **SEM MERGE, SEM DEPLOY ATÉ APROVAÇÃO.**

## Objetivo comercial
Transformar o CRM de cadastro em ferramenta consultiva para mostrar a OT a comerciantes e compartilhar materiais pelo celular. Foco: empresas pequenas, alimentação e serviços locais; expansão por bairro e cidade. A vitrine serve para educar, não prometer resultados garantidos.

## Entregue no rascunho
1. `apresentacao-ot.html`: vitrine pública de 8 soluções, cards responsivos, filtros por segmento, 3 kits e 6 FAQs consultivas.
2. `solucoes/*.html`: 8 páginas públicas individuais, metadados Open Graph por solução (preview textual no WhatsApp) e CTAs.
3. `apresentacao-servico.css`: estilo consistente de páginas individuais.
4. `index.html`: botão de acesso **Apresentar Soluções OT**, visível somente depois do login no CRM.
5. `style.css`: refinamento incremental de contraste, profundidade e botões da interface privada.
6. `.github/workflows/deploy-pages.yml`: preparo do artefato para incorporar a vitrine pública após aprovação.

## Conteúdo dos 8 cards (fonte oficial)
Landing Page; Site Profissional; Cardápio Digital; Google e SEO Local; Catálogo Digital; Identidade de Marca; Gestão de Redes; Diagnóstico Digital.
O conteúdo aprovado está codificado no array estático `SERVICES` dentro de `apresentacao-ot.html` e replicado em páginas públicas individuais.
Formato: o que é, por que serve, o que resolve, entregáveis, benefício, investimento orientativo ou sob orçamento e case real pertinente.
**Não criar avaliações, números de resultados, rankings ou depoimentos fictícios.**

## Perguntas comerciais
- Já tenho Instagram: por que um site?
- Meu cliente só usa WhatsApp.
- Sou pequeno: vale a pena?
- Aparecer no Google é garantido?
- Cardápio substitui delivery?
- Mensalidade é obrigatória?
Respostas devem ser humanas, consultivas, sem depreciar Instagram, Facebook, WhatsApp ou apps de delivery.

## Segurança e privacidade
- **NUNCA** publicar contatos, briefings, fotos do CRM ou dados pessoais no material compartilhável.
- Páginas de apresentação são **públicas** e não exigem Supabase Auth; continuam **separadas** do CRM protegido por RLS.
- Link compartilhado deve apontar para `/ot-comercial/solucoes/<slug>.html`, nunca para área interna nem com identificadores de clientes.
- A Web Share API exige HTTPS e interação do usuário; manter fallback **Copiar link** e **WhatsApp**. Não afirmar que envio foi concluído antes da confirmação.
- O recurso atual compartilha **link da apresentação** e texto. **Imagem/PNG/PDF exportável ainda não foi implementado.**
- `og:title` e `og:description` variam por serviço; arte de preview `og:image` fica pendente de usar a marca oficial, sem reinterpretar o logotipo.
- No site público: botões para pedir diagnóstico e ver cases reais; sem expor acesso administrativo.
- Todos os preços são referências comerciais condicionadas a escopo, limite de itens, fotos e contratos. Mensalidades só se contratadas.

## Visual premium e comportamento
- Direção: grafite/navy, azul elétrico, violeta, tipografia hierárquica, bordas discretas, profundidade suave.
- Evitar novo redesign do CRM operacional; preservar formulários, nomes de campos, cadastros existentes e caminho dos arquivos.
- Desktop/Android/iOS: áreas de toque amplas, contraste, leitura confortável, comportamento responsivo, `prefers-reduced-motion`.
- **Logotipo oficial:** utilizar somente o arquivo original quando disponível; não criar símbolo inventado no CSS.
- Testar 320, 360, 390, 768, 1280 e 1440px; navegação por teclado; leitores de tela nos componentes relevantes.

## Gate de qualidade antes de merge
- [ ] Teste automatizado de parsing do JavaScript (vitrine e oito páginas).
- [ ] Validação estrutural dos arquivos e ausência de segredos.
- [ ] Verificação de links/cases, variantes de preço e mensagem comercial.
- [ ] Web Share e WhatsApp em Android e iOS; copiar link no Edge Windows.
- [ ] Conferir previews no WhatsApp; **sem `og:image` não prometer miniatura visual**.
- [ ] Login no CRM ainda exige autenticação; apresentação pública não expõe RLS nem dados.
- [ ] Cadastros existentes no Supabase intactos; criar/editar empresa, visitas e fotos na V1.2.
- [ ] Medir desempenho inicial e evitar dependências externas desnecessárias.
- [ ] Conferir pipeline de Pages na branch sem publicar para usuários.
- [ ] Preparar plano de reconciliação de `feat/v1-3-offline-first` e `feat/v1-4-vitrine-premium` antes de qualquer merge.
- [ ] Não fazer merge nem deploy até aprovação visual e funcional de Alexandre.

## Próxima evolução (fora do escopo)
- Diagnóstico com checklist e sugestões na ficha privada.
- Montagem de kit personalizado sem vazar dados no URL.
- Exportação de PNG/PDF do card e miniaturas sociais usando arte oficial.
- Indicadores de uso e link tracking respeitando privacidade e consentimento.
- PWA/IndexedDB/Sync robusto já iniciado na V1.3; garantir que Service Worker não armazene responses privadas.

**Decisão do gate:** documentação e código de rascunho aprovados para avaliação; nenhuma modificação em banco ou publicação nesta etapa.


## Atualização do gate — gerador de imagem, logo oficial e QA (04/11/2026)
- `card-export.js`: gera card PNG 1080×1920 em Canvas, permite download e tentativa de compartilhamento nativo de arquivo, com fallback de download. Não usa dados privados do CRM.
- `ot-logo.js`: contém, em Data URL WebP, cópia exata do símbolo oficial `assets/img/brand/olegario-tech-logo-oficial.webp` do repositório do site OT, SHA de origem `679f87403eb8cdaa16b8ae0364e61551093a7727`. A imagem não foi reinterpretada.
- Logo utilizado no cabeçalho do CRM e da vitrine e em 8 páginas individuais, assim como nas imagens PNG exportadas.
- Cada página de serviço também tem ação para baixar ou compartilhar PNG, além do link/WhatsApp.
- Testes estáticos: **25 de 25 verificações aprovadas** (scripts, segurança básica por inspeção, caminhos, OG text, preservação da lógica operacional e empacotamento).
- Teste isolado em Chromium local do gerador, sem logo na versão anterior: 1080×1920, PNG gerado, download funcionou; simulação do `navigator.share({files})` e seu fallback funcionaram. É teste do código de exportação, **não** homologação Android/iOS nem prova de renderização do logo incorporado posteriormente.

### Pendências obrigatórias
- Repetir teste visual do gerador com logo oficial e capturas da versão atual.
- Testar Web Share File real em Android e Safari iOS; a permissão e o gesto do usuário podem limitar o compartilhamento após geração assíncrona.
- Revisar tipografia, quebra de linha e enquadramento de 8 cards, texto em 320/360px e navegação em Safari.
- Criar `og:image` JPG/PNG com o logotipo oficial para prévias grandes (a versão atual contém título/descrição OG apenas).
- Verificar materiais de divulgação com o responsável pela empresa antes de publicar imagens/cases.
- O modo offline V1.3 continua separado; combinar Service Worker e cache público da apresentação somente após aprovação do Gate D.

## Ajuste visual aprovado — Premium Clean, redução de pontos do card
- Em `card-export.js`, substituir a grade integral de pontos (~336) por 23 partículas pequenas e discretas: 20 nas laterais e 3 no alto, à direita.
- Opacidade reduzida: `rgba(130,204,255,0.085)` e `0.055`, raio 1,15/1,05 px.
- Manter área central livre de textura, priorizar a leitura de títulos e benefícios.
- Preservar degradês, paleta, CTA, dimensões 1080×1920 e uso da arte oficial do logotipo.
- Conferir no Android/Windows o enquadramento final; não alterar fontes, conteúdo, estrutura nem propriedades do compartilhamento.
