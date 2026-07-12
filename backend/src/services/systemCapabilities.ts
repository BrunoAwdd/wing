export interface SystemTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const SYSTEM_TOOLS_MANIFEST: SystemTool[] = [
  {
    name: "get_agents",
    description:
      "Retrieve a list of all available agents in the system, including their capabilities and IDs.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_agent",
    description: "Create a new agent with a specific persona and capabilities.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the new agent.",
        },
        category: {
          type: "string",
          description: "The category of the agent (e.g., Legal, Creative).",
        },
        system_prompt: {
          type: "string",
          description:
            "The system prompt defining the agent's behavior and persona.",
        },
      },
      required: ["name", "system_prompt"],
    },
  },
  {
    name: "read_document",
    description:
      "Read the content of the current active document or a specific section.",
    parameters: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "The section to read (optional).",
        },
      },
      required: [],
    },
  },
  {
    name: "execute_agent",
    description: "Execute a specific agent with an instruction and context.",
    parameters: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "The ID of the agent to execute.",
        },
        instruction: {
          type: "string",
          description: "The instruction for the agent.",
        },
        context: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Contextual information for the agent.",
        },
      },
      required: ["agentId", "instruction"],
    },
  },
];
