import * as React from "react";
import { makeStyles, Button, Tooltip } from "@fluentui/react-components";
import { Checkmark24Regular, Dismiss24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  actionsArea: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    padding: "0 16px 16px 16px",
  },
});

interface ActionButtonGroupProps {
  isSuggestionAvailable: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({ isSuggestionAvailable, onAccept, onReject }) => {
  const styles = useStyles();

  return (
    <div className={styles.actionsArea}>
      <Tooltip content="Rejeitar Tudo" relationship="label">
        <Button
          appearance="secondary"
          disabled={!isSuggestionAvailable}
          onClick={onReject}
          icon={<Dismiss24Regular />}
        >
          Rejeitar
        </Button>
      </Tooltip>
      <Tooltip content="Aceitar Tudo" relationship="label">
        <Button
          appearance="primary"
          disabled={!isSuggestionAvailable}
          onClick={onAccept}
          icon={<Checkmark24Regular />}
        >
          Aceitar
        </Button>
      </Tooltip>
    </div>
  );
};

export default ActionButtonGroup;
