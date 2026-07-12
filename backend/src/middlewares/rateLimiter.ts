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
  const forwardedFor = ctx.request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return ctx.request.headers.get("x-real-ip") || "unknown";
};

export const apiLimiter = async (
  ctx: Context,
  next: () => Promise<unknown>
) => {
  const now = Date.now();
  const key = getClientKey(ctx);
  const current = buckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + WINDOW_MS };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_REQUESTS) {
    logger.warn(
      { ip: key, path: ctx.request.url.pathname },
      `Rate limit excedido para o IP: ${key}`
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
