import { useState } from "react";
import { PlanResponse } from "../../services/maestroClient";

export type WingState = "Idle" | "Planning" | "PlanReady" | "Executing" | "Completed" | "Error";

export interface LogEntry {
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: string;
}

export const useWingState = () => {
  const [state, setState] = useState<WingState>("Idle");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { message, type, timestamp }]);
  };

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const reset = () => {
    setState("Idle");
    setPlan(null);
    setLogs([]);
    setError(null);
    setCurrentStepIndex(0);
  };

  return {
    state,
    setState,
    plan,
    setPlan,
    logs,
    addLog,
    error,
    setError,
    currentStepIndex,
    setCurrentStepIndex,
    reset,
  };
};
