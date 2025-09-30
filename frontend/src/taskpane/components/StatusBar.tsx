import * as React from "react";
import { useState } from "react";
import { makeStyles, tokens, Text, shorthands } from "@fluentui/react-components";
import { ChevronDown20Regular, ChevronRight20Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    marginBottom: "16px",
  },
  statusArea: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    minHeight: "20px",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  logList: {
    maxHeight: "100px",
    overflowY: "auto",
    ...shorthands.padding("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    marginTop: "8px",
  },
  logEntry: {
    fontFamily: "monospace",
    fontSize: "12px",
    display: "block",
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
  success: {
    color: tokens.colorPaletteGreenForeground1,
  },
  info: {
    color: tokens.colorNeutralForeground1,
  },
});

export interface LogEntry {
  message: string;
  type: "info" | "success" | "error";
  time: string;
}

interface StatusBarProps {
  logs: LogEntry[];
}

const StatusBar: React.FC<StatusBarProps> = ({ logs }) => {
  const styles = useStyles();
  const [isOpen, setIsOpen] = useState(false);

  const latestLog = logs[logs.length - 1] || { message: "Pronto", type: "info", time: "" };

  const getLogStyle = (type: LogEntry["type"]) => {
    if (type === "error") return styles.error;
    if (type === "success") return styles.success;
    return styles.info;
  };

  return (
    <div className={styles.root}>
      <div className={styles.statusArea} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
        <Text size={200} className={getLogStyle(latestLog.type)}>
          {latestLog.message}
        </Text>
      </div>
      {isOpen && (
        <div className={styles.logList}>
          {[...logs].reverse().map((log, index) => (
            <Text as="span" key={index} className={`${styles.logEntry} ${getLogStyle(log.type)}`}>
              [{log.time}] {log.message}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusBar;