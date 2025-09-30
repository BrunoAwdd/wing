import * as React from "react";
import { makeStyles, Input, Button, shorthands } from "@fluentui/react-components";
import { Send24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
  },
  presetContainer: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap("8px"),
  },
  commandConsole: {
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
  },
});

interface CommandConsoleProps {
  command: string;
  onCommandChange: (newCommand: string) => void;
  onCommandSend: () => void;
  onPresetSelect: (presetCommand: string) => void; // Nova prop para presets
}

const CommandConsole: React.FC<CommandConsoleProps> = ({ command, onCommandChange, onCommandSend, onPresetSelect }) => {
  const styles = useStyles();

  return (
    <div className={styles.wrapper}>
      <div className={styles.presetContainer}>
        <Button appearance="outline" onClick={() => onPresetSelect("Corrija a gramática e ortografia")}>
          Corrigir
        </Button>
        <Button appearance="outline" onClick={() => onPresetSelect("Resuma em 3 pontos principais")}>
          Resumir
        </Button>
        <Button appearance="outline" onClick={() => onPresetSelect("Traduza para Inglês")}>
          Traduzir para Inglês
        </Button>
      </div>
      <div className={styles.commandConsole}>
        <Input
          className={styles.input}
          placeholder='Ou digite um comando personalizado...'
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCommandSend()}
          contentAfter={
            <Button
              icon={<Send24Regular />}
              appearance="transparent"
              onClick={onCommandSend}
              aria-label="Enviar"
            />
          }
        />
      </div>
    </div>
  );
};

export default CommandConsole;