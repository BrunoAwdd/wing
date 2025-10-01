import * as React from "react";
import { makeStyles, tokens, shorthands } from "@fluentui/react-components";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Paragraph } from "../hooks/useWordInteraction";

const useStyles = makeStyles({
  container: {
    flexGrow: 1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    overflowY: "auto",
    fontFamily: "monospace",
  },
});

// Função agora simplesmente junta o texto dos parágrafos
const paragraphsToText = (paragraphs: Paragraph[]): string => {
  if (!paragraphs || paragraphs.length === 0) {
    return "";
  }
  return paragraphs.map(p => p.text).join("\n");
};

interface DiffViewerProps {
  originalText: Paragraph[];
  suggestedText: Paragraph[];
}

const DiffViewer: React.FC<DiffViewerProps> = ({ originalText, suggestedText }) => {
  const styles = useStyles();

  const originalString = paragraphsToText(originalText);
  const suggestedString = paragraphsToText(suggestedText);

  return (
    <div className={styles.container}>
      <ReactDiffViewer
        oldValue={originalString}
        newValue={suggestedString}
        compareMethod={DiffMethod.WORDS}
        splitView={false}
        hideLineNumbers={true}
        styles={{
          variables: {
            light: {
              addedBackground: tokens.colorPaletteLightGreenBackground2,
              addedColor: tokens.colorNeutralForeground1,
              removedBackground: tokens.colorPaletteRedBackground2,
              removedColor: tokens.colorNeutralForeground1,
              wordAddedBackground: tokens.colorPaletteLightGreenBackground2,
              wordRemovedBackground: tokens.colorPaletteRedBackground2,
            },
          },
        }}
      />
    </div>
  );
};

export default DiffViewer;