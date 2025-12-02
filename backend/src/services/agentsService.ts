import { generateTextStream } from "./aiService.ts";

export interface AgentManifest {
  id: string;
  system: string;
  temperature: number;
  allowedTools: string[];
  schema: object;
}

export interface AgentResponse {
  thought_process: string;
  action_payload: any;
}

const AGENT_REGISTRY: Record<string, AgentManifest> = {
  Legal: {
    id: "Legal",
    system: `
You are the Legal Persona of Wing.
FUNCTION: Produce formal, cultured, coherent, and technically precise legal texts.
RULES:
- Never use colloquial language.
- Prioritize clarity, formality, and technical precision.
- Follow Brazilian legal style (CPC / Civil).
- Avoid redundancies.
- Organize arguments logically.
`,
    temperature: 0.1,
    allowedTools: [],
    schema: { thought_process: "string", action_payload: {} },
  },
  Audit: {
    id: "Audit",
    system: `
You are the Audit Persona of Wing.
FUNCTION: Detect inconsistencies, incoherences, omissions, and weaknesses.
RULES:
- Act as an expert auditor.
- Identify conceptual flaws.
- Point out legal and accounting risks.
- NEVER rewrite — only analyze.
`,
    temperature: 0.0,
    allowedTools: [],
    schema: { thought_process: "string", action_payload: {} },
  },
  Writer: {
    id: "Writer",
    system: `
You are the Writer Persona of Wing.
FUNCTION: Transform raw text into a clear, elegant, and sophisticated version.
RULES:
- Use rhythmic language.
- Preserve original meaning.
- Elevate fluidity.
- Do not over-embellish.
`,
    temperature: 0.3,
    allowedTools: [],
    schema: { thought_process: "string", action_payload: {} },
  },
  Critic: {
    id: "Critic",
    system: `
You are the Critic Persona of Wing.
FUNCTION: Evaluate text quality, suggest improvements, identify structural flaws.
RULES:
- Direct tone.
- Identify weaknesses.
- Suggest improvements.
- Do not rewrite completely.
`,
    temperature: 0.2,
    allowedTools: [],
    schema: { thought_process: "string", action_payload: {} },
  },
  Summary: {
    id: "Summary",
    system: `
You are the Summary Persona of Wing.
FUNCTION: Generate objective summaries, preserving concepts and intentions.
RULES:
- Remove redundancies.
- Maintain conceptual precision.
- Never invent facts.
- Focus on clarity.
`,
    temperature: 0.2,
    allowedTools: [],
    schema: { thought_process: "string", action_payload: {} },
  },
};

import { extensionRegistry } from "./extensionRegistry.ts";

export const agentsService = {
  executeAgent: async (
    agentId: string,
    instruction: string,
    context: string[]
  ): Promise<AgentResponse> => {
    // Merge Core Agents with Registry Agents
    const allAgents = { ...AGENT_REGISTRY, ...extensionRegistry.getAgents() };

    // Flexible Lookup Strategy
    let agent = allAgents[agentId];

    if (!agent) {
      // Try lowercase
      const lowerId = agentId.toLowerCase();
      agent = allAgents[lowerId];

      if (!agent) {
        // Try with wing.user. prefix
        const prefixedId = `wing.user.${lowerId}`;
        agent = allAgents[prefixedId];
      }
    }

    if (!agent) {
      // Last resort: search by visible name or suffix
      const foundId = Object.keys(allAgents).find(
        (key) =>
          key.toLowerCase().endsWith(agentId.toLowerCase()) ||
          key.toLowerCase().includes(agentId.toLowerCase())
      );
      if (foundId) {
        agent = allAgents[foundId];
      }
    }

    if (!agent) {
      throw new Error(`Agent '${agentId}' not found.`);
    }

    const prompt = `
AGENT: ${agent.id}
INSTRUCTION: "${instruction}"

CONTEXT:
${context.slice(0, 5).join("\n")}...

OUTPUT FORMAT (JSON ONLY):
{
  "thought_process": "Your reasoning here...",
  "action_payload": {
    "type": "insert" | "replace" | "comment" | "none",
    "content": "The text to insert/replace or the comment body"
  }
}

IMPORTANT:
- If the instruction implies writing, editing, or commenting, YOU MUST populate "action_payload".
- Use "insert" to add new text.
- Use "replace" to rewrite existing text.
- Use "comment" to critique or explain.
- Only use "none" if you cannot perform the action.
- **CONTENT MUST BE NATURAL LANGUAGE (Markdown)**: Do NOT include JSON, code blocks, or the action payload structure inside the "content" field. The "content" is what the user will see in the document.
`;

    try {
      let fullResponse = "";
      // We use the stream but buffer it to get the full JSON.
      // Note: Temperature control is not directly exposed in generateTextStream in this V1,
      // but the System Prompt heavily influences the behavior.
      const stream = generateTextStream(`${agent.system}\n\n${prompt}`, "Free");

      for await (const chunk of stream) {
        fullResponse += chunk;
      }

      console.log(`[Agents] Raw LLM Response for ${agentId}:`, fullResponse);

      // Robust JSON Extraction
      let jsonStr = fullResponse.trim();

      // 1. Remove Markdown code blocks
      jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "");

      // 2. Extract JSON object if there's extra text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else if (jsonStr.includes('"thought_process"') || jsonStr.includes("thought_process")) {
        // Fallback: If no outer braces but contains keys, try wrapping
        console.warn("[Agents] No outer braces found. Wrapping in {}.");
        jsonStr = `{${jsonStr}}`;
      }

      let response: AgentResponse;
      try {
        response = JSON.parse(jsonStr);
      } catch (e: any) {
        console.warn(
          "[Agents] JSON Parse Failed. Attempting to fix common errors..."
        );
        // Fallback: Try to fix unquoted keys (simple heuristic) or just throw
        // For now, let's just throw but with the raw response for debugging
        throw new Error(
          `Failed to parse JSON: ${e.message}. Raw: ${fullResponse}`
        );
      }
      return response;
    } catch (error) {
      console.error(`[Agents] Failed to execute agent ${agentId}:`, error);
      throw new Error(`Failed to execute agent ${agentId}`);
    }
  },
};
