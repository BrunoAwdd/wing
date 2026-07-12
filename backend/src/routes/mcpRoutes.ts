import { Router, Context } from "https://deno.land/x/oak@v16.1.0/mod.ts";
import { extensionRegistry } from "../services/extensionRegistry.ts";
import { agentsService, AgentResponse } from "../services/agentsService.ts";
import logger from "../services/logger.ts";

const mcpRouter = new Router();

// Middleware de Autenticação Simples (API Key via Header)
const authMiddleware = async (ctx: Context, next: () => Promise<unknown>) => {
    const apiKey = ctx.request.headers.get("x-mcp-key");
    // TODO: Validar contra uma chave configurada no ENV ou DB
    // Por enquanto, aceita qualquer chave em DEV ou uma hardcoded "wing-mcp-secret"
    const validKey = Deno.env.get("MCP_API_KEY") || "wing-mcp-secret";

    if (apiKey !== validKey) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Unauthorized: Invalid x-mcp-key" };
        return;
    }
    await next();
};

mcpRouter.use(authMiddleware);

// 1. List Available Agents
mcpRouter.get("/agents", (ctx: Context) => {
    try {
        const agents = extensionRegistry.getAgents();
        // Transform to simple list for client
        const agentList = Object.values(agents).map(agent => ({
            id: agent.id,
            name: (agent as any).config?.visibleName || agent.id, // Defensive: fallback to ID
            description: (agent as any).config?.manifest?.system_prompt?.slice(0, 100) + "..." || "No description",
            category: (agent as any).config?.category || "General"
        }));

        ctx.response.body = agentList;
    } catch (error) {
        logger.error(`[MCP] Failed to list agents: ${error}`);
        ctx.response.status = 500;
        ctx.response.body = { error: "Failed to list agents" };
    }
});

// 2. Execute Agent
mcpRouter.post("/agent/execute", async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { agentId, instruction, context } = body;

        if (!agentId || !instruction) {
            ctx.response.status = 400;
            ctx.response.body = { error: "agentId and instruction are required" };
            return;
        }

        logger.info(`[MCP] Executing agent ${agentId} via remote client`);

        const response: AgentResponse = await agentsService.executeAgent(
            agentId,
            instruction,
            context || []
        );

        ctx.response.body = response;
    } catch (error) {
        logger.error(`[MCP] Agent execution error: ${error}`);
        ctx.response.status = 500;
        ctx.response.body = {
            error: error instanceof Error ? error.message : "Failed to execute agent via MCP",
        };
    }
});

// 3. Get Logs (Simple recent logs implementation)
// Note: This assumes logger writes to stdout/file. 
// Ideally we'd have an in-memory buffer or read from a file.
// For MVP, we will return a static message or hook if possible.
// Let's check logger.ts content first? Assuming standard impl for now.
mcpRouter.get("/logs", async (ctx: Context) => {
    // Placeholder: In a real scenario, we'd read tail of log file or memory buffer
    ctx.response.body = {
        logs: [
            { timestamp: new Date().toISOString(), level: "INFO", message: "MCP Log access check" }
        ]
    };
});

export default mcpRouter;
