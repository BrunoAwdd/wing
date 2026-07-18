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
  DocumentOnePage24Regular,
  ChevronUp16Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
    ...shorthands.padding("16px"),
    overflowY: "auto",
    flexGrow: 1,
    minHeight: 0,
    height: "100%",
    boxSizing: "border-box",
  },
  brand: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
  },
  selectionStatus: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("10px"),
    color: tokens.colorNeutralForeground2,
  },
  // RFC 014 §4: as quatro ações principais do produto — Revisar, Traduzir,
  // Resumir, Fale com o documento. Ficam em destaque (appearance="primary").
  presetContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    ...shorthands.gap("8px"),
  },
  presetButton: {
    width: "100%",
    minHeight: "52px",
  },
  widePresetButton: {
    width: "100%",
    minHeight: "52px",
    gridColumn: "1 / -1",
  },
  // Recursos de suporte (memória, e features incubadas quando ligadas) —
  // visualmente secundários, não competem com as 4 ações principais.
  supportContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    ...shorthands.gap("8px"),
    fontSize: tokens.fontSizeBase200,
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.padding("12px", "0", "0"),
    marginTop: "auto",
  },
  supportHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  supportActions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    ...shorthands.gap("4px"),
  },
  inputMode: {
    display: "flex",
  },
  commandConsole: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  input: {
    width: "100%",
  },
});

interface CommandConsoleProps {
  command: string;
  onCommandChange: (newCommand: string) => void;
  onCommandSend: () => void;
  onPresetSelect: (
    presetCommand: string,
    translationPlacement?: "replace" | "before" | "after"
  ) => void;
  onShowSettings: () => void;
  onStartAnalysis: () => void; // "Fale com o documento" (RFC 014 §4)
  onShowHistory: () => void;
  onShowLastUpdates: () => void;
  onSyncMemory: () => void;
  onSelectAll: () => void;
  selectedParagraphCount: number;
  hasLastResult: boolean;
  onOpenLastResult: () => void;
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
  onSelectAll,
  selectedParagraphCount,
  hasLastResult,
  onOpenLastResult,
  onShowLegalAnalysis,
  onShowDocumentDesign,
}) => {
  const styles = useStyles();
  const [isDocumentSectionOpen, setIsDocumentSectionOpen] = React.useState(true);

  return (
    <div className={styles.wrapper}>
      <div className={styles.selectionStatus}>
        <DocumentOnePage24Regular />
        <span>
          {selectedParagraphCount === 0
            ? "Nenhum parágrafo selecionado"
            : `${selectedParagraphCount} parágrafo${selectedParagraphCount === 1 ? "" : "s"} selecionado${selectedParagraphCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className={styles.presetContainer}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              className={styles.presetButton}
              appearance="primary"
              icon={<ChevronDown16Regular />}
              iconPosition="after"
            >
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
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              className={styles.presetButton}
              appearance="primary"
              icon={<ChevronDown16Regular />}
              iconPosition="after"
            >
              Traduzir
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => onPresetSelect("translate", "replace")}>
                Substituir original
              </MenuItem>
              <MenuItem onClick={() => onPresetSelect("translate", "before")}>
                Inserir antes
              </MenuItem>
              <MenuItem onClick={() => onPresetSelect("translate", "after")}>
                Inserir depois
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <Button className={styles.widePresetButton} onClick={() => onPresetSelect("summarize")}>
          Resumir
        </Button>
      </div>

      {hasLastResult && (
        <Button appearance="subtle" icon={<History24Regular />} onClick={onOpenLastResult}>
          Último resultado
        </Button>
      )}

      <div className={styles.supportContainer}>
        <div className={styles.supportHeader}>
          <strong>Documento</strong>
          <Button
            appearance="subtle"
            icon={isDocumentSectionOpen ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
            onClick={() => setIsDocumentSectionOpen((open) => !open)}
            aria-label={isDocumentSectionOpen ? "Recolher documento" : "Expandir documento"}
          />
        </div>
        {isDocumentSectionOpen && (
          <div className={styles.supportActions}>
            <Button appearance="subtle" icon={<DocumentOnePage24Regular />} onClick={onSelectAll}>
              Selecionar tudo
            </Button>
            <Button
              appearance="subtle"
              icon={<ArrowSyncCheckmark24Regular />}
              onClick={onSyncMemory}
            >
              Atualizar memória
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
        )}
      </div>

      <div className={styles.inputMode}>
        <Button appearance="primary" onClick={onStartAnalysis} style={{ width: "100%" }}>
          Fale com o documento
        </Button>
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
