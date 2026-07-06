import { maestroClient, PlanResponse, PlanStep } from "./maestroClient";
import { queryText } from "./wingMemoryEngine";
import { documentObserver } from "./documentObserver";
import { parseMarkdown } from "../utils/markdownParser";

// We need to define the Agent API client here since it wasn't created in frontend yet.
// In a real scenario, this would be in a separate service file.
const API_BASE_URL = "/api";
import { sanitizer } from "./sanitizer";

interface AgentResponse {
  thought_process: string;
  action_payload: any;
}

const executeAgent = async (
  agentId: string,
  instruction: string,
  context: string[]
): Promise<AgentResponse> => {
  const response = await fetch(`${API_BASE_URL}/agent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, instruction, context }),
  });

  if (!response.ok) {
    throw new Error(`Agent execution failed: ${response.statusText}`);
  }

  return await response.json();
};

export const orchestrator = {
  generatePlan: async (
    instruction: string,
    options?: {
      availableAgents?: string[];
      availableTools?: string[];
      availableModels?: string[];
    }
  ): Promise<PlanResponse> => {
    // 1. Sync memory to ensure we have latest context
    await documentObserver.syncDocument();

    // 2. Query the memory engine for context relevant to the instruction.
    // If the engine failed to initialize (e.g. model assets unavailable),
    // proceed without semantic context rather than failing plan generation.
    let contextStrings: string[] = [];
    try {
      const contextResults: any[] = queryText(instruction, 5) as any[];
      contextStrings = contextResults.map((c) => c.text);
    } catch (e) {
      console.warn("[Orchestrator] Semantic context unavailable, proceeding without it:", e);
    }

    return await maestroClient.requestPlan(instruction, contextStrings, options);
  },

  executePlan: async (
    plan: PlanResponse,
    onLog: (msg: string, type: "info" | "success" | "error" | "warning") => void,
    onStepChange?: (stepIndex: number) => void,
    startFromStep: number = 0
  ) => {
    onLog(`Starting execution from step ${startFromStep + 1}...`, "info");

    for (let i = startFromStep; i < plan.plan.length; i++) {
      const step = plan.plan[i];
      if (onStepChange) onStepChange(i);

      onLog(`Step ${step.stepId}: [${step.agentId}] ${step.topic}`, "info");

      try {
        // SPECIAL CASE: System / Create Agent
        if (step.agentId === "System" || step.type === "create_agent") {
          onLog(`[System] Detected request to create agent...`, "info");

          // Simple parsing logic for V1
          // Expected format: "Create a new agent named [Name] with expertise in [Topic]..."
          const nameMatch = step.description.match(/named\s+["']?([^"'\s]+)["']?/i);
          const topicMatch = step.description.match(/expertise in\s+(.*)/i);

          if (nameMatch) {
            const name = nameMatch[1];
            const topic = topicMatch ? topicMatch[1] : "General tasks";
            const systemPrompt = `You are ${name}, an expert in ${topic}. Your goal is to assist the user with high quality analysis and content generation related to your expertise.`;

            onLog(`[System] Creating agent '${name}'...`, "info");

            // Call API to create agent
            const createRes = await fetch(`${API_BASE_URL}/extensions/agent`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, category: "Dynamic", systemPrompt }),
            });

            if (createRes.ok) {
              onLog(`[System] Agent '${name}' created successfully!`, "success");
            } else {
              onLog(`[System] Failed to create agent: ${createRes.statusText}`, "error");
              throw new Error("Failed to create agent");
            }
          } else {
            onLog(`[System] Could not parse agent name from description.`, "warning");
          }
          continue; // Skip the rest of the loop for this step
        }

        // 1. Retrieve Context based on Agent Type (Context Strategy)
        onLog("Retrieving context...", "info");
        let contextStrings: string[] = [];

        const simpleAgents = ["Translate", "Fix"];
        const isSimpleAgent = simpleAgents.some((a) => step.agentId.includes(a));

        if (isSimpleAgent) {
          // Simple Strategy: Use current selection (or a placeholder if Word is not available)
          onLog(`[Strategy] Simple Agent detected. Using current selection.`, "info");
          try {
            // We need to get the selection text. Since we are inside a loop and Word.run is async,
            // we should probably fetch this before or inside a Word.run block.
            // For simplicity in this V1, let's assume we want the *current* selection at the moment of execution.
            await Word.run(async (context) => {
              const selection = context.document.getSelection();
              selection.load("text");
              await context.sync();
              if (selection.text) {
                contextStrings = [selection.text];
              }
            });
          } catch (e) {
            console.warn(
              "Word API not available or failed, using empty context for simple agent.",
              e
            );
            contextStrings = ["(No selection available - Dev Mode)"];
          }
        } else {
          // Complex Strategy: Use WASM Engine
          onLog(`[Strategy] Complex Agent detected. Using WASM Engine.`, "info");
          try {
            const contextResults: any[] = queryText(step.description, 5) as any[];
            contextStrings = contextResults.map((c) => c.text);
          } catch (e) {
            console.warn("[Orchestrator] Semantic context unavailable, proceeding without it:", e);
          }
        }

        // 2. Call Agent
        onLog(`Calling agent ${step.agentId}...`, "info");
        const agentRes = await executeAgent(step.agentId, step.description, contextStrings);

        onLog(`Agent thought: ${agentRes.thought_process}`, "info");

        // 3. Apply to Word (Action Payload)
        const payload = agentRes.action_payload;
        if (payload && payload.type && payload.type !== "none") {
          await Word.run(async (context) => {
            const selection = context.document.getSelection();

            // Convert Markdown to HTML
            const htmlContent = parseMarkdown(payload.content);

            if (payload.type === "insert") {
              selection.insertHtml(htmlContent, Word.InsertLocation.end);
            } else if (payload.type === "replace") {
              selection.insertHtml(htmlContent, Word.InsertLocation.replace);
            } else if (payload.type === "comment") {
              // Comments are plain text usually, but let's see if we can use the raw content or stripped.
              // Word comments support some formatting but insertComment takes string.
              // Let's strip HTML for comments or just use raw content (it was markdown).
              selection.insertComment(payload.content);
            }

            await context.sync();
          });
          onLog(`Action performed: ${payload.type}`, "success");

          // Sync WASM Engine with new content
          onLog("Syncing memory with document updates...", "info");
          await documentObserver.syncDocument();
        } else {
          onLog("No document action performed.", "info");
        }
      } catch (error: any) {
        // LAZY CREATION FALLBACK
        // If the agent is not found, try to create it on the fly based on the step description.
        if (error.message && error.message.includes("not found")) {
          onLog(
            `[Orchestrator] Agent '${step.agentId}' not found. Attempting lazy creation...`,
            "warning"
          );

          try {
            const name = step.agentId;
            // Use the step description as the basis for the expertise
            const topic = step.description;
            const systemPrompt = `You are ${name}. Your goal is to assist the user by performing the following task: ${topic}. You are an expert in this field.`;

            onLog(`[Orchestrator] Lazy creating agent '${name}'...`, "info");

            const createRes = await fetch(`${API_BASE_URL}/extensions/agent`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, category: "LazyCreated", systemPrompt }),
            });

            if (createRes.ok) {
              onLog(`[Orchestrator] Agent '${name}' created! Retrying step...`, "success");
              // Retry the step by decrementing index so the loop hits it again
              i--;
              continue;
            } else {
              onLog(`[Orchestrator] Failed to lazy create agent: ${createRes.statusText}`, "error");
            }
          } catch (createError) {
            onLog(`[Orchestrator] Lazy creation failed: ${createError}`, "error");
          }
        }

        onLog(`Step failed: ${error}`, "error");
        throw { stepIndex: i, error }; // Throw object with step index to allow resuming
      }
    }

    onLog("Execution completed successfully.", "success");
  },
};
