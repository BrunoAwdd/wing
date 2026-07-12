import * as React from "react";
import { makeStyles, tokens, shorthands, Button, Tooltip } from "@fluentui/react-components";
import { Checkmark24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Paragraph } from "../hooks/useWordInteraction";

const useStyles = makeStyles({
  container: {
    flexGrow: 1,
    overflowY: "auto",
  },
  suggestionItem: {
    ...shorthands.padding("0", "0", "16px", "0"),
    ...shorthands.margin("0", "0", "16px", "0"),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
  },
  diffContainer: {
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: "monospace",
  },
  buttons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "4px",
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
          <div key={suggestion.id} className={styles.suggestionItem}>
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
              <Tooltip content="Rejeitar" relationship="label">
                <Button icon={<Dismiss24Regular />} onClick={() => onRejectSingle(suggestion.id)} />
              </Tooltip>
              <Tooltip content="Aceitar" relationship="label">
                <Button appearance="primary" icon={<Checkmark24Regular />} onClick={() => onAcceptSingle(suggestion.id)} />
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DiffViewer;
