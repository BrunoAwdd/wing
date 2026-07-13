import type { Context, Middleware } from "../deps.ts";
import {
  type WingSessionClaims,
  wingSessionService,
} from "../services/wingSessionService.ts";

export interface WingAuthState {
  auth?: WingSessionClaims;
}

const getBearerToken = (ctx: Context): string | null => {
  const authorization = ctx.request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
};

const reject = (ctx: Context) => {
  ctx.response.status = 401;
  ctx.response.headers.set("WWW-Authenticate", "Bearer");
  ctx.response.body = { error: "Sessão Wing inválida ou expirada." };
};

export const requireWingSession: Middleware = async (ctx, next) => {
  const token = getBearerToken(ctx);
  if (!token) {
    reject(ctx);
    return;
  }

  try {
    ctx.state.auth = await wingSessionService.verify(token);
    await next();
  } catch {
    reject(ctx);
  }
};

export const optionalWingSession: Middleware = async (ctx, next) => {
  const token = getBearerToken(ctx);
  if (!token) {
    await next();
    return;
  }

  try {
    ctx.state.auth = await wingSessionService.verify(token);
    await next();
  } catch {
    reject(ctx);
  }
};

export const getWingAuth = (ctx: Context): WingSessionClaims => {
  const auth = ctx.state.auth as WingSessionClaims | undefined;
  if (!auth) {
    throw new Error("Middleware de sessão Wing não foi aplicado.");
  }
  return auth;
};
