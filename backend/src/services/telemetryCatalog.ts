type StringRule = {
  type: "string";
  values?: readonly string[];
  maxLength?: number;
};

type IntegerRule = {
  type: "integer";
  min: number;
  max: number;
};

// Breakdown de duração por fase de uma operação (ex.: tempo de checagem de
// entitlement, tempo gasto no provedor de IA, tempo de liquidação de
// créditos) — nem toda fase acontece em toda chamada (ex.: cache_lookup_ms
// só existe pra Gemini), então `keys` é o conjunto PERMITIDO, não
// obrigatório: um subconjunto é válido, uma chave fora da lista não.
type PhasesRule = {
  type: "phases";
  keys: readonly string[];
  maxMs: number;
};

type PropertyRule = StringRule | IntegerRule | PhasesRule;

interface EventDefinition {
  source: "client" | "server";
  properties: Record<string, PropertyRule>;
}

const commandRule: StringRule = {
  type: "string",
  values: [
    "fix",
    "translate",
    "summarize",
    "rewrite",
    "design_analyze",
    "legal_analyze",
  ],
};
const planRule: StringRule = {
  type: "string",
  values: ["free", "basic", "pro", "team", "enterprise"],
};
const countRule: IntegerRule = { type: "integer", min: 0, max: 10_000_000 };
const cacheProviderRule: StringRule = {
  type: "string",
  values: ["gemini", "openai", "anthropic"],
};
const durationMsRule: IntegerRule = { type: "integer", min: 0, max: 300_000 };
const phasesRule = (keys: readonly string[]): PhasesRule => ({
  type: "phases",
  keys,
  maxMs: 300_000,
});

export const TELEMETRY_CATALOG = {
  panel_opened: { source: "client", properties: {} },
  suggestion_rejected: {
    source: "client",
    properties: { command: commandRule },
  },
  suggestion_accepted_all: {
    source: "client",
    properties: { command: commandRule },
  },
  suggestion_rejected_all: {
    source: "client",
    properties: { command: commandRule },
  },
  suggestion_accepted_single: {
    source: "client",
    properties: { command: commandRule },
  },
  suggestion_rejected_single: {
    source: "client",
    properties: { command: commandRule },
  },
  suggestion_rated: {
    source: "client",
    properties: {
      command: commandRule,
      rating: { type: "integer", min: 1, max: 5 },
    },
  },
  suggestion_failed: {
    source: "client",
    properties: {
      command: commandRule,
      error_code: {
        type: "string",
        values: [
          "backend_request_failed",
          "stream_invalid",
          "network_unavailable",
        ],
      },
    },
  },
  memory_sync_completed: { source: "client", properties: {} },
  // Latência ponta a ponta medida no cliente (clique até fim do stream) —
  // complementa duration_ms/phases de prompt_completed/chat_message_completed
  // (que só medem o processamento do servidor). A diferença entre os dois
  // isola tempo de rede/fila do tempo de provedor de IA/backend.
  action_latency: {
    source: "client",
    properties: {
      command: {
        type: "string",
        values: ["fix", "translate", "summarize", "rewrite", "chat"],
      },
      duration_ms: durationMsRule,
      phases: phasesRule(["ttfb_ms", "streaming_ms"]),
    },
  },
  usage_incremented: {
    source: "server",
    properties: {
      yyyymm: { type: "integer", min: 202001, max: 299912 },
      requests_count: countRule,
      tokens_used: countRule,
    },
  },
  prompt_sent: {
    source: "server",
    properties: {
      command: commandRule,
      text_length: countRule,
      entitlement: planRule,
    },
  },
  prompt_completed: {
    source: "server",
    properties: {
      command: commandRule,
      output_items: countRule,
      duration_ms: durationMsRule,
      phases: phasesRule([
        "entitlement_ms",
        "credit_reserve_ms",
        "provider_stream_ms",
        "credit_settle_ms",
      ]),
    },
  },
  prompt_failed: {
    source: "server",
    properties: {
      command: commandRule,
      error_code: {
        type: "string",
        values: [
          "provider_start_failed",
          "provider_stream_failed",
          "request_failed",
        ],
      },
    },
  },
  magic_link_requested: { source: "server", properties: {} },
  magic_link_verified: { source: "server", properties: {} },
  magic_link_failed: {
    source: "server",
    properties: { reason: { type: "string", values: ["invalid_code"] } },
  },
  session_refreshed: { source: "server", properties: {} },
  office_sso_success: { source: "server", properties: {} },
  office_sso_failed: {
    source: "server",
    properties: { reason: { type: "string", values: ["invalid_token"] } },
  },
  checkout_started: { source: "server", properties: { plan: planRule } },
  checkout_failed: { source: "server", properties: { plan: planRule } },
  subscription_started: { source: "server", properties: {} },
  subscription_updated: { source: "server", properties: {} },
  subscription_canceled: { source: "server", properties: {} },
  subscription_paused: { source: "server", properties: {} },
  subscription_resumed: { source: "server", properties: {} },
  chat_session_started: {
    source: "server",
    properties: { entitlement: planRule, document_chars: countRule },
  },
  chat_message_completed: {
    source: "server",
    properties: {
      entitlement: planRule,
      message_chars: countRule,
      response_chars: countRule,
      session_message_count: countRule,
      duration_ms: durationMsRule,
      phases: phasesRule([
        "entitlement_ms",
        "cache_lookup_ms",
        "credit_reserve_ms",
        "provider_stream_ms",
        "credit_settle_ms",
      ]),
    },
  },
  chat_message_interrupted: {
    source: "server",
    properties: { session_message_count: countRule },
  },
  // M4.5: métrica de economia real do cache de prompt no provedor (prefixo
  // estável de instruções + documento). "cached" é 1 quando cached_tokens
  // > 0; "cached_tokens" é a contagem real reportada pelo provedor (não um
  // boolean disfarçado) — precisa disso pra medir economia de verdade, não
  // só "teve cache: sim/não". "provider" permite quebrar a métrica por
  // mecanismo (Gemini explícito, OpenAI/Anthropic implícitos).
  chat_context_cache_used: {
    source: "server",
    properties: {
      cached: countRule,
      cached_tokens: countRule,
      provider: cacheProviderRule,
      // M4.7: créditos que a conta deixou de pagar por causa do desconto
      // de leitura de cache — a prova final de "economia visível ao
      // cliente" que o gate de saída do M4.7 pede, não só uma contagem de
      // tokens que ninguém fora do time consegue traduzir em dinheiro.
      credits_saved: countRule,
    },
  },
} as const satisfies Record<string, EventDefinition>;

export type TelemetryEventName = keyof typeof TELEMETRY_CATALOG;
export type TelemetrySource = "client" | "server";
export const MAX_TELEMETRY_PAYLOAD_BYTES = 2_048;

export type TelemetryPropertyValue =
  | string
  | number
  | Record<string, number>;

export type TelemetryValidationResult =
  | { ok: true; properties: Record<string, TelemetryPropertyValue> }
  | { ok: false; code: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateTelemetryEvent = (
  eventName: unknown,
  properties: unknown,
  source: TelemetrySource,
): TelemetryValidationResult => {
  if (typeof eventName !== "string" || !(eventName in TELEMETRY_CATALOG)) {
    return { ok: false, code: "telemetry_event_not_allowed" };
  }

  const definition =
    TELEMETRY_CATALOG[eventName as TelemetryEventName] as EventDefinition;
  if (definition.source !== source) {
    return { ok: false, code: "telemetry_event_wrong_source" };
  }

  const candidate = properties === undefined ? {} : properties;
  if (!isPlainObject(candidate)) {
    return { ok: false, code: "telemetry_properties_invalid" };
  }

  const expectedKeys = Object.keys(definition.properties);
  const receivedKeys = Object.keys(candidate);
  if (
    receivedKeys.length !== expectedKeys.length ||
    receivedKeys.some((key) => !(key in definition.properties))
  ) {
    return { ok: false, code: "telemetry_properties_not_allowed" };
  }

  for (const key of expectedKeys) {
    const rule = definition.properties[key];
    const value = candidate[key];
    if (rule.type === "integer") {
      if (
        !Number.isInteger(value) || (value as number) < rule.min ||
        (value as number) > rule.max
      ) {
        return { ok: false, code: "telemetry_property_invalid" };
      }
    } else if (rule.type === "phases") {
      if (!isPlainObject(value)) {
        return { ok: false, code: "telemetry_property_invalid" };
      }
      const phaseKeys = Object.keys(value);
      const validPhases = phaseKeys.every((phaseKey) => {
        if (!rule.keys.includes(phaseKey)) return false;
        const phaseValue = value[phaseKey];
        return Number.isInteger(phaseValue) && (phaseValue as number) >= 0 &&
          (phaseValue as number) <= rule.maxMs;
      });
      if (!validPhases) {
        return { ok: false, code: "telemetry_property_invalid" };
      }
    } else if (
      typeof value !== "string" ||
      (rule.maxLength !== undefined && value.length > rule.maxLength) ||
      (rule.values !== undefined && !rule.values.includes(value))
    ) {
      return { ok: false, code: "telemetry_property_invalid" };
    }
  }

  const normalized = candidate as Record<string, TelemetryPropertyValue>;
  const payloadBytes = new TextEncoder().encode(
    JSON.stringify({ eventName, properties: normalized }),
  )
    .byteLength;
  if (payloadBytes > MAX_TELEMETRY_PAYLOAD_BYTES) {
    return { ok: false, code: "telemetry_payload_too_large" };
  }

  return { ok: true, properties: normalized };
};
