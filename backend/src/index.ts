import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import jwt from "jsonwebtoken";
import { track } from "./services/telemetry";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// --- Configuração de Variáveis de Ambiente ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não está definido nas variáveis de ambiente.");
}

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Tipos e Interfaces ---
interface AuthenticatedRequest extends Request {
  user?: string | jwt.JwtPayload;
}

// --- Middleware de Autenticação JWT ---
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    track("auth_error", { type: "token_missing" });
    return res.status(401).json({ error: "Token de autenticação não fornecido." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      track("auth_error", { type: "token_invalid", message: err.message });
      return res.status(403).json({ error: "Token inválido ou expirado." });
    }
    req.user = user;
    next();
  });
};

// --- Rotas Públicas ---

// Rota de Login (exemplo)
app.post("/auth/office", async (req, res) => {
  const { msToken } = req.body;

  if (!msToken) {
    return res.status(400).json({ error: "msToken não fornecido." });
  }

  // TODO: Validar o msToken contra o Azure AD (JWKS da Microsoft)
  // 1. Obter as chaves de assinatura da Microsoft (JWKS).
  // 2. Decodificar o token (sem verificar a assinatura ainda) para obter o `kid` do cabeçalho.
  // 3. Encontrar a chave correspondente no JWKS.
  // 4. Verificar a assinatura do token com a chave pública.
  // 5. Verificar as claims (issuer, audience, expiration, etc.).
  // Exemplo de bibliotecas: jwks-rsa, jsonwebtoken

  // Simulação de uma validação bem-sucedida e extração de dados do usuário
  const userPayload = {
    // Em um cenário real, estes dados viriam do msToken validado
    sub: "user-id-from-ms-token",
    tid: "tenant-id-from-ms-token",
    upn: "user@example.com",
  };

  // Emitir nosso próprio JWT curto
  const appJwt = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "15m" });

  track("office_sso_success", { upn: userPayload.upn });
  res.json({ appJwt });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Lógica de autenticação de usuário (substitua por sua lógica real)
  if (username === "admin" && password === "password") {
    const userPayload = { name: username, roles: ["admin"] };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "1h" });
    track("user_login_success", { username });
    res.json({ token });
  } else {
    track("user_login_failed", { username });
    res.status(401).json({ error: "Credenciais inválidas." });
  }
});

// --- Rotas Protegidas ---

app.post("/api/generate-text", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { originalText, command } = req.body;

  if (!GEMINI_API_KEY || GEMINI_API_KEY === "SUA_CHAVE_API_AQUI") {
    track("error", { type: "configuration_error", message: "API key is not configured" });
    return res.status(500).json({ error: "Erro de configuração no servidor." });
  }

  if (!originalText) {
    return res.status(400).json({ error: "Texto original é obrigatório." });
  }

  const finalCommand = command && command.trim() !== "" ? command : "corrija o texto";

  track("prompt_sent", { command: finalCommand, text_length: originalText.length, user: req.user });

  let startTime: number;
  let firstChunkTime: number | null = null;
  let isFirstChunk = true;
  let streamedContent = "";

  try {
    startTime = Date.now();
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { temperature: 0 },
    });

    const instructions = `Você é um serviço de API que fornece suporte a textos. Voce ajuda a corrigir, traduzir, resumir, reescrever e melhorar textos.
      Você nunca fornece explicações ou da a sua opinião, exceto quando pedirem para voce expandir ou melhorar um texto. 
      Sua resposta deve conter **somente o texto corrigido**, sem explicações, sem formatação, sem cabeçalhos e sem qualquer palavra.  

      comando: ${finalCommand}

      TEXTO ORIGINAL: ${originalText}  
      TEXTO CORRIGIDO:
    `;

    const prompt = instructions;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      if (isFirstChunk) {
        firstChunkTime = Date.now();
        track("ai_first_chunk_received", { duration: firstChunkTime - startTime });
        isFirstChunk = false;
      }
      const chunkText = chunk.text();
      streamedContent += chunkText;
      res.write(chunkText);
    }

    const endTime = Date.now();
    track("ai_full_response_received", {
      duration: endTime - startTime,
      response_length: streamedContent.length,
      first_chunk_duration: firstChunkTime ? firstChunkTime - startTime : null,
    });

    res.end();
  } catch (error) {
    console.error("Erro ao chamar a API de IA no backend:", error);
    if (error instanceof Error) {
      track("error", { type: "api_error", message: error.message });
    } else {
      track("error", { type: "api_error", message: String(error) });
    }
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Servidor backend rodando em http://localhost:${port}`);
});
