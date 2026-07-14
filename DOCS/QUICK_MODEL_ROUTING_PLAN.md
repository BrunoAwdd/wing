# Plano rápido de roteamento de modelos

**Status:** Pendente
**Objetivo:** escolher modelos por tarefa sem expor complexidade técnica e sem perder controle de créditos.

## Entrega 1 - Catálogo

- [ ] cadastrar os modelos permitidos e suas tarifas;
- [ ] classificar cada modelo como `rápido`, `equilibrado`, `profundo` ou `máximo`;
- [ ] manter Opus e Fable fora da seleção comum.

## Entrega 2 - Roteamento automático

- [ ] tradução usa Gemini 2.5 Flash-Lite;
- [ ] correção, tom e resumo curto usam Gemini Flash;
- [ ] reescrita e chat aceitam `rápido`, `equilibrado` e `profundo`;
- [ ] backend resolve o modelo final antes de reservar créditos;
- [ ] modelo executado e modelo cobrado devem ser iguais.

## Entrega 3 - Controle simples

- [ ] mostrar níveis de qualidade, não nomes de modelos;
- [ ] usar `Equilibrado` como padrão;
- [ ] mostrar estimativa de créditos para operações `Profundo`;
- [ ] impedir execução sem saldo suficiente.

## Mapeamento inicial

| Uso | Modelo |
|---|---|
| Tradução | Gemini 2.5 Flash-Lite |
| Correção, tom e resumo curto | Gemini Flash |
| Rápido | GPT Luna |
| Equilibrado | GPT Terra |
| Profundo | Claude Sonnet |
| Máximo, inicialmente oculto | GPT Sol, Claude Opus ou Fable |

## Gate de saída

- tradução é sempre executada no Flash-Lite;
- nenhuma operação cobra um modelo diferente do executado;
- Opus e Fable não podem ser escolhidos acidentalmente;
- testes cobrem roteamento, autorização por nível e reserva de créditos.

## Fora deste ciclo

- painel administrativo de modelos;
- roteamento baseado em benchmark;
- escolha automática por tamanho do documento;
- fallback entre provedores;
- liberação pública do nível `Máximo`.
