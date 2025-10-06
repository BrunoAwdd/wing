import * as React from "react";
import { useState, useEffect } from "react";
import {
  makeStyles,
  Button,
  Title1,
  Subtitle2,
  Card,
  CardHeader,
  tokens,
  Text,
} from "@fluentui/react-components";
import { History24Regular, ArrowLeft24Regular } from "@fluentui/react-icons";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { getFullHistory, SuggestionHistory, HistoryEntry } from "../services/suggestionCache";
import { Paragraph } from "../hooks/useWordInteraction";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    padding: "16px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    paddingBottom: "16px",
  },
  headerTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    marginLeft: "8px",
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
  },
  historyEntry: {
    marginBottom: "24px",
  },
  cardBody: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  commandButton: {
    marginRight: "8px",
    marginBottom: "8px",
  },
  originalText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: "monospace",
    fontSize: "14px",
    maxHeight: "150px",
    overflowY: "auto",
  },
  individualInsertSection: {
    marginTop: "24px",
  },
  paragraphEntry: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerActions: {
    marginLeft: "auto",
    display: "flex",
    gap: "8px",
  },
  paragraphActions: {
    display: "flex",
    gap: "8px",
  },
});

interface HistoryPageProps {
  onBack: () => void;
  insertAtCursor: (text: string) => Promise<void>;
}

type ActiveSuggestion = {
  original: Paragraph[];
  suggestion: Paragraph[];
  command: string;
};

const HistoryPage: React.FC<HistoryPageProps> = ({ onBack, insertAtCursor }) => {
  const styles = useStyles();
  const [history, setHistory] = useState<SuggestionHistory>({});
  const [activeSuggestion, setActiveSuggestion] = useState<ActiveSuggestion | null>(null);

  useEffect(() => {
    const loadedHistory = getFullHistory();
    setHistory(loadedHistory);
  }, []);

  const handleCommandClick = (
    originalText: Paragraph[],
    suggestion: Paragraph[],
    command: string
  ) => {
    setActiveSuggestion({ original: originalText, suggestion, command });
  };

  const handleBackToList = () => {
    setActiveSuggestion(null);
  };

  const renderTextFromParagraphs = (paragraphs: Paragraph[]) => {
    if (!paragraphs) {
      return ""; // Safeguard for old history entries
    }
    return paragraphs.map((p) => p.text).join("\n\n");
  };

  if (activeSuggestion) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={handleBackToList} />
          <Text className={styles.headerTitle}>Comparar Sugestão</Text>
        </div>
        <div className={styles.content}>
          <ReactDiffViewer
            oldValue={renderTextFromParagraphs(activeSuggestion.original)}
            newValue={renderTextFromParagraphs(activeSuggestion.suggestion)}
            compareMethod={DiffMethod.WORDS}
            splitView={false}
            hideLineNumbers={true}
            styles={{
              variables: {
                light: {
                  addedBackground: tokens.colorPaletteLightGreenBackground1,
                  addedColor: tokens.colorNeutralForeground1,
                  removedBackground: tokens.colorPaletteRedBackground1,
                  removedColor: tokens.colorNeutralForeground1,
                  wordAddedBackground: tokens.colorPaletteLightGreenBackground1,
                  wordRemovedBackground: tokens.colorPaletteRedBackground1,
                },
              },
            }}
          />
          <div className={styles.individualInsertSection}>
            <Subtitle2>Parágrafos Sugeridos</Subtitle2>
            {activeSuggestion.suggestion.map((p, index) => (
              <div key={index} className={styles.paragraphEntry}>
                <Text>{p.text}</Text>
                <Button size="small" appearance="primary" onClick={() => insertAtCursor(p.text)}>
                  Inserir
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Histórico de Sugestões</Text>
      </div>
      <div className={styles.content}>
        {Object.keys(history).length === 0 ? (
          <div className={styles.emptyState}>
            <History24Regular style={{ fontSize: "48px" }} />
            <Text size={400} weight="semibold">
              Nenhuma sugestão encontrada
            </Text>
            <Text size={300} align="center">
              Seu histórico de sugestões aparecerá aqui quando você usar os comandos.
            </Text>
          </div>
        ) : (
          Object.entries(history).map(([textId, entry]: [string, HistoryEntry]) => (
            <Card key={textId} className={styles.historyEntry}>
              <CardHeader header={<Subtitle2>Texto Original</Subtitle2>} />
              <div className={styles.cardBody}>
                <pre className={styles.originalText}>
                  {renderTextFromParagraphs(entry.originalText)}
                </pre>
                <div>
                  <Subtitle2>Comandos Sugeridos</Subtitle2>
                  <div>
                    {entry.suggestions &&
                      Object.entries(entry.suggestions).map(([command, suggestion]) => (
                        <Button
                          key={command}
                          className={styles.commandButton}
                          onClick={() =>
                            handleCommandClick(entry.originalText, suggestion, command)
                          }
                          appearance="primary"
                          size="small"
                        >
                          {command}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
