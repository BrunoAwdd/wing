# Roadmap Estratégico - Wing

_Este roadmap foi atualizado para um formato orientado a negócios, alinhando desenvolvimento, produto e estratégia para investidores e parceiros. O progresso das fases iniciais foi migrado do roadmap anterior._

---

### Fase 1 — Design & Estrutura (Concluída)

**Saída:** UI estática navegável com estados básicos.
**Métrica:** Tempo de load do painel < 1,5s no Word desktop.

### Fase 2 — Core (Concluída)

**Saída:** Fluxo completo de: seleção → chamada IA → diff → aceitar.
**Métrica:** Latência E2E p95 < 6s (para texto de ~500 palavras).

### Fase 3 — Product-Market Fit “Lite”

- [x] **Console de Comando** com presets (Corrigir, Traduzir, Resumir, Mudar Tom).
- [x] **Área de Log/Status** (fila de processamento, erros, uso de tokens).
- [x] **Telemetria** (usando Amplitude/PostHog): eventos para _open_panel_, _send_prompt_, _accept_suggestion_, _error_rate_.

**Saídas:** Painel estável com logs úteis para suporte ao cliente.
**Métricas-Alvo:** DAU ≥ 500 (em beta) / Taxa de erro < 2% / Retenção D7 ≥ 25%.

### Fase 4 — Polimento & Testes (Concluída)

- [x] **Testes de usabilidade** (5–10 sessões) com tarefas definidas.
- [x] **Resiliência da Rede**: Retries exponenciais, mensagens de status offline, toasts de erro claros.
- [x] **Performance Percebida**: Implementar streaming parcial da resposta da IA para mostrar progresso.

**Saídas:** Relatório de usabilidade com plano de ação para correções.
**Métricas-Alvo:** Taxa de sucesso de tarefa ≥ 85% / Latência p95 < 5s com streaming.

### Fase 5 — Backend & Escalabilidade (Concluída)

- [x] **API Backend** (ex: Node/Express ou Fastify) com autenticação (JWT em rotas /v1/\*).
- [x] **Gerenciamento de Segredos** no servidor (nenhuma chave no cliente).
- [x] **Abstração de Provedores**: Criar um `ProviderService` que suporte **Gemini** e **Azure OpenAI** para facilitar a troca.
- [x] **Observabilidade**: Logs estruturados, tracing (OpenTelemetry), rate limiting e WAF (WAF delegado para infraestrutura de deploy).

**Saídas:** SDK interno (`@wing/api-client`) para consumo no frontend.
**Métricas-Alvo:** 99,9% de uptime (em 30 dias) / Custo por 1k de requisições monitorado.

### Fase 6 — Ações Específicas (Qualidade)

- [x] Endpoints dedicados: `/fix`, `/translate`, `/summarize`, `/rewrite`.
- [x] **Engenharia de Prompt** avançada por ação, com testes de qualidade (golden sets).
- [x] **Avaliação Humana Leve** (escala Likert 1–5) embutida na UI após o usuário "Aceitar".

**Saídas:** Biblioteca de prompts versionada e testada.
**Métricas-Alvo:** CSAT ≥ 4.4 / Taxa de aceitação de sugestão ≥ 60%.

### Fase 6.5 — Manutenção de Estrutura de Texto (UX)

- [x] **Captura Estruturada**: No frontend, capturar a seleção do usuário como uma lista de parágrafos, cada um com seu texto e um ID único.
- [x] **API Estruturada**: Modificar a API do backend para receber e retornar um array de objetos de parágrafo (`{id, text}`).
- [x] **Renderização Estruturada**: Atualizar a UI para exibir corretamente os múltiplos parágrafos, preservando as quebras de linha.

**Saídas:** A sugestão da IA preserva a formatação de parágrafos do texto original.
**Métricas-Alvo:** Aumento no CSAT relacionado à qualidade da formatação.

### Fase 7 — UX Pro & Análise de Documento

- [ ] **Botões de Ação Rápida** na UI para tarefas comuns (Corrigir, Resumir, Mudar Tom).
- [ ] **Leitura do documento inteiro** (com chunking e limites de tamanho).
- [ ] **Histórico de Alterações** (permitindo ao usuário desfazer uma ação do Wing).

**Saídas:** UX de "1 clique" para as tarefas mais comuns.
**Métricas-Alvo:** Redução de 40% no tempo para concluir tarefas de correção.

### Fase 8 — Monetização (Freemium)

- [ ] **Modelagem de Planos**: Free (X solicitações/dia, sem análise de doc inteiro), Pro, Team.
- [ ] **Integração de Pagamento** (Stripe) para gestão de assinaturas e cotas.
- [ ] **Paywall Contextual** (oferecer upgrade no momento de maior valor para o usuário).

**Saídas:** Checkout funcional e portal de gerenciamento de assinaturas.
**Métricas-Alvo:** Conversão Free→Paid de 2–5% / ARPU alvo / Churn < 5% ao mês.

### Fase 9 — Compliance & Publicação

- [ ] **Checklist do AppSource**: Validar manifesto, permissões e requisitos de publicação.
- [ ] **Política de Dados Clara**: Sem retenção de texto por padrão; opt-in para "melhorar o serviço".
- [ ] **Documentação Legal**: Termos de Serviço e Política de Privacidade (PT/EN).

**Saídas:** Submissão para a loja da Microsoft e página de privacidade pública.
**Métricas-Alvo:** Aprovação na 1ª ou 2ª tentativa de submissão.

### Fase 10 — Parceria Microsoft (Go-To-Market)

- [ ] **Landing Zone no Azure**: Deploy da infraestrutura no Azure, com custos estimados e dashboards.
- [ ] **Paridade com Azure OpenAI**: Testes de qualidade comparando os resultados do Azure OpenAI com os do Gemini.
- [ ] **Pacote de Pitch**: 1-pager, vídeo de 60s e métricas iniciais de tração.
- [ ] **Observabilidade**: WAF.
- [ ] **Add Jaeger ou datadog**: Para os logs;

**Saídas:** Piloto rodando com créditos Azure; acesso ao Copilot/GPT via parceria.
**Métricas-Alvo:** Conquistar 3 "design partners" / Atingir 10k de instalações no AppSource.
