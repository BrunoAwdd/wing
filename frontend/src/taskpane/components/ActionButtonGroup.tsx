import * as React from "react";
import { makeStyles, Button } from "@fluentui/react-components";

const useStyles = makeStyles({
  actionsArea: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    marginBottom: "16px",
  },
});

interface ActionButtonGroupProps {
  isSuggestionAvailable: boolean;
  onAccept: () => void;
}

const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({ isSuggestionAvailable, onAccept }) => {
  const styles = useStyles();

  return (
    <div className={styles.actionsArea}>
      <Button appearance="primary" disabled={!isSuggestionAvailable} onClick={onAccept}>
        Aceitar Sugestão
      </Button>
    </div>
  );
};

export default ActionButtonGroup;
