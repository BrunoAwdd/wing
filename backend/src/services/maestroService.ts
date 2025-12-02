import { generateTextStream } from "./aiService.ts";
import { extensionRegistry } from "./extensionRegistry.ts";
import { SYSTEM_TOOLS_MANIFEST } from "./systemCapabilities.ts";

export interface PlanStep {
  stepId: number;
  agentId: string;
  topic: string;
  type: string;
  description: string;
}

export interface PlanResponse {
  plan: PlanStep[];
  justification: string;
  estimatedSteps: number;
}

const BASE_SYSTEM_PROMPT = `
You are the Maestro Planner, the central orchestrator of the Wing system.
Your goal is to transform a user instruction into a linear, deterministic execution plan.

SYSTEM CAPABILITIES (API):
The following tools are available in the system. You should use this information to understand what is possible.
{{SYSTEM_TOOLS_JSON}}

AVAILABLE AGENTS:
{{AGENTS_LIST}}

OUTPUT FORMAT:
You must output a valid JSON object with the following structure:
{
  "plan": [
    {
      "stepId": 0,
      "agentId": "AgentName",
      "topic": "Brief topic",
      "type": "action_type",
      "description": "Detailed description"
    }
  ],
  "justification": "Brief explanation of the plan",
  "estimatedSteps": 3
}

RULES:
1. The plan must be linear (no loops).
2. The plan must be logical and efficient.
3. Do not include any text outside the JSON object.
4. "type" should be one of: "analysis", "rewrite", "review", "translation", "correction", "create_agent".
5. Use the exact "AgentName" from the AVAILABLE AGENTS list.
6. **CRITICAL (Autonomous Agent Creation)**: If the task requires deep expertise in a specific domain (e.g., Psychology, Medicine, Advanced Engineering, Niche Law) and no suitable agent exists in AVAILABLE AGENTS, you MUST proactively create a specialist.
   - Do not wait for the user to ask for a "persona". Infer the need from the task complexity.
   - To create an agent, assign the first step to agentId "System" with a description following this EXACT pattern: "Create a new agent named [Name] with expertise in [Topic]...".
   - Example: If the user says "Analyze this using Jungian psychology", and you don't have a psychologist, create one: "Create a new agent named JungianAnalyst with expertise in Jungian Psychology and Archetypes...".
`;

export const maestroService = {
  generatePlan: async (
    instruction: string,
    context: string[]
  ): Promise<PlanResponse> => {
    // 1. Fetch Dynamic Agents
    const agents = extensionRegistry.getAgents();
    const agentsListStr = Object.values(agents)
      .map((agent: any) => {
        const name = agent.config?.visibleName || agent.id;
        const desc =
          agent.config?.manifest?.system_prompt?.slice(0, 100) ||
          agent.config?.category ||
          "General Agent";
        return `- "${name}": ${desc.replace(/\n/g, " ")}...`;
      })
      .join("\n");

    // 2. Inject into Prompt
    let systemPrompt = BASE_SYSTEM_PROMPT.replace(
      "{{AGENTS_LIST}}",
      agentsListStr
    );
    systemPrompt = systemPrompt.replace(
      "{{SYSTEM_TOOLS_JSON}}",
      JSON.stringify(SYSTEM_TOOLS_MANIFEST, null, 2)
    );

    const prompt = `
USER INSTRUCTION: "${instruction}"

CONTEXT SUMMARY:
${context.slice(0, 5).join("\n")}... (truncated)

Generate the execution plan now.
`;

    try {
      let fullResponse = "";
      // Using generateTextStream but buffering the response since we need the full JSON.
      // In a production environment, we might want to parse this incrementally or use a non-streaming endpoint.
      const stream = generateTextStream(
        `${systemPrompt}\n\n${prompt}`,
        "Free" // Use Free entitlement for Flash model
      );

      for await (const chunk of stream) {
        fullResponse += chunk;
      }

      // Clean up response (remove markdown code blocks if present)
      const jsonStr = fullResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const planResponse: PlanResponse = JSON.parse(jsonStr);
      return planResponse;
    } catch (error) {
      console.error("[Maestro] Failed to generate plan:", error);
      throw new Error("Failed to generate plan");
    }
  },
};
