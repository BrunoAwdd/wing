# Robbie Design System

## 1. Visão da marca

### Nome

**Robbie**

### Descrição curta

**Seu assistente de documentos no Word.**

### Promessa central

**Revise, reescreva, traduza, resuma e converse com seus documentos sem sair do Word.**

### Personalidade

O Robbie deve parecer:

- confiável;
- inteligente;
- profissional;
- simples;
- discreto;
- acessível;
- eficiente.

O Robbie não deve parecer:

- infantil;
- excessivamente futurista;
- informal demais;
- complexo;
- genérico;
- um chatbot comum.

---

# 2. Princípios de design

## 2.1 Familiar, mas não imitativo

A interface deve lembrar o ambiente profissional do Microsoft Word por meio de azul, cinza, branco, organização e clareza.

A identidade não deve copiar visualmente a Microsoft. O Robbie precisa ter cor, formas e personalidade próprias.

## 2.2 Clareza antes de decoração

Todo elemento deve ajudar o usuário a:

- entender o produto;
- perceber seu valor;
- visualizar como ele funciona;
- iniciar o teste;
- agendar uma demonstração.

Elementos decorativos não devem competir com o conteúdo.

## 2.3 Produto visível

O site deve mostrar o Robbie funcionando dentro do Word.

Capturas de tela, vídeos curtos, comparações e demonstrações devem aparecer mais do que ilustrações abstratas sobre inteligência artificial.

## 2.4 Confiança profissional

O site deve transmitir segurança para usuários que trabalham com documentos importantes.

Usar:

- textos objetivos;
- espaços amplos;
- ícones simples;
- bordas discretas;
- sombras leves;
- linguagem sem exageros;
- demonstrações reais.

## 2.5 Conversão sem agressividade

O site deve conduzir o usuário ao teste gratuito sem parecer uma página promocional excessivamente pressionada.

O CTA principal deve estar sempre claro, mas nunca competir com vários outros botões.

---

# 3. Identidade visual

## 3.1 Conceito visual

O Robbie combina três universos:

1. **Documentos profissionais**
2. **Assistência inteligente**
3. **Familiaridade com o Word**

A linguagem visual deve ser limpa, geométrica e amigável.

---

# 4. Paleta de cores

## 4.1 Cor principal

### Robbie Blue 600

**#2864C7**

Uso:

- botões principais;
- links;
- elementos ativos;
- ícones de destaque;
- marca;
- indicadores de progresso.

É um azul profissional e familiar, mas suficientemente diferente do azul oficial do Word.

### Robbie Blue 700

**#1F4F9F**

Uso:

- hover de botões;
- títulos em fundos claros;
- elementos de maior contraste.

### Robbie Blue 800

**#193E7D**

Uso:

- fundos institucionais;
- rodapé;
- seções premium;
- estados pressionados.

### Robbie Blue 100

**#DCEAFF**

Uso:

- fundos de cards informativos;
- badges;
- destaques sutis;
- áreas de demonstração.

### Robbie Blue 50

**#F2F7FF**

Uso:

- fundos alternativos;
- seções claras;
- áreas de benefícios.

---

## 4.2 Cores neutras

### Graphite 950

**#111827**

Uso:

- títulos principais;
- textos de grande importância;
- rodapé.

### Graphite 800

**#1F2937**

Uso:

- textos principais;
- subtítulos;
- navegação.

### Graphite 600

**#4B5563**

Uso:

- descrições;
- textos secundários;
- legendas.

### Graphite 400

**#9CA3AF**

Uso:

- placeholders;
- textos desabilitados;
- detalhes auxiliares.

### Gray 200

**#E5E7EB**

Uso:

- bordas;
- divisores;
- linhas;
- estados neutros.

### Gray 100

**#F3F4F6**

Uso:

- fundos secundários;
- cards;
- caixas de demonstração.

### Gray 50

**#F8FAFC**

Uso:

- fundo geral alternativo.

### White

**#FFFFFF**

Uso:

- fundo principal;
- cards;
- modais;
- áreas de destaque.

---

## 4.3 Cores funcionais

### Success

**#15803D**

Fundo suave:

**#DCFCE7**

Uso:

- ação concluída;
- economia de tempo;
- teste ativado;
- mensagem de sucesso.

### Warning

**#B45309**

Fundo suave:

**#FEF3C7**

Uso:

- limite de créditos;
- atenção;
- estado pendente.

### Error

**#B42318**

Fundo suave:

**#FEE4E2**

Uso:

- falhas;
- campos inválidos;
- problemas de instalação.

### Info

**#0369A1**

Fundo suave:

**#E0F2FE**

Uso:

- dicas;
- mensagens informativas;
- instruções.

---

# 5. Gradientes

Gradientes devem ser discretos e usados apenas em áreas estratégicas.

## Gradiente principal

```css
linear-gradient(135deg, #2864C7 0%, #1F4F9F 100%)
```

Uso:

- CTA principal em destaque;
- pequenas áreas hero;
- selo Pro;
- elementos da marca.

## Gradiente de fundo

```css
linear-gradient(180deg, #F2F7FF 0%, #FFFFFF 100%)
```

Uso:

- hero;
- demonstração do produto;
- seção de benefícios.

Evitar gradientes neon, roxos ou excessivamente saturados.

---

# 6. Tipografia

## 6.1 Fonte de títulos

### Manrope

Pesos:

- 600;
- 700;
- 800.

Características:

- moderna;
- profissional;
- geométrica;
- tecnológica sem parecer futurista.

## 6.2 Fonte de textos

### Inter

Pesos:

- 400;
- 500;
- 600;
- 700.

Características:

- alta legibilidade;
- ótima leitura em telas;
- adequada para interfaces e páginas longas.

## 6.3 Fallbacks

```css
font-family: "Inter", "Segoe UI", Arial, sans-serif;
```

Para títulos:

```css
font-family: "Manrope", "Segoe UI", Arial, sans-serif;
```

---

# 7. Escala tipográfica

## Display

### Display XL

- 64 px desktop;
- 48 px tablet;
- 38 px mobile;
- peso 700;
- line-height 1.05;
- letter-spacing -0.04em.

Uso: headline principal do hero.

### Display L

- 48 px desktop;
- 40 px tablet;
- 34 px mobile;
- peso 700;
- line-height 1.1.

Uso: títulos de grandes seções.

## Headings

### H1

- 48 px;
- peso 700;
- line-height 1.1.

### H2

- 38 px;
- peso 700;
- line-height 1.2.

### H3

- 28 px;
- peso 700;
- line-height 1.25.

### H4

- 22 px;
- peso 600;
- line-height 1.3.

## Corpo

### Body Large

- 18 px;
- line-height 1.65;
- peso 400.

Uso: subtítulo do hero e textos introdutórios.

### Body

- 16 px;
- line-height 1.6;
- peso 400.

### Body Small

- 14 px;
- line-height 1.5;
- peso 400.

### Caption

- 12 px;
- line-height 1.4;
- peso 500.

## Regras

- limitar parágrafos a aproximadamente 70 caracteres por linha;
- evitar títulos inteiros em caixa alta;
- usar negrito apenas para palavras estratégicas;
- não usar mais de dois pesos na mesma seção;
- evitar textos centralizados em blocos longos.

---

# 8. Espaçamento

O sistema utiliza uma base de **4 px**.

## Escala

- 4 px: `space-1`
- 8 px: `space-2`
- 12 px: `space-3`
- 16 px: `space-4`
- 24 px: `space-6`
- 32 px: `space-8`
- 40 px: `space-10`
- 48 px: `space-12`
- 64 px: `space-16`
- 80 px: `space-20`
- 96 px: `space-24`
- 120 px: `space-30`

## Espaçamento de seções

Desktop:

- 96 a 120 px verticalmente.

Tablet:

- 72 a 88 px.

Mobile:

- 56 a 72 px.

---

# 9. Grid e containers

## Container principal

```css
max-width: 1200px;
margin: 0 auto;
padding: 0 24px;
```

## Container de leitura

```css
max-width: 760px;
```

Uso:

- textos;
- FAQ;
- conteúdos explicativos;
- mensagens institucionais.

## Grid desktop

- 12 colunas;
- gap de 24 px.

## Grid tablet

- 8 colunas;
- gap de 20 px.

## Grid mobile

- 4 colunas;
- gap de 16 px.

---

# 10. Bordas e raios

## Escala de radius

- 6 px: campos pequenos;
- 8 px: botões;
- 12 px: cards;
- 16 px: cards de destaque;
- 20 px: imagens e demonstrações;
- 24 px: grandes áreas do produto;
- 999 px: pills e badges.

## Regra visual

O Robbie deve usar cantos suavemente arredondados.

Evitar:

- cards completamente circulares;
- arredondamento exagerado;
- formas excessivamente orgânicas;
- visual de aplicativo infantil.

---

# 11. Sombras

As sombras devem ser leves.

## Shadow Small

```css
0 1px 2px rgba(17, 24, 39, 0.06)
```

Uso:

- campos;
- menus;
- botões secundários.

## Shadow Medium

```css
0 8px 24px rgba(17, 24, 39, 0.08)
```

Uso:

- cards;
- caixas de recursos;
- demonstrações.

## Shadow Large

```css
0 24px 64px rgba(17, 24, 39, 0.12)
```

Uso:

- mockup principal;
- janela do Word;
- modal;
- área hero.

---

# 12. Logo

## 12.1 Conceito

O logo deve representar um rosto de robô minimalista.

Características:

- construção geométrica;
- traços simples;
- dois olhos;
- expressão neutra ou discretamente simpática;
- sem antenas caricatas;
- sem boca exagerada;
- sem detalhes excessivos.

## 12.2 Símbolo

Sugestão:

- cabeça formada por um quadrado arredondado;
- olhos representados por dois pequenos retângulos ou pontos;
- detalhe inferior que lembre uma página ou caixa de texto;
- possível monograma “R” integrado de forma sutil.

## 12.3 Versões

Criar:

1. logo horizontal;
2. logo vertical;
3. símbolo isolado;
4. versão branca;
5. versão monocromática;
6. favicon;
7. ícone do add-in.

## 12.4 Área de proteção

Usar como área mínima ao redor do logo a largura de um dos olhos do símbolo multiplicada por dois.

## 12.5 Tamanho mínimo

- logo completo: 120 px;
- símbolo: 24 px;
- favicon: 16 px.

---

# 13. Iconografia

## Estilo

- outline;
- traço de 1,75 ou 2 px;
- cantos levemente arredondados;
- formas simples;
- sem preenchimentos pesados.

## Biblioteca recomendada

- Lucide Icons;
- Fluent UI Icons, quando fizer sentido para integração com o ecossistema Microsoft.

## Ícones principais

- documento;
- correção;
- reescrita;
- tradução;
- resumo;
- chat;
- histórico;
- escudo;
- crédito;
- equipe;
- Word;
- seta;
- check;
- play.

---

# 14. Botões

## 14.1 Botão principal

### Aparência

- fundo: Robbie Blue 600;
- texto: branco;
- radius: 8 px;
- altura: 48 px;
- padding horizontal: 22 px;
- peso: 600.

### Hover

- fundo: Robbie Blue 700;
- elevação discreta.

### Texto recomendado

- Testar gratuitamente
- Começar agora
- Instalar o Robbie

Evitar:

- Saiba mais, quando o objetivo é conversão;
- Clique aqui;
- Conheça nossa solução.

---

## 14.2 Botão secundário

- fundo branco;
- borda Gray 200;
- texto Graphite 800;
- altura 48 px.

Usos:

- Assistir demonstração
- Agendar apresentação
- Ver como funciona

## 14.3 Botão ghost

- fundo transparente;
- texto Robbie Blue 600;
- sem borda.

Uso:

- navegação;
- links secundários;
- ações de baixa prioridade.

## 14.4 Estados

Todos os botões devem ter:

- hover;
- focus;
- pressed;
- loading;
- disabled.

---

# 15. Campos de formulário

## Aparência

- altura mínima: 48 px;
- borda: 1 px Gray 200;
- radius: 8 px;
- fundo branco;
- padding horizontal: 14 px;
- label acima do campo.

## Focus

- borda Robbie Blue 600;
- outline externo suave em Robbie Blue 100.

## Erro

- borda Error;
- mensagem pequena abaixo do campo;
- não depender apenas da cor.

## Formulários recomendados

Teste gratuito:

- nome;
- e-mail profissional;
- senha ou login Microsoft;
- aceite de termos.

Demonstração para escritórios:

- nome;
- e-mail;
- escritório ou empresa;
- número de usuários;
- telefone opcional.

Não solicitar dados desnecessários.

---

# 16. Cards

## Card padrão

- fundo branco;
- borda Gray 200;
- radius 12 px;
- padding 24 px;
- shadow small.

Uso:

- benefícios;
- recursos;
- público;
- depoimentos.

## Card destacado

- borda Robbie Blue 100;
- fundo Robbie Blue 50;
- radius 16 px;
- padding 32 px.

Uso:

- plano Pro;
- principal diferencial;
- prova social;
- recurso “Fale com o documento”.

## Card interativo

No hover:

- borda Robbie Blue 600;
- deslocamento vertical de até 4 px;
- sombra medium.

Evitar animações excessivas.

---

# 17. Badges

## Badge padrão

- fundo Gray 100;
- texto Graphite 600;
- radius 999 px;
- tamanho 12 ou 13 px;
- peso 600.

## Badge primário

- fundo Robbie Blue 100;
- texto Robbie Blue 800.

Exemplos:

- Novo
- Dentro do Word
- Mais utilizado
- Recomendado
- Plano Pro

---

# 18. Navegação

## Header

### Desktop

- logo à esquerda;
- links no centro ou à direita;
- CTA principal no extremo direito.

Links:

- Recursos
- Como funciona
- Preços
- Para escritórios
- Perguntas frequentes

CTA:

**Testar gratuitamente**

## Comportamento

- header inicialmente transparente ou branco;
- após scroll, fundo branco com sombra leve;
- altura entre 72 e 80 px;
- sticky.

## Mobile

- logo;
- botão de menu;
- CTA principal visível dentro do menu;
- evitar mais de seis links.

---

# 19. Hero da landing page

## Estrutura

Desktop:

- texto à esquerda;
- mockup do produto à direita.

Mobile:

- texto primeiro;
- CTA;
- demonstração abaixo.

## Eyebrow

**Assistente de documentos no Word**

## Headline

**Revise, reescreva e converse com seus documentos sem sair do Word.**

## Subheadline

**O Robbie ajuda você a corrigir, reformular, traduzir, resumir e entender documentos diretamente no Microsoft Word.**

## CTAs

Principal:

**Testar gratuitamente**

Secundário:

**Assistir demonstração**

## Prova curta

Abaixo dos botões:

**Sem copiar e colar. Sem sair do documento.**

## Visual

Mostrar:

- janela do Word;
- painel lateral do Robbie;
- texto selecionado;
- sugestão apresentada;
- ações de aceitar ou rejeitar.

---

# 20. Seções da landing page

## Ordem recomendada

1. Header
2. Hero
3. Faixa de confiança
4. Dor principal
5. Demonstração
6. Recursos
7. Como funciona
8. Casos de uso
9. Controle e segurança
10. Depoimentos
11. Preços
12. FAQ
13. CTA final
14. Rodapé

A página deve apresentar o produto antes de explicar profundamente a tecnologia.

---

# 21. Demonstração do produto

## Formato principal

Vídeo de 30 a 60 segundos.

## Formato secundário

GIF ou animação curta mostrando:

1. seleção de um trecho;
2. clique em reescrever;
3. sugestão do Robbie;
4. comparação;
5. aceite da alteração.

## Moldura

A demonstração deve aparecer dentro de um mockup inspirado na janela real do Word, sem reconstruir toda a interface de forma artificial.

## Legenda

**Veja o Robbie trabalhando dentro do Word.**

---

# 22. Componentes de prova social

## Depoimentos

Estrutura:

- frase;
- nome;
- profissão;
- empresa ou escritório;
- foto opcional.

## Caso de uso

Estrutura:

- problema;
- ação realizada;
- resultado;
- tempo economizado.

## Indicadores

Exemplos:

- documentos revisados;
- sugestões aceitas;
- tempo médio economizado;
- usuários ativos.

Não exibir métricas sem dados reais.

---

# 23. Seção de preços

## Plano Free

Visual neutro.

Conteúdo:

- teste do produto;
- créditos mensais;
- revisão;
- tradução;
- resumo;
- conversa com documentos.

CTA:

**Começar grátis**

## Plano Pro

Visual destacado em Robbie Blue.

Conteúdo:

- mais créditos;
- nível Profundo;
- uso recorrente;
- suporte prioritário;
- recursos completos do núcleo.

CTA:

**Assinar Robbie Pro**

## Escritórios

Card separado.

Conteúdo:

- múltiplos usuários;
- implantação;
- treinamento;
- acompanhamento;
- piloto.

CTA:

**Agendar demonstração**

---

# 24. FAQ

## Componente accordion

- título em 16 px;
- peso 600;
- ícone de expansão à direita;
- borda inferior;
- animação curta;
- conteúdo com largura confortável.

Perguntas principais:

- O Robbie funciona dentro do Word?
- Preciso copiar o texto para outra plataforma?
- Posso revisar contratos e petições?
- Como funcionam os créditos?
- Existe uma versão gratuita?
- O Robbie substitui a revisão humana?
- Meus documentos ficam armazenados?
- Funciona para equipes?

---

# 25. Rodapé

## Estrutura

Coluna 1:

- logo;
- descrição curta;
- redes sociais.

Coluna 2:

- Produto
- Recursos
- Preços
- Como funciona

Coluna 3:

- Empresa
- Sobre
- Contato
- Suporte

Coluna 4:

- Legal
- Privacidade
- Termos
- Segurança

Linha final:

- copyright;
- idioma;
- status do serviço.

Fundo recomendado:

**Graphite 950**

Textos:

- branco;
- Graphite 400.

---

# 26. Imagens e direção fotográfica

## Prioridade

1. produto real;
2. documentos;
3. profissionais trabalhando;
4. escritórios reais;
5. telas do Robbie.

## Estilo fotográfico

- iluminação natural;
- ambientes profissionais;
- cores neutras;
- pessoas usando notebook;
- enquadramento espontâneo;
- sem poses publicitárias exageradas.

## Evitar

- robôs humanoides genéricos;
- cérebros digitais;
- hologramas;
- mãos apertando telas;
- excesso de luz azul;
- imagens genéricas de inteligência artificial.

---

# 27. Ilustrações

Usar apenas quando a imagem do produto não resolver.

Estilo:

- geométrico;
- simples;
- fundo claro;
- azul e cinza;
- poucos detalhes;
- uso pontual.

O mascote do Robbie pode aparecer em:

- onboarding;
- estados vazios;
- mensagens de sucesso;
- dicas;
- suporte.

Não usar o mascote em todas as seções.

---

# 28. Movimento e animação

## Duração

- microinterações: 120 a 180 ms;
- cards e elementos: 180 a 240 ms;
- transições de seção: até 400 ms.

## Curva

```css
cubic-bezier(0.2, 0.8, 0.2, 1)
```

## Animações permitidas

- fade;
- deslocamento vertical de até 12 px;
- expansão de accordion;
- destaque de cursor;
- simulação de digitação;
- transição de antes e depois.

## Evitar

- parallax forte;
- objetos flutuando constantemente;
- animações longas;
- rotação;
- zoom agressivo;
- efeitos que reduzam a legibilidade.

Respeitar `prefers-reduced-motion`.

---

# 29. Responsividade

## Breakpoints

```css
--mobile: 480px;
--tablet: 768px;
--desktop: 1024px;
--wide: 1280px;
```

## Mobile

- botões principais com largura total;
- textos alinhados à esquerda;
- headline entre 36 e 40 px;
- cards em uma coluna;
- demonstrações com scroll horizontal apenas quando necessário;
- menu simplificado;
- CTA sticky opcional no fundo da tela.

## Tablet

- grids de duas colunas;
- hero pode permanecer dividido;
- reduzir áreas vazias;
- títulos entre 40 e 48 px.

## Desktop

- largura máxima de 1200 px;
- seções com bastante respiro;
- demonstrações amplas;
- grids de três ou quatro colunas.

---

# 30. Acessibilidade

## Contraste

- seguir WCAG AA;
- textos normais com contraste mínimo de 4,5:1;
- textos grandes com contraste mínimo de 3:1.

## Navegação

- todos os elementos devem funcionar por teclado;
- focus visível;
- ordem lógica de tabulação;
- links com nomes descritivos;
- botões com verbos claros.

## Imagens

- fornecer texto alternativo;
- imagens decorativas devem usar `alt=""`.

## Formulários

- labels visíveis;
- erros explicados em texto;
- não depender apenas de cor;
- áreas clicáveis com pelo menos 44 px.

---

# 31. Tom de voz

## Características

- direto;
- seguro;
- humano;
- profissional;
- simples;
- sem exageros.

## Exemplo adequado

**Revise seus documentos sem sair do Word.**

## Exemplo inadequado

**Revolucione completamente sua jornada documental com inteligência artificial de última geração.**

## Verbos principais

- revisar;
- reescrever;
- traduzir;
- resumir;
- conversar;
- comparar;
- aceitar;
- controlar;
- economizar;
- compreender.

## Palavras a evitar

- revolucionário;
- disruptivo;
- mágico;
- ilimitado;
- perfeito;
- infalível;
- substitui profissionais;
- inteligência superior.

---

# 32. Tokens CSS iniciais

```css
:root {
  --color-primary-50: #f2f7ff;
  --color-primary-100: #dceaff;
  --color-primary-600: #2864c7;
  --color-primary-700: #1f4f9f;
  --color-primary-800: #193e7d;

  --color-neutral-950: #111827;
  --color-neutral-800: #1f2937;
  --color-neutral-600: #4b5563;
  --color-neutral-400: #9ca3af;
  --color-neutral-200: #e5e7eb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-50: #f8fafc;
  --color-white: #ffffff;

  --color-success: #15803d;
  --color-success-soft: #dcfce7;
  --color-warning: #b45309;
  --color-warning-soft: #fef3c7;
  --color-error: #b42318;
  --color-error-soft: #fee4e2;
  --color-info: #0369a1;
  --color-info-soft: #e0f2fe;

  --font-heading: "Manrope", "Segoe UI", Arial, sans-serif;
  --font-body: "Inter", "Segoe UI", Arial, sans-serif;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-pill: 999px;

  --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.06);
  --shadow-md: 0 8px 24px rgba(17, 24, 39, 0.08);
  --shadow-lg: 0 24px 64px rgba(17, 24, 39, 0.12);

  --container-main: 1200px;
  --container-reading: 760px;

  --transition-fast: 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --transition-normal: 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

# 33. Regra de hierarquia de conversão

Cada seção deve possuir no máximo:

- um objetivo;
- um título principal;
- um CTA principal;
- um CTA secundário opcional.

Hierarquia:

1. Testar gratuitamente
2. Assistir demonstração
3. Agendar apresentação
4. Ler mais

O CTA “Testar gratuitamente” deve aparecer:

- no header;
- no hero;
- após a demonstração;
- na seção de preços;
- no CTA final.

---

# 34. Identidade resumida

## Marca

**Robbie**

## Categoria

**Assistente de documentos no Word**

## Cor principal

**#2864C7**

## Tipografia

- Manrope para títulos;
- Inter para interface e textos.

## Estilo

- profissional;
- limpo;
- familiar;
- inteligente;
- discreto.

## Elemento central

**O produto funcionando dentro do Word.**

## CTA principal

**Testar gratuitamente**

## Mensagem principal

**Revise, reescreva e converse com seus documentos sem sair do Word.**
