# Plano de Infraestrutura de Formatacao Word e Visual Law

Status geral: em desenho / implementacao incremental

Objetivo: criar uma infraestrutura confiavel para formatar documentos Word com estilos reais do Word, sincronizacao estrutural por partes e componentes Visual Law revisaveis antes da aplicacao.

## Principios

- O Word e a fonte de verdade para estilos aplicados.
- Antes de aplicar qualquer visual, o Wing deve ler e mapear os estilos reais existentes no Word.
- Texto visualmente destacado nao vira titulo automaticamente.
- A IA sugere candidatos; o sistema so aplica mudancas estruturais confirmadas ou baseadas em estilos reais.
- A aplicacao deve ser incremental: sincronizar, classificar, revisar, aplicar e re-sincronizar.
- Estilos reais do Word vem antes de blocos visuais temporarios.
- Visual Law deve melhorar leitura sem alterar sentido juridico.

## Status Dos Milestones

| Milestone | Nome | Status |
| --- | --- | --- |
| M1 | Base de estilos Word | Concluido v1 |
| M2 | Sincronizacao estrutural | Em andamento |
| M3 | Perfis visuais | Em andamento |
| M4 | Componentes Visual Law | Pendente |
| M5 | Tabelas e graficos confiaveis | Em andamento |
| M6 | Aplicacao por partes | Pendente |
| M7 | Revisao e controle | Pendente |

## M1: Base de Estilos Word

Entregavel: motor que edita estilos reais do Word, nao apenas HTML inserido.

Escopo:

- Estilo Normal.
- Paragrafo/corpo.
- Titulo.
- Subtitulo.
- Heading 1, Heading 2, Heading 3.
- Citacao / Quote.
- Tabelas existentes.

Implementacao esperada:

- Sincronizar `Normal`, `Title`, `Subtitle`, `Heading 1/2/3` e `Quote` a partir da galeria de estilos do Word.
- Usar os formatos sincronizados como tema base para componentes Wing/Visual Law.
- Editar `context.document.getStyles()` quando a API permitir.
- Aplicar fallback direto nos paragrafos quando o estilo nao puder ser alterado.
- Separar configuracao de tema de aplicacao no documento.

Criterios de aceite:

- Aplicar fonte, tamanho, cor, espacamento, alinhamento e recuos.
- Nao duplicar conteudo.
- Nao promover texto em maiusculo para titulo automaticamente.
- Manter o documento editavel como Word nativo.

Status:

- [x] Botao inicial para aplicar tema no documento.
- [x] Aplicacao inicial em corpo, headings e tabelas.
- [x] Estilo Title.
- [x] Estilo Subtitle.
- [x] Estilo Quote/citacao.
- [x] Estrutura interna para recuo, entrelinha e espacamento por estilo.
- [x] Sincronizacao dos formatos atuais do Word para o tema interno.
- [x] Sincronizacao prioriza formato renderizado nos paragrafos do documento antes da definicao do estilo.
- [x] Tema interno preserva fonte especifica para Title, Subtitle, Heading 1/2/3 e Quote.
- [x] Tema interno preserva pacote completo por estilo: cor, negrito, italico, alinhamento, recuos, entrelinha e espacamentos.
- [x] Aplicacao de preset primeiro mapeia os estilos reais do Word e so depois aplica o visual escolhido.
- [ ] Tela avancada opcional para ajustes manuais fora do fluxo principal.
- [ ] Preview visual dos estilos antes de aplicar.
- [ ] Salvamento de preset customizado com nome do usuario.

## M2: Sincronizacao Estrutural

Entregavel: mapa do documento lido diretamente do Word.

Escopo:

- Ler todos os paragrafos.
- Capturar `paragraphIndex`.
- Capturar `style` e `styleBuiltIn`.
- Separar titulos reais, paragrafos normais, citacoes, candidatos visuais, tabelas e series numericas.

Criterios de aceite:

- Titulo real vem de `Heading1`, `Heading2`, `Heading3`.
- Candidatos inferidos pela IA aparecem como candidatos, nao como titulos aplicaveis.
- Toda acao que modifica o Word usa `paragraphIndex` antes de busca textual.

Status:

- [x] Frontend envia snapshot de paragrafos para o backend.
- [x] Backend preserva headings reais do Word.
- [x] Backend nao promove caixa alta automaticamente.
- [ ] UI dedicada de mapa do documento.
- [ ] Marcacao manual de candidato como titulo/citacao/bloco visual.

## M3: Perfis Visuais

Entregavel: presets profissionais para diferentes tipos de documento.

Perfis propostos:

- Juridico sobrio.
- Peticao moderna.
- Contrato corporativo.
- Parecer executivo.
- Visual Law didatico.

Cada perfil define:

- Normal.
- Titulo.
- Subtitulo.
- Heading 1/2/3.
- Citacao.
- Tabela.
- Bloco de alerta.
- Bloco de resumo.
- Grafico.

Criterios de aceite:

- Um clique aplica o perfil inteiro.
- Usuario pode ajustar cores, fonte e densidade antes de aplicar.
- Preset pode ser salvo por usuario ou documento.

Status:

- [x] Presets iniciais de tema.
- [x] Preset padrao Visual Law Premium com hierarquia editorial completa.
- [x] Perfis refinados para peticao, parecer, contrato e executivo.
- [x] Perfis definem pacote completo de texto para Normal, Title, Subtitle, Heading 1/2/3 e Quote.
- [x] Escala visual revisada para um estilo mais sobrio: titulos menores, menos espacamento e cores menos saturadas.
- [x] Diretriz editorial: titulos/subtitulos/headings alinhados a esquerda, sem centralizacao, com dourado discreto como acento.
- [x] Elementos discretos adicionados aos estilos: filetes finos em titulos/headings e destaque suave em citacao quando a API do Word suportar.
- [x] Paletas sobrias diversificadas: navy/gold, grafite/champagne, rubi mineral, verde profundo e carbono/cobre.
- [ ] Presets completos com tipografia e layout.
- [ ] Persistencia de preset refinado.
- [ ] Preview antes de aplicar.

## M4: Componentes Visual Law

Entregavel: biblioteca de blocos visuais inseriveis no Word.

Componentes:

- Resumo executivo.
- Linha do tempo.
- Fluxo/processo.
- Quadro de obrigacoes.
- Quadro de riscos.
- Quadro "o que foi decidido".
- Quadro "proximos passos".
- Citacao destacada.
- Tabela explicativa.
- Grafico simples.

Criterios de aceite:

- Cada bloco usa visual consistente com o tema.
- Cada bloco mostra origem/ancora quando aplicavel.
- Conteudo juridico nao e inventado.
- Bloco pode ser inserido no ponto certo do documento.

Status:

- [x] Painel Visual Law inicial em HTML.
- [ ] Redesign visual refinado.
- [ ] Componentes individuais selecionaveis.
- [ ] Insercao por ancora/paragraphIndex.
- [ ] Preview no taskpane antes de inserir.

## M5: Tabelas e Graficos Confiaveis

Entregavel: geracao controlada de tabelas e graficos.

Escopo:

- Detectar dados tabulares.
- Detectar series numericas.
- Mostrar previa.
- Inserir tabela Word real.
- Inserir grafico como imagem estavel.

Criterios de aceite:

- Sugerir grafico apenas com dados claros.
- Usuario aprova antes de inserir.
- Usar `paragraphIndex` antes de busca textual.
- Labels longos e caracteres especiais nao quebram graficos.

Status:

- [x] Insercao de tabela por candidato.
- [x] Insercao por `paragraphIndex` quando disponivel.
- [x] Escape de texto no SVG do grafico.
- [ ] Preview de tabela.
- [ ] Preview de grafico.
- [ ] Suporte a grafico de pizza ou remover opcao ate estar pronto.

## M6: Aplicacao Por Partes

Entregavel: fluxo incremental e controlado.

Fluxo alvo:

1. Sincronizar documento.
2. Classificar estrutura.
3. Escolher perfil.
4. Aplicar estilos base.
5. Revisar candidatos visuais.
6. Inserir blocos Visual Law aprovados.
7. Inserir tabelas/graficos aprovados.
8. Re-sincronizar documento.

Criterios de aceite:

- Aplicar somente estilos.
- Aplicar somente titulos reais.
- Inserir somente Visual Law.
- Inserir somente tabelas/graficos.
- Reprocessar sem baguncar o documento.

Status:

- [ ] Fluxo guiado no taskpane.
- [ ] Estados separados por etapa.
- [ ] Re-sincronizacao depois de cada aplicacao.

## M7: Revisao e Controle

Entregavel: modo revisao para seguranca operacional.

Escopo:

- Antes/depois.
- Log de mudancas.
- Contagem de paragrafos alterados.
- Desfazer ultima aplicacao quando possivel.
- Candidatos rejeitados ou confirmados.

Criterios de aceite:

- Usuario entende o que foi alterado.
- Alteracoes inferidas pela IA exigem confirmacao.
- Documento continua sendo a fonte de verdade.

Status:

- [ ] Log de mudancas de formatacao.
- [ ] Historico por operacao.
- [ ] Confirmacao de candidatos.
- [ ] Reverter ultima aplicacao.

## Proxima Iteracao Recomendada

Prioridade 1:

- Completar M1 com Title, Subtitle e Quote.
- Expor controles de fonte, tamanho, espacamento e recuo.
- Aplicar estilos reais do Word de forma consistente.

Prioridade 2:

- Criar Mapa do Documento no taskpane.
- Mostrar titulos reais, candidatos e paragrafos normais.
- Permitir marcar manualmente um candidato como titulo/citacao.

Prioridade 3:

- Redesenhar componentes Visual Law com preview.
- Separar resumo, fluxo, alertas, obrigacoes, citacoes e proximos passos como blocos independentes.

## Decisoes Ja Tomadas

- Titulo automatico so vem de estilo real do Word (`Heading1`, `Heading2`, `Heading3`).
- Texto em maiusculo nao e criterio suficiente para titulo.
- A IA pode sugerir Visual Law, tabelas e graficos, mas nao deve modificar estrutura sem confirmacao.
- `paragraphIndex` e preferido a busca textual.

## Perguntas Em Aberto

- Devemos criar um estilo customizado Wing para Visual Law ou usar apenas estilos nativos do Word?
- O bloco Visual Law deve entrar no inicio do documento, no ponto de selecao ou perto da ancora detectada?
- Citacoes devem ser detectadas por estilo Word, por padrao textual ou por confirmacao manual?
- Graficos devem ser imagem PNG, tabela + grafico nativo, ou ambos?
