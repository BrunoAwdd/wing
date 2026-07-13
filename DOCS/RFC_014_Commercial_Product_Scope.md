# RFC 014 - Escopo do Produto Comercial Atual

**Status:** Proposto
**Autor:** Bruno Oliveira
**Data:** 2026-07-11
**Audiência:** Produto, Engenharia e Comercial
**Depende de:** RFC 013

---

## 1. Resumo

O produto comercial atual do Wing é um assistente de escrita e compreensão de documentos dentro do Microsoft Word.

Sua promessa é:

> Revise, traduza e converse com seus documentos no Word, com contexto mantido localmente e controle sobre cada alteração.

O lançamento mantém as capacidades que já resolvem trabalho recorrente e desliga, por enquanto, Visual Law e análise jurídica estruturada.

## 2. Núcleo mantido

| Capacidade | Papel no produto | Estado |
|---|---|---|
| Corrigir texto | Revisão objetiva de erros | Ativo |
| Reescrever texto | Clareza, tom e adequação | Ativo |
| Traduzir texto | Tradução dentro do Word | Ativo |
| Resumir texto | Apoio à leitura e síntese | Ativo |
| Comparar alterações | Controle do original e da sugestão | Ativo |
| Aceitar ou rejeitar por trecho | Segurança editorial | Ativo |
| Histórico local | Recuperação de sugestões | Ativo |
| Últimas alterações e reversão | Controle operacional | Ativo |
| Memória local | Contexto privado e persistente por documento | Ativo |
| Sincronizar memória | Atualização explícita do índice local | Ativo |
| Fale com o documento | Perguntas e respostas sobre o documento aberto | Ativo |

## 3. Features desligadas

| Capacidade | Estado | Motivo |
|---|---|---|
| Visual Law e design documental | Desligado | Resultado ainda variável |
| Análise jurídica estruturada | Desligado | Qualidade e risco ainda não validados |

O desligamento é reversível e segue o RFC 013.

Agents Hub e Maestro não são features futuras deste produto. O código executável foi removido conforme o RFC 016.

## 4. Experiência principal

O painel deve organizar o produto em quatro ações claras:

1. **Revisar:** corrigir ou reescrever a seleção.
2. **Traduzir:** traduzir a seleção para o idioma configurado.
3. **Resumir:** condensar a seleção.
4. **Fale com o documento:** iniciar uma conversa contextual com o conteúdo aberto.

Memória, histórico, reversão e configurações são recursos de suporte. A sincronização de memória pode permanecer acessível, mas deve usar linguagem orientada ao usuário em vez de termos de implementação.

## 5. Papel da memória local

A memória local é parte do produto, não peso morto. Ela deve:

- inicializar sem bloquear revisão e tradução;
- armazenar embeddings e índice no dispositivo;
- ser separada por documento;
- informar falhas sem inutilizar o restante do Wing;
- evitar envio do índice local para o backend;
- sustentar a evolução do “Fale com o documento”.

No estado atual, o chat envia o documento inteiro ao backend ao iniciar a sessão. Uma evolução posterior deve usar a recuperação local para enviar somente os trechos relevantes, reduzindo custo e exposição de dados.

## 6. Limites do primeiro lançamento

- um documento ativo por interação;
- Word como único host;
- um provedor de IA padrão;
- planos Free e Pro;
- assinatura individual no primeiro ciclo;
- sem marketplace de agentes;
- sem Agents Hub ou Maestro Planner;
- sem promessa de parecer jurídico;
- sem transformação visual ampla do documento.

## 7. Monetização

O plano Free serve para ativação e demonstração. O plano Pro libera uso recorrente após o limite mensal.

### Free

- limite mensal configurável de solicitações;
- revisão, tradução, resumo e conversa disponíveis;
- memória local disponível;
- convite para upgrade ao atingir a cota.

### Pro

- cota comercial superior ou uso justo configurável;
- gerenciamento de assinatura pelo Stripe Customer Portal;
- acesso contínuo ao núcleo atual.

A fonte de verdade do plano é o backend. O frontend nunca concede acesso pago por conta própria.

## 8. Métricas

- primeira ação concluída;
- sugestões aceitas e rejeitadas;
- traduções realizadas;
- sessões de conversa iniciadas;
- perguntas por sessão;
- sincronizações de memória concluídas;
- retorno semanal;
- consumo de cota Free;
- início e conclusão do checkout;
- conversão Free para Pro;
- cancelamento e falha de pagamento.

Nenhuma métrica deve incluir texto do documento.

## 9. Critérios de aceite

- todas as capacidades mantidas continuam visíveis e funcionais;
- Visual Law e análise jurídica não aparecem nem registram rotas;
- usuário autenticado recebe plano e cota do servidor;
- limite Free é aplicado de forma consistente;
- assinatura Pro é refletida após webhook do gateway;
- falha da memória não bloqueia revisão ou tradução;
- conversa com documento exige sessão e entitlement válidos;
- build, typecheck e testes do núcleo passam.

## 10. Decisão proposta

Lançar o Wing com revisão, tradução, resumo, memória local e conversa com o documento. Manter Visual Law e análise jurídica desligados até cumprirem os critérios do RFC 013.
