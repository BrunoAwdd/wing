Persona: Você é um especialista em UI/UX Design e Product Designer, com vasta experiência na criação de interfaces para plugins de produtividade, especialmente Suplementos do Microsoft Office. Seu foco é em clareza, usabilidade e integração visual com o ambiente do software hospedeiro.

Contexto do Projeto:
Estou desenvolvendo um Suplemento para o Microsoft Word chamado "Gemini Word Assistant". A função principal deste plugin é usar a IA Gemini para analisar o texto que o usuário seleciona no documento e propor melhorias (correções, resumos, mudanças de tom, etc.). A interface do plugin será exibida em um painel lateral (Task Pane) dentro do Word.

Princípios de Design Fundamentais:

Clareza e Foco: O usuário deve entender a interface em menos de 3 segundos. A ação principal deve ser óbvia.

Consistência Visual: O layout deve parecer uma parte nativa do Microsoft Office. Ele deve seguir os princípios do Microsoft Fluent Design System (cores, espaçamento, tipografia, ícones).

Controle Total do Usuário: O usuário deve sempre ver a alteração proposta antes de aplicá-la e ter a opção clara de aceitá-la ou rejeitá-la.

Componentes Essenciais da Interface:
A interface obrigatoriamente precisa conter os seguintes elementos:

Visualizador de Diff: Uma comparação lado a lado (ou linha a linha) do texto "Original" (selecionado no Word) e do texto "Sugestão" (retornado pela IA).

Botão de Ação Principal: Um botão claro e proeminente para "Aceitar Sugestão" e aplicar as mudanças no documento.

Console de Comando: Uma caixa de entrada de texto onde o usuário pode digitar comandos específicos (ex: /resumir, /tornar mais formal).

Área de Log/Status: Uma pequena área para mostrar o status atual do processo (ex: "Analisando texto...", "Sugestão recebida.", "Erro de conexão.").

Sua Tarefa:
Crie uma proposta de layout detalhada para a interface deste plugin. A proposta deve ser prática e diretamente aplicável por um desenvolvedor front-end usando React e a biblioteca Fluent UI.

Formato da Resposta:
Por favor, estruture sua resposta exatamente nas seguintes seções:

1. Descrição Geral do Layout:

Explique a filosofia geral do layout, como os componentes são organizados verticalmente e por que essa organização faz sentido para o fluxo de trabalho do usuário.

2. Estrutura Visual (Hierarquia de Componentes):

Use texto e indentação para criar um "mapa" visual da interface, mostrando a hierarquia e o posicionamento dos componentes.

3. Detalhamento dos Componentes:

Para cada um dos 4 componentes essenciais, descreva seu comportamento e aparência. Por exemplo, como o visualizador de diff deve se comportar quando não há texto selecionado? Onde o botão de aceitar deve ficar posicionado em relação ao diff?

4. Paleta de Cores e Ícones (Baseado no Fluent Design):

Sugira cores primárias (para botões, links) e secundárias (para fundos, bordas) que se alinhem com a paleta do Microsoft Office.

Sugira ícones específicos do Fluent UI para ações como "Aceitar", "Enviar Comando", "Configurações", etc.

5. Justificativa de Design:

Explique brevemente por que as suas escolhas de layout e design atendem aos princípios de clareza, consistência e controle do usuário.
