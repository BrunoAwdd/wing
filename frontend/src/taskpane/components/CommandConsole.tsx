import * as React from "react";
import { makeStyles, Input, Button, shorthands } from "@fluentui/react-components";
import { Send24Regular, Settings24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    ...shorthands.padding("0px", "16px", "16px", "16px"), // Adicionado padding para separar da parte de baixo
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
  onPresetSelect: (presetCommand: string) => void;
  onShowSettings: () => void; // Nova prop para mostrar as configurações
}

const CommandConsole: React.FC<CommandConsoleProps> = ({ 
  command, 
  onCommandChange, 
  onCommandSend, 
  onPresetSelect, 
  onShowSettings
}) => {
  const styles = useStyles();

  return (
    <div className={styles.wrapper}>
      <div className={styles.presetContainer}>
        <Button appearance="outline" onClick={() => onPresetSelect("fix")}>
          Corrigir
        </Button>
        <Button appearance="outline" onClick={() => onPresetSelect("summarize")}>
          Resumir
        </Button>
        <Button appearance="outline" onClick={() => onPresetSelect("translate")}>
          Traduzir
        </Button>
        <Button appearance="outline" onClick={() => onPresetSelect("rewrite")}>
          Reescrever
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
            <>
              <Button
                icon={<Settings24Regular />}
                appearance="transparent"
                onClick={onShowSettings} // Apenas chama a função
                aria-label="Configurações"
              />
              <Button
                icon={<Send24Regular />}
                appearance="transparent"
                onClick={onCommandSend}
                aria-label="Enviar"
              />
            </>
          }
        />
      </div>
    </div>
  );
};

export default CommandConsole;
