import { RateLimiter } from "../deps.ts";
import logger from "../services/logger.ts";

const rateLimiterMiddleware = RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  // store: new MemoryStore(), // You can choose a different store
  message: {
    error: "Muitas requisições enviadas deste IP, por favor, tente novamente após 15 minutos.",
  },
  // @ts-ignore: O tipo do contexto está correto, mas o linter do Deno pode se confundir
  handler: (context) => {
    logger.warn(
      {
        ip: context.request.ip,
        path: context.request.url.pathname,
      },
      `Rate limit excedido para o IP: ${context.request.ip}`
    );
    context.response.status = 429;
    context.response.body = {
      error: "Muitas requisições enviadas deste IP, por favor, tente novamente após 15 minutos.",
    };
  },
});

export const apiLimiter = rateLimiterMiddleware;