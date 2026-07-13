import { type Middleware, Router } from "../deps.ts";
import { optionalWingSession } from "../middlewares/authMiddleware.ts";
import { telemetryLimiter } from "../middlewares/rateLimiter.ts";
import { trackClientEvent } from "../services/telemetry.ts";
import {
  MAX_TELEMETRY_PAYLOAD_BYTES,
  type TelemetryEventName,
  validateTelemetryEvent,
} from "../services/telemetryCatalog.ts";

export interface TelemetryRouteDependencies {
  persistClientEvent: typeof trackClientEvent;
  rateLimit: Middleware;
}

const defaultDependencies: TelemetryRouteDependencies = {
  persistClientEvent: trackClientEvent,
  rateLimit: telemetryLimiter,
};

export const createTelemetryRouter = (
  dependencies: TelemetryRouteDependencies = defaultDependencies,
) => {
  const router = new Router();
  router.use(optionalWingSession);
  router.use(dependencies.rateLimit);

  router.post("/", async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Corpo JSON inválido.",
        code: "invalid_json",
      };
      return;
    }

    const encodedSize =
      new TextEncoder().encode(JSON.stringify(body)).byteLength;
    if (encodedSize > MAX_TELEMETRY_PAYLOAD_BYTES) {
      ctx.response.status = 413;
      ctx.response.body = {
        error: "Evento de telemetria excede o limite permitido.",
        code: "telemetry_payload_too_large",
      };
      return;
    }

    if (
      typeof body !== "object" || body === null || Array.isArray(body) ||
      Object.keys(body).some((key) =>
        key !== "eventName" && key !== "properties"
      )
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Formato de evento inválido.",
        code: "telemetry_body_invalid",
      };
      return;
    }

    const { eventName, properties } = body as Record<string, unknown>;
    const validation = validateTelemetryEvent(eventName, properties, "client");
    if (!validation.ok) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Evento de telemetria inválido.",
        code: validation.code,
      };
      return;
    }

    const accountId = ctx.state.auth?.accountId as string | undefined;
    dependencies.persistClientEvent(
      eventName as TelemetryEventName,
      validation.properties,
      accountId,
    );
    ctx.response.status = 202;
    ctx.response.body = { ok: true };
  });

  return router;
};

export default createTelemetryRouter();
