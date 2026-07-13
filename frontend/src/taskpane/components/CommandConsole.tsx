import * as React from "react";
import {
  makeStyles,
  tokens,
  Input,
  Button,
  shorthands,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Settings24Regular,
  History24Regular,
  ArrowSyncCheckmark24Regular,
  ChevronDown16Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    ...shorthands.padding("0px", "16px", "16px", "16px"), // Adicionado padding para separar da parte de baixo
  },
  // RFC 014 §4: as quatro ações principais do produto — Revisar, Traduzir,
  // Resumir, Fale com o documento. Ficam em destaque (appearance="primary").
  presetContainer: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap("8px"),
  },
  // Recursos de suporte (memória, e features incubadas quando ligadas) —
  // visualmente secundários, não competem com as 4 ações principais.
  supportContainer: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    ...shorthands.gap("8px"),
    fontSize: tokens.fontSizeBase200,
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
  onShowSettings: () => void;
  onStartAnalysis: () => void; // "Fale com o documento" (RFC 014 §4)
  onShowHistory: () => void;
  onShowLastUpdates: () => void;
  onSyncMemory: () => void;
  // Undefined quando a feature está desligada (RFC 013) — o botão nem
  // renderiza, em vez de renderizar desabilitado.
  onShowLegalAnalysis?: () => void;
  onShowDocumentDesign?: () => void;
}

const CommandConsole: React.FC<CommandConsoleProps> = ({
  command,
  onCommandChange,
  onCommandSend,
  onPresetSelect,
  onShowSettings,
  onStartAnalysis,
  onShowHistory,
  onShowLastUpdates,
  onSyncMemory,
  onShowLegalAnalysis,
  onShowDocumentDesign,
}) => {
  const styles = useStyles();

  return (
    <div className={styles.wrapper}>
      <div className={styles.presetContainer}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="primary" icon={<ChevronDown16Regular />} iconPosition="after">
              Revisar
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => onPresetSelect("fix")}>Corrigir</MenuItem>
              <MenuItem onClick={() => onPresetSelect("rewrite")}>Reescrever</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <Button appearance="primary" onClick={() => onPresetSelect("translate")}>
          Traduzir
        </Button>
        <Button appearance="primary" onClick={() => onPresetSelect("summarize")}>
          Resumir
        </Button>
        <Button appearance="primary" onClick={onStartAnalysis}>
          Fale com o documento
        </Button>
      </div>

      <div className={styles.supportContainer}>
        <Button appearance="subtle" icon={<ArrowSyncCheckmark24Regular />} onClick={onSyncMemory}>
          Atualizar memória do documento
        </Button>
        {onShowLegalAnalysis && (
          <Button appearance="outline" onClick={onShowLegalAnalysis}>
            Análise Jurídica
          </Button>
        )}
        {onShowDocumentDesign && (
          <Button appearance="outline" onClick={onShowDocumentDesign}>
            Formatar Documento
          </Button>
        )}
      </div>

      <div className={styles.commandConsole}>
        <Input
          className={styles.input}
          placeholder="Ou digite um comando personalizado..."
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCommandSend()}
          contentAfter={
            <>
              <Button
                icon={<ArrowSyncCheckmark24Regular />}
                appearance="transparent"
                onClick={onShowLastUpdates}
                aria-label="Últimas Atualizações"
              />
              <Button
                icon={<History24Regular />}
                appearance="transparent"
                onClick={onShowHistory}
                aria-label="Histórico"
              />
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
