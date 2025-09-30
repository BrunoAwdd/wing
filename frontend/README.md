# Wing - Seu Assistente de IA para o Microsoft Word

Wing é um poderoso Office Add-in que traz as capacidades da IA do Google Gemini diretamente para o seu fluxo de trabalho no Microsoft Word. Obtenha sugestões, correções, traduções e muito mais sem nunca sair do seu documento.

![Wing in action]()

## Sobre o Projeto

A ideia do projeto **Wing** é criar um assistente de inteligência artificial que funciona diretamente dentro do Microsoft Word.

Em vez de você precisar copiar um texto, ir para o navegador, colar em um site de IA (como o ChatGPT ou o próprio Gemini), dar um comando e depois copiar a resposta de volta para o seu documento, o Wing faz tudo isso por você dentro de um painel lateral no Word.

O fluxo de trabalho é simples:

1.  **Você seleciona** um texto no seu documento.
2.  O Wing **automaticamente o captura**.
3.  Você **dá um comando** a ele (como "corrija a gramática", "traduza para inglês" ou "faça este parágrafo soar mais profissional").
4.  O Wing envia o texto e seu comando para a **IA do Google (Gemini)**.
5.  Ele então mostra a **sugestão da IA** em uma tela que compara o "antes" e o "depois".
6.  Se você gostar da sugestão, com **um clique**, o Wing substitui o texto original no seu documento pelo novo texto.

Em resumo, é um "copilot" para escrita que visa tornar o processo de refinar, corrigir e melhorar textos muito mais rápido e fluido, mantendo o usuário focado dentro do seu ambiente de trabalho principal.

## Funcionalidades

- **Integração Perfeita:** Executado em um painel de tarefas diretamente no Word.
- **Seleção de Texto Dinâmica:** Captura automaticamente o texto que você seleciona no documento.
- **Sugestões via IA:** Envie qualquer comando para a IA para obter sugestões de correções, traduções, resumos e muito mais.
- **Visualizador de Diferenças (Diff):** Veja claramente as diferenças entre o seu texto original e a sugestão da IA.
- **Aplicação com Um Clique:** Aceite e substitua seu texto pela sugestão da IA com um único botão.

## Construído Com

- React
- TypeScript
- Office Add-ins
- Fluent UI
- Google Gemini API
- Webpack

## Como Começar

Para obter uma cópia local e executá-la, siga estes passos simples.

### Pré-requisitos

- Node.js & npm
- Uma assinatura do Microsoft 365 que suporte Office Add-ins.
- Microsoft Word (versão desktop recomendada para depuração).

### Instalação e Configuração

1.  **Clone o repositório:**
    ```sh
    git clone <url-do-seu-repositorio>
    ```
2.  **Instale os pacotes NPM:**
    ```sh
    npm install
    ```
3.  **Configure sua Chave de API:**
    - Você precisará de uma chave de API do Google Gemini.
    - Crie um arquivo chamado `.env` na raiz do projeto.
    - Adicione sua chave de API ao arquivo da seguinte forma:
      ```
      GEMINI_API_KEY="SUA_CHAVE_DE_API_AQUI"
      ```
    - **Importante:** O código em `src/taskpane/components/App.tsx` precisa ser atualizado para carregar esta variável de ambiente em vez de ter a chave diretamente no código.

4.  **Inicie o servidor de desenvolvimento:**
    ```sh
    npm start
    ```
    Este comando iniciará o servidor de desenvolvimento local e abrirá o Word com o add-in carregado para testes (sideload).

## Uso

1.  Abra um documento no Word.
2.  Abra o add-in "Wing" a partir do separador "Base" no friso (ribbon).
3.  Selecione um trecho de texto no seu documento. Ele aparecerá na seção "Original" do add-in.
4.  Digite um comando na consola de comandos (ex: "corrija a gramática", "traduza para espanhol") e envie.
5.  Analise a sugestão no visualizador de diferenças.
6.  Clique em "Aceitar" para atualizar o seu documento.

## Roadmap

Consulte o arquivo [Roadmap.md](Roadmap.md) para uma lista de funcionalidades propostas e planos de desenvolvimento futuros.

## Licença

Distribuído sob a Licença MIT. Consulte o arquivo `package.json` para mais informações.
