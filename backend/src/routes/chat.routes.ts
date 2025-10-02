import { Router, Request, Response } from "express";
import { geminiProvider } from "../providers/geminiProvider";
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// --- Cache em Memória para Sessões de Chat ---

interface ChatSession {
  history: any[];
  timeoutId: NodeJS.Timeout;
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
router.post("/start", (req: Request, res: Response) => {
  const { documentText } = req.body;
  if (!documentText) {
    return res.status(400).json({ error: "documentText é obrigatório." });
  }

  const sessionId = uuidv4();
  const history = [
    {
      role: "user",
      parts: [{ text: `Você é um assistente especialista neste documento. Analise o conteúdo a seguir e prepare-se para responder perguntas sobre ele. O documento é:

---
${documentText}
---` }],
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
  res.status(201).json({ sessionId });
});

// Envia uma mensagem para uma sessão de chat existente
router.post("/message", async (req: Request, res: Response) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId e message são obrigatórios." });
  }

  if (!chatSessions.has(sessionId)) {
    return res.status(404).json({ error: "Sessão de chat não encontrada ou expirada." });
  }

  resetSessionTimeout(sessionId);
  const session = chatSessions.get(sessionId)!;

  try {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = geminiProvider.generateChatStream(message, session.history);

    for await (const chunk of stream) {
      res.write(chunk);
    }
    
    // Atualiza o histórico da sessão após a resposta
    // (Esta é uma simplificação. O ideal seria agregar a resposta completa)
    session.history.push({ role: "user", parts: [{ text: message }] });
    // session.history.push({ role: "model", parts: [{ text: fullResponse }] });

    res.end();
  } catch (error) {
    console.error(`Erro ao enviar mensagem para a sessão ${sessionId}:`, error);
    if (!res.writableEnded) {
      res.status(500).json({ error: "Erro ao processar a mensagem." });
    }
  }
});

export default router;
