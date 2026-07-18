import { Context } from "../deps.ts";
import logger from "../services/logger.ts";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

const getClientKey = (ctx: Context): string => {
  const cloudflareIp = ctx.request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp;
  const forwardedFor = ctx.request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return ctx.request.headers.get("x-real-ip") || "unknown";
};

const telemetryBuckets = new Map<string, RateLimitBucket>();
const TELEMETRY_WINDOW_MS = 60 * 1000;
const TELEMETRY_MAX_REQUESTS = 30;
const supportBuckets = new Map<string, RateLimitBucket>();
const SUPPORT_WINDOW_MS = 60 * 60 * 1000;
const SUPPORT_MAX_REQUESTS = 5;

export const supportLimiter = async (
  ctx: Context,
  next: () => Promise<unknown>,
) => {
  const now = Date.now();
  const key = getClientKey(ctx);
  const current = supportBuckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + SUPPORT_WINDOW_MS };
  bucket.count += 1;
  supportBuckets.set(key, bucket);

  if (bucket.count > SUPPORT_MAX_REQUESTS) {
    ctx.response.status = 429;
    ctx.response.body = {
      error: "Muitas solicitações enviadas. Tente novamente mais tarde.",
    };
    return;
  }

  await next();
};

export const telemetryLimiter = async (
  ctx: Context,
  next: () => Promise<unknown>,
) => {
  const now = Date.now();
  const accountId = ctx.state.auth?.accountId as string | undefined;
  const key = accountId
    ? `account:${accountId}`
    : `anonymous:${getClientKey(ctx)}`;
  const current = telemetryBuckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + TELEMETRY_WINDOW_MS };
  bucket.count += 1;
  telemetryBuckets.set(key, bucket);

  if (bucket.count > TELEMETRY_MAX_REQUESTS) {
    ctx.response.status = 429;
    ctx.response.body = {
      error: "Limite de telemetria excedido.",
      code: "telemetry_rate_limited",
    };
    return;
  }

  await next();
};

export const apiLimiter = async (
  ctx: Context,
  next: () => Promise<unknown>,
) => {
  const now = Date.now();
  const key = getClientKey(ctx);
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + WINDOW_MS };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_REQUESTS) {
    logger.warn(
      { ip: key, path: ctx.request.url.pathname },
      `Rate limit excedido para o IP: ${key}`,
    );
    ctx.response.status = 429;
    ctx.response.body = {
      error:
        "Muitas requisições enviadas deste IP, por favor, tente novamente após 15 minutos.",
    };
    return;
  }

  await next();
};
