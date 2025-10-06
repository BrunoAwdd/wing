import * as React from "react";
import { useState, useEffect } from "react";
import {
  makeStyles,
  Button,
  Subtitle2,
  Card,
  CardHeader,
  tokens,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowLeft24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowUndo24Regular,
  History24Regular,
} from "@fluentui/react-icons";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import {
  getChanges,
  updateChangeStatus,
  removeChange,
  Change,
} from "../services/pendingChangesCache";
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
  changeEntry: {
    marginBottom: "24px",
  },
  cardBody: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "8px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
  },
});

interface LastUpdatesPageProps {
  onBack: () => void;
  acceptSingleSuggestion: (index: number, text: string) => Promise<void>;
  originalText: Paragraph[];
}

const LastUpdatesPage: React.FC<LastUpdatesPageProps> = ({ onBack, acceptSingleSuggestion, originalText }) => {
  const styles = useStyles();
  const [changes, setChanges] = useState<Change[]>([]);

  useEffect(() => {
    setChanges(getChanges());
  }, []);

  const forceUpdate = () => setChanges(getChanges());

  const handleAccept = async (change: Change) => {
    const originalIndex = originalText.findIndex((p) => p.id === change.id);
    if (originalIndex === -1) return;
    await acceptSingleSuggestion(originalIndex, change.suggestion.text);
    updateChangeStatus(change.id, "accepted");
    forceUpdate();
  };

  const handleReject = (change: Change) => {
    removeChange(change.id);
    forceUpdate();
  };

  const handleRollback = async (change: Change) => {
    const originalIndex = originalText.findIndex((p) => p.id === change.id);
    if (originalIndex === -1) return;
    await acceptSingleSuggestion(originalIndex, change.original.text);
    updateChangeStatus(change.id, "pending");
    forceUpdate();
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Últimas Atualizações</Text>
      </div>
      <div className={styles.content}>
        {changes.length === 0 ? (
          <div className={styles.emptyState}>
            <History24Regular style={{ fontSize: "48px" }} />
            <Text size={400} weight="semibold">
              Nenhuma atualização pendente
            </Text>
            <Text size={300} align="center">
              As sugestões recentes aparecerão aqui.
            </Text>
          </div>
        ) : (
          changes.map((change) => (
            <Card key={change.id} className={styles.changeEntry}>
              <div className={styles.cardBody}>
                <ReactDiffViewer
                  oldValue={change.original.text}
                  newValue={change.suggestion.text}
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
                <div className={styles.actions}>
                  {change.status === "pending" ? (
                    <>
                      <Tooltip content="Rejeitar" relationship="label">
                        <Button icon={<Dismiss24Regular />} onClick={() => handleReject(change)} />
                      </Tooltip>
                      <Tooltip content="Aceitar" relationship="label">
                        <Button
                          appearance="primary"
                          icon={<Checkmark24Regular />}
                          onClick={() => handleAccept(change)}
                        />
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip content="Reverter" relationship="label">
                      <Button icon={<ArrowUndo24Regular />} onClick={() => handleRollback(change)} />
                    </Tooltip>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default LastUpdatesPage;
