import { generateTextStream } from "./aiService.ts";
import { extensionRegistry } from "./extensionRegistry.ts";

export interface AgentManifest {
  id: string;
  system: string;
  temperature: number;
  allowedTools: string[];
  schema: object;
  model?: string; // Default model for this agent
}

export interface AgentResponse {
  thought_process: string;
  action_payload: any;
}

export interface AgentCustomization {
  baseAgentId: string;
  model?: string;
  temperature?: number;
  systemOverride?: string;
  additionalConstraints?: string[];
}

export interface AgentPack {
  id: string;
  label: string;
  agents: string[]; // IDs of agents in this pack
}

// --- Core Agents Registry ---
const CORE_AGENTS: Record<string, AgentManifest> = {
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

export const agentsService = {
  getAgent: (agentId: string): AgentManifest | undefined => {
    const allAgents = { ...CORE_AGENTS, ...extensionRegistry.getAgents() };

    // Exact match
    if (allAgents[agentId]) return allAgents[agentId];

    // Case insensitive
    const lowerId = agentId.toLowerCase();
    if (allAgents[lowerId]) return allAgents[lowerId];

    // Prefix match
    const prefixedId = `wing.user.${lowerId}`;
    if (allAgents[prefixedId]) return allAgents[prefixedId];

    // Suffix/Partial match
    const foundId = Object.keys(allAgents).find(
      (key) =>
        key.toLowerCase().endsWith(agentId.toLowerCase()) ||
        key.toLowerCase().includes(agentId.toLowerCase())
    );
    if (foundId) return allAgents[foundId];

    return undefined;
  },

  executeAgent: async (
    agentId: string,
    instruction: string,
    context: string[],
    customization?: AgentCustomization
  ): Promise<AgentResponse> => {
    let agent = agentsService.getAgent(agentId);

    if (!agent) {
      throw new Error(`Agent '${agentId}' not found.`);
    }

    // Apply Customizations
    const model = customization?.model || agent.model;
    const temperature = customization?.temperature ?? agent.temperature;
    let systemPrompt = customization?.systemOverride || agent.system;

    if (
      customization?.additionalConstraints &&
      customization.additionalConstraints.length > 0
    ) {
      systemPrompt += `\nADDITIONAL CONSTRAINTS:\n- ${customization.additionalConstraints.join(
        "\n- "
      )}`;
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
      const stream = generateTextStream(`${systemPrompt}\n\n${prompt}`, {
        model,
        temperature,
        systemInstruction: systemPrompt, // Some providers support system instruction separate from prompt
      });

      for await (const chunk of stream) {
        fullResponse += chunk;
      }

      console.log(`[Agents] Raw LLM Response for ${agentId}:`, fullResponse);

      // Robust JSON Extraction
      let jsonStr = fullResponse.trim();
      jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "");
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else if (
        jsonStr.includes('"thought_process"') ||
        jsonStr.includes("thought_process")
      ) {
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
