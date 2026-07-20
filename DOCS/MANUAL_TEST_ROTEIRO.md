# Roteiro manual de testes — Wing no Word

Este roteiro cobre o gate de saída do M5 ("o pacote instalado em uma máquina
limpa abre o Wing, autentica e conclui uma ação sem depender de
infraestrutura local") e o item correspondente do M6 ("criar roteiro manual
para interações reais com o Word"). Ele complementa, não substitui, os
testes automatizados do backend (`deno task test`).

Rodar em **Word Windows, Word para Mac e Word na Web** — o suplemento é o
mesmo, mas o host do Office varia o suficiente (sideload, DOM, permissões)
para justificar os três.

## 0. Pré-requisitos

- [ ] Checklist de deploy em [`DOCS/DEPLOY_VPS.md`](DEPLOY_VPS.md) (seção 4)
  verde: backend no ar, certificado real de `robbie-api.awdd.com.br` servido
  pelo Caddy (não o self-signed de dev), secrets obrigatórios validados no
  boot, sem erros no `journalctl`. Rodar o roteiro abaixo contra um backend
  com certificado inválido ou secret faltando só mascara o problema real.
- [ ] Build de produção gerado com `PROD_APP_DOMAIN` definido
  (`frontend/webpack.config.js` falha o build sem essa variável — ver M5).
- [ ] Backend acessível no domínio configurado, com `CORS_ALLOWED_ORIGINS`
  incluindo o host do manifesto testado.
- [ ] Conta de teste sem sessão prévia (para exercitar o cadastro/login do
  zero) e uma conta com plano Free já usado além do limite (para testar
  cota esgotada).
- [ ] Documento do Word de teste com pelo menos 3 parágrafos de texto
  corrido, incluindo um trecho com erro gramatical proposital.

## 1. Instalação (sideload)

- [ ] **Windows**: sideload via `manifest.xml` (Inserir > Meus Suplementos >
  Fazer Upload Meu Suplemento) ou via `npm start` em desenvolvimento.
- [ ] **Mac**: mesmo fluxo de upload manual do manifesto — confirmar que o
  ícone e o nome exibidos batem com o manifesto de produção.
- [ ] **Web** (Word Online): upload do manifesto pelo mesmo menu — confirmar
  que o painel abre sem bloqueio de pop-up/cookies de terceiros.
- [ ] Painel abre sem erro no console e sem referência a `localhost`, HMR ou
  túnel de desenvolvimento (gate do M5).

## 2. Autenticação (Magic Link)

- [ ] Com conta nova: inserir e-mail em "Digite seu e-mail para receber um
  código de acesso.", clicar **Enviar código**.
- [ ] Código chega por e-mail dentro de instantes; inserir os 6 dígitos e
  clicar **Entrar**.
- [ ] Código incorreto mostra erro claro sem revelar se o e-mail existe ou
  não (mensagem genérica).
- [ ] Reenviar código respeita o intervalo mínimo (não deve permitir spam
  imediato de novos códigos).
- [ ] Sessão persiste ao fechar e reabrir o painel (sem pedir login de novo
  dentro da validade do token).
- [ ] Deixar a sessão expirar (ou forçar expiração) e confirmar que a
  próxima ação pede novo login em vez de falhar silenciosamente.

## 3. Seleção e ações principais

Para cada ação, testar com (a) um parágrafo selecionado e (b) nenhuma
seleção (documento inteiro, se aplicável):

- [ ] **Revisar → Corrigir**: corrige o erro gramatical proposital; diff
  mostra antes/depois; **Aceitar Tudo** aplica a mudança no documento;
  **Rejeitar Tudo** descarta sem alterar o texto.
- [ ] **Revisar → Reescrever**: gera uma reformulação plausível do trecho.
- [ ] **Traduzir → Substituir original**: substitui o parágrafo pelo
  traduzido.
- [ ] **Traduzir → Inserir antes / Inserir depois**: insere a tradução sem
  remover o original, na posição correta.
- [ ] **Resumir**: gera um resumo coerente e sensivelmente menor que o
  texto de entrada.
- [ ] **Fale com o documento**: pergunta sobre o conteúdo do documento
  recebe resposta com contexto real do texto (não genérica).
- [ ] Avaliação (👍/👎) após uma sugestão é registrada sem erro.

## 4. Seção "Documento"

- [ ] **Selecionar tudo**: seleciona o documento inteiro no Word a partir
  do painel.
- [ ] **Atualizar memória**: roda sem erro perceptível ao usuário.

## 5. Comando personalizado

- [ ] Digitar um comando livre no campo inferior ("Ou digite um comando
  personalizado...") e enviar produz uma resposta relevante ao comando.
- [ ] Histórico (ícone de relógio) mostra interações anteriores da sessão.

## 6. Créditos e cota

- [ ] Executar uma ação e confirmar que o saldo de créditos exibido
  diminui de forma consistente com a ação executada (ações mais caras,
  como nível **Profundo**, consomem mais).
- [ ] Com a conta de plano Free além do limite mensal: qualquer ação nova
  retorna mensagem clara de cota esgotada (não trava o painel, não mostra
  erro genérico).
- [ ] Nível de qualidade **Profundo** (quando exposto na UI) é bloqueado
  para conta Free com mensagem de upgrade, mesmo com créditos sobrando.

## 7. Erros e resiliência

- [ ] Derrubar a conexão de rede durante uma ação em andamento: painel
  mostra erro tratado, não trava nem perde o texto original do documento.
- [ ] Selecionar um trecho muito longo (acima do limite configurado):
  mensagem de limite excedido antes de qualquer chamada de IA.
- [ ] Fechar e reabrir o documento durante uma sessão ativa: painel se
  recupera (nova app session) sem exigir reinstalação do suplemento.

## 8. Encerramento de sessão

- [ ] Logout (menu "...") revoga a sessão — reabrir o painel exige login
  novamente.
- [ ] Após logout, o token antigo (se reaproveitado manualmente numa
  chamada de API) é rejeitado pelo backend.

## Registro do resultado

Para cada rodada completa (Windows, Mac, Web), registrar: data, versão do
build/manifesto testada, host do Word, e qualquer item que falhou com
passos para reproduzir. Um roteiro com falhas não documentadas não conta
como executado.
