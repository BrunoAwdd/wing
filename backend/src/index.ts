import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { track } from "./services/telemetry";
import logger from "./services/logger";
import apiRouter from "./routes/api.routes";
import chatRouter from "./routes/chat.routes";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não está definido nas variáveis de ambiente.");
}

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Tipos e Interfaces ---
interface AuthenticatedRequest extends Request {
  user?: string | jwt.JwtPayload;
}

// --- Middleware de Autenticação JWT (Exemplo, não usado pelas rotas de IA) ---
const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

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

// --- Rotas Públicas de Autenticação ---
app.post("/auth/office", async (req, res) => {
  const { msToken } = req.body;
  if (!msToken) {
    return res.status(400).json({ error: "msToken não fornecido." });
  }
  // Lógica de validação do msToken e geração do appJwt...
  const userPayload = { sub: "user-id-from-ms-token", upn: "user@example.com" };
  const appJwt = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "15m" });
  track("office_sso_success", { upn: userPayload.upn });
  res.json({ appJwt });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
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

// --- Rotas Protegidas da API v1 ---
app.use("/api/v1", apiRouter);
app.use("/api/v1/chat", chatRouter);

// --- Inicialização do Servidor ---
app.listen(port, () => {
  logger.info(`Servidor backend rodando em http://localhost:${port}`);
});