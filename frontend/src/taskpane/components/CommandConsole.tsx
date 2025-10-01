import * as React from "react";
import { makeStyles, Input, Button, shorthands } from "@fluentui/react-components";
import { Send24Regular, Settings24Regular } from "@fluentui/react-icons";
import Settings from "./Settings";

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
  onPresetSelect: (presetCommand: string) => void;
  // Props para o painel de configurações
  tone: string;
  language: string;
  onToneChange: (tone: string) => void;
  onLanguageChange: (language: string) => void;
}

const CommandConsole: React.FC<CommandConsoleProps> = ({ 
  command, 
  onCommandChange, 
  onCommandSend, 
  onPresetSelect, 
  tone,
  language,
  onToneChange,
  onLanguageChange
}) => {
  const styles = useStyles();
  const [isSettingsVisible, setIsSettingsVisible] = React.useState(false);

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
                onClick={() => setIsSettingsVisible(!isSettingsVisible)}
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
      {isSettingsVisible && (
        <Settings 
          tone={tone} 
          language={language} 
          onToneChange={onToneChange} 
          onLanguageChange={onLanguageChange} 
        />
      )}
    </div>
  );
};

export default CommandConsole;