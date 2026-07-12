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
    let model = customization?.model || agent.model;

    // HOTFIX: 'gemini-pro' is deprecated/404 on v1beta. Force default if encountered.
    if (model === "gemini-pro") {
      console.warn(
        `[Agents] Model 'gemini-pro' is deprecated. Falling back to default provider model.`
      );
      model = undefined;
    }
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
- **ESCAPE NEWLINES**: If the "content" field has multiple lines, you MUST escape them as "\\n" (backslash n). Do NOT print literal newlines inside the JSON string.
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

      // 1. Try to find the first block ```json ... ```
      const markdownMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/i);
      if (markdownMatch) {
        jsonStr = markdownMatch[1];
      } else {
        // 2. Try to find just ``` ... ```
        const blockMatch = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
        if (blockMatch) {
          jsonStr = blockMatch[1];
        }
      }

      // 3. Fallback: Find the first { and the last }
      const firstBrace = jsonStr.indexOf("{");
      const lastBrace = jsonStr.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      } else if (
        jsonStr.includes('"thought_process"') ||
        jsonStr.includes("thought_process")
      ) {
        console.warn("[Agents] No outer braces found. Wrapping in {}.");
        jsonStr = `{${jsonStr}}`;
      }

      let response: AgentResponse;
      try {
        // Try standard build-in JSON parse first
        response = JSON.parse(jsonStr);
      } catch (e: any) {
        console.warn("[Agents] Standard JSON parse failed. Trying JSON5...", e.message);
        try {
          // @ts-ignore: JSON5 imported from deps
          const { JSON5 } = await import("../deps.ts");
          response = JSON5.parse(jsonStr) as AgentResponse;
        } catch (json5Error: any) {
          console.error("[Agents] JSON5 Parse Failed.", json5Error);
          throw new Error(
            `Failed to parse JSON: ${e.message} / ${json5Error.message}. Raw: ${fullResponse}`
          );
        }
      }
      return response;
    } catch (error) {
      console.error(`[Agents] Failed to execute agent ${agentId}:`, error);
      throw new Error(`Failed to execute agent ${agentId}`);
    }
  },
};
