import * as React from "react";
import { useState } from "react";
import { Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useWingState } from "../hooks/useWingState";
import { orchestrator } from "../../services/orchestrator";
import StatusBar, { LogEntry } from "./StatusBar";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
  },
  textarea: {
    width: "100%",
    height: "100px",
    marginBottom: "10px",
    fontFamily: "sans-serif",
  },
  logContainer: {
    height: "300px",
    overflowY: "auto",
    background: "#f0f0f0",
    padding: "10px",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: "monospace",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    marginTop: "10px",
  },
});

interface CopilotPageProps {
  onBack: () => void;
  agents?: any[];
}

const CopilotPage: React.FC<CopilotPageProps> = ({ onBack, agents = [] }) => {
  const styles = useStyles();
  const {
    state,
    setState,
    plan,
    setPlan,
    logs,
    addLog,
    error,
    setError,
    reset,
    currentStepIndex,
    setCurrentStepIndex,
  } = useWingState();
  const [instruction, setInstruction] = useState("");

  const handleGeneratePlan = async () => {
    if (!instruction) return;
    setState("Planning");
    addLog("Generating plan...", "info");
    try {
      const newPlan = await orchestrator.generatePlan(instruction);
      setPlan(newPlan);
      setState("PlanReady");
      addLog(`Plan generated with ${newPlan.estimatedSteps} steps.`, "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate plan");
      setState("Error");
      addLog("Plan generation failed.", "error");
    }
  };

  const handleExecutePlan = async (startFromStep: number = 0) => {
    if (!plan) return;
    setState("Executing");
    try {
      await orchestrator.executePlan(
        plan,
        (msg, type) => addLog(msg, type as any),
        (stepIndex) => setCurrentStepIndex(stepIndex),
        startFromStep
      );
      setState("Completed");
    } catch (e: any) {
      // If error object has stepIndex, use it. Otherwise keep current.
      if (e.stepIndex !== undefined) {
        setCurrentStepIndex(e.stepIndex);
      }
      setError(e.error instanceof Error ? e.error.message : String(e.error || e));
      setState("Error");
    }
  };

  const renderContent = () => {
    switch (state) {
      case "Idle":
        return (
          <div>
            <h3>Wing Copilot</h3>
            <p>Describe your task and I will create a plan for you.</p>
            <textarea
              className={styles.textarea}
              placeholder="Ex: Analyze this contract for risks..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className={styles.buttonGroup}>
              <button onClick={handleGeneratePlan} disabled={!instruction}>
                Generate Plan
              </button>
              <button onClick={onBack}>Back</button>
            </div>

            {agents.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <h4>Available Agents ({agents.length})</h4>
                <ul style={{ fontSize: "12px", paddingLeft: "20px" }}>
                  {agents.map((agent) => (
                    <li key={agent.id}>
                      <strong>{agent.config?.visibleName || agent.id}</strong> ({agent.type})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      // ... (rest of cases)
      case "Planning":
        return (
          <div className={styles.loading}>
            <Spinner />
            <p>Maestro is planning...</p>
          </div>
        );
      case "PlanReady":
        return (
          <div>
            <h3>Plan Review</h3>
            <p>
              <strong>Justification:</strong> {plan?.justification}
            </p>
            <ul>
              {plan?.plan.map((step) => (
                <li key={step.stepId}>
                  <strong>{step.agentId}:</strong> {step.topic}
                </li>
              ))}
            </ul>
            <div className={styles.buttonGroup}>
              <button onClick={() => handleExecutePlan()}>Execute Plan</button>
              <button onClick={() => setState("Idle")}>Cancel</button>
            </div>
          </div>
        );
      case "Executing":
        return (
          <div>
            <h3>Executing...</h3>
            <div className={styles.logContainer}>
              {logs.map((log, i) => (
                <div key={i} style={{ color: log.type === "error" ? "red" : "black" }}>
                  [{log.timestamp}] {log.message}
                </div>
              ))}
            </div>
          </div>
        );
      case "Completed":
        return (
          <div>
            <h3>Task Completed!</h3>
            <div className={styles.buttonGroup}>
              <button onClick={reset}>New Task</button>
              <button onClick={onBack}>Back to Main</button>
            </div>
          </div>
        );
      case "Error":
        return (
          <div style={{ color: "red" }}>
            <h3>Error</h3>
            <p>{error}</p>
            <div className={styles.buttonGroup}>
              {plan && currentStepIndex < plan.plan.length && (
                <button onClick={() => handleExecutePlan(currentStepIndex)}>
                  Resume from Step {currentStepIndex + 1}
                </button>
              )}
              <button onClick={reset}>New Task</button>
              <button onClick={onBack}>Back</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.content}>{renderContent()}</div>
      <StatusBar
        logs={logs.map((l) => ({ message: l.message, type: l.type as any, time: l.timestamp }))}
      />
    </div>
  );
};

export default CopilotPage;
