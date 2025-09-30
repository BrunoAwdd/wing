import * as React from "react";
import { makeStyles, tokens, Text } from "@fluentui/react-components";

const useStyles = makeStyles({
  diffViewer: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: "8px",
    marginBottom: "16px",
  },
  diffBox: {
    padding: "8px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    flexGrow: 1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    minHeight: "100px", // Altura mínima para visualização
  },
});

interface DiffViewerProps {
  originalText: string;
  suggestedText: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ originalText, suggestedText }) => {
  const styles = useStyles();

  return (
    <div className={styles.diffViewer}>
      <div>
        <Text weight="semibold">Original</Text>
        <div className={styles.diffBox}>{originalText}</div>
      </div>
      <div>
        <Text weight="semibold">Sugestão</Text>
        <div className={styles.diffBox}>{suggestedText || "Aguardando sugestão..."}</div>
      </div>
    </div>
  );
};

export default DiffViewer;