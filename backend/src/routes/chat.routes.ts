import { Router } from "../deps.ts";
import { generateChatStream } from "../services/aiService.ts";
import { billingService } from "../services/billingService.ts";
import { track } from "../services/telemetry.ts";
import {
  getWingAuth,
  requireWingSession,
} from "../middlewares/authMiddleware.ts";

const router = new Router();
router.use(requireWingSession);

// --- Cache em Memória para Sessões de Chat ---

interface ChatSession {
  history: any[]; // TODO: Definir um tipo mais forte para o histórico
  timeoutId: number; // Deno usa number para o ID do timeout
  accountId: string;
  messageCount: number;
}

const chatSessions = new Map<string, ChatSession>();
const SESSION_TIMEOUT = 3600000; // 1 hora em milissegundos

const resetSessionTimeout = (sessionId: string) => {
  if (chatSessions.has(sessionId)) {
    const session = chatSessions.get(sessionId)!;
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(() => {
      console.log(`Sessão de chat ${sessionId} expirou e foi limpa.`);
      chatSessions.delete(sessionId);
    }, SESSION_TIMEOUT);
  }
};

// --- Endpoints de Chat ---

// Inicia uma nova sessão de chat com o conteúdo do documento
router.post("/start", async (ctx: any) => {
  const { documentText } = await ctx.request.body.json();
  const auth = getWingAuth(ctx);

  if (!documentText) {
    ctx.response.status = 400;
    ctx.response.body = { error: "documentText é obrigatório." };
    return;
  }

  const entitlement = await billingService.getEntitlement(auth.accountId);

  const sessionId = crypto.randomUUID();
  const history = [
    {
      role: "user",
      parts: [{
        text:
          `Você é um assistente especialista neste documento. Analise o conteúdo a seguir e prepare-se para responder perguntas sobre ele. O documento é:\n\n---\n${documentText}\n---`,
      }],
    },
    {
      role: "model",
      parts: [{
        text:
          "Entendido. Analisei o documento e estou pronto para responder suas perguntas.",
      }],
    },
  ];

  const timeoutId = setTimeout(() => {
    console.log(`Sessão de chat ${sessionId} expirou e foi limpa.`);
    chatSessions.delete(sessionId);
  }, SESSION_TIMEOUT);

  chatSessions.set(sessionId, {
    history,
    timeoutId,
    accountId: auth.accountId,
    messageCount: 0,
  });

  track(
    "chat_session_started",
    { entitlement: entitlement.plan },
    auth.accountId,
  );

  console.log(`Nova sessão de chat iniciada: ${sessionId}`);
  ctx.response.status = 201;
  ctx.response.body = { sessionId };
});

// Envia uma mensagem para uma sessão de chat existente
router.post("/message", async (ctx: any) => {
  const { sessionId, message } = await ctx.request.body.json();
  const auth = getWingAuth(ctx);
  if (!sessionId || !message) {
    ctx.response.status = 400;
    ctx.response.body = { error: "sessionId e message são obrigatórios." };
    return;
  }

  if (!chatSessions.has(sessionId)) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Sessão de chat não encontrada ou expirada." };
    return;
  }

  resetSessionTimeout(sessionId);
  const session = chatSessions.get(sessionId)!;
  if (session.accountId !== auth.accountId) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Sessão de chat não encontrada ou expirada." };
    return;
  }

  session.messageCount += 1;
  track(
    "chat_message_sent",
    { session_message_count: session.messageCount },
    session.accountId,
  );

  try {
    const stream = generateChatStream(message, session.history);
    ctx.response.body = stream;
    ctx.response.status = 200;

    // Atualiza o histórico da sessão após a resposta
    session.history.push({ role: "user", parts: [{ text: message }] });
    // TODO: O ideal seria agregar a resposta completa do stream e adicioná-la ao histórico.
  } catch (error) {
    console.error(`Erro ao enviar mensagem para a sessão ${sessionId}:`, error);
    if (ctx.response.writable) {
      ctx.response.status = 500;
      ctx.response.body = { error: "Erro ao processar a mensagem." };
    }
  }
});

export default router;
