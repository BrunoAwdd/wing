import { Router, uuidv4 } from "../deps.ts";
import { generateChatStream } from "../services/aiService.ts";

const router = new Router();

// --- Cache em Memória para Sessões de Chat ---

interface ChatSession {
  history: any[]; // TODO: Definir um tipo mais forte para o histórico
  timeoutId: number; // Deno usa number para o ID do timeout
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
router.post("/start", async (ctx) => {
  const { documentText } = await ctx.request.body.json();
  if (!documentText) {
    ctx.response.status = 400;
    ctx.response.body = { error: "documentText é obrigatório." };
    return;
  }

  const sessionId = uuidv4.generate();
  const history = [
    {
      role: "user",
      parts: [{ text: `Você é um assistente especialista neste documento. Analise o conteúdo a seguir e prepare-se para responder perguntas sobre ele. O documento é:\n\n---\n${documentText}\n---` }],
    },
    {
      role: "model",
      parts: [{ text: "Entendido. Analisei o documento e estou pronto para responder suas perguntas." }],
    },
  ];

  const timeoutId = setTimeout(() => {
    console.log(`Sessão de chat ${sessionId} expirou e foi limpa.`);
    chatSessions.delete(sessionId);
  }, SESSION_TIMEOUT);

  chatSessions.set(sessionId, { history, timeoutId });

  console.log(`Nova sessão de chat iniciada: ${sessionId}`);
  ctx.response.status = 201;
  ctx.response.body = { sessionId };
});

// Envia uma mensagem para uma sessão de chat existente
router.post("/message", async (ctx) => {
  const { sessionId, message } = await ctx.request.body.json();
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