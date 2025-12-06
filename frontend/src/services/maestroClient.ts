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

const API_BASE_URL = "/api";

export const maestroClient = {
  requestPlan: async (
    instruction: string, 
    context: string[],
    options?: {
      availableAgents?: string[];
      availableTools?: string[];
      availableModels?: string[];
    }
  ): Promise<PlanResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/maestro/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instruction, context, options }),
      });

      if (!response.ok) {
        throw new Error(`Maestro API error: ${response.statusText}`);
      }

      const data: PlanResponse = await response.json();
      return data;
    } catch (error) {
      console.error("[MaestroClient] Failed to request plan:", error);
      throw error;
    }
  },
};
