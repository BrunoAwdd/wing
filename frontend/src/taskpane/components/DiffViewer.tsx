import * as React from "react";
import { makeStyles, tokens, shorthands, Button } from "@fluentui/react-components";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Paragraph } from "../hooks/useWordInteraction";

const useStyles = makeStyles({
  container: {
    flexGrow: 1,
    overflowY: "auto",
  },
  diffContainer: {
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: "monospace",
    marginBottom: "16px",
  },
  buttons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "8px",
  },
});

interface DiffViewerProps {
  originalText: Paragraph[];
  suggestedText: Paragraph[];
  onAcceptSingle: (id: string) => void;
  onRejectSingle: (id: string) => void;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ originalText, suggestedText, onAcceptSingle, onRejectSingle }) => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {suggestedText.map((suggestion) => {
        const original = originalText.find((p) => p.id === suggestion.id);
        if (!original) return null;

        return (
          <div key={suggestion.id}>
            <div className={styles.diffContainer}>
              <ReactDiffViewer
                oldValue={original.text}
                newValue={suggestion.text}
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
            </div>
            <div className={styles.buttons}>
              <Button onClick={() => onAcceptSingle(suggestion.id)}>Aceitar</Button>
              <Button onClick={() => onRejectSingle(suggestion.id)}>Rejeitar</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DiffViewer;
