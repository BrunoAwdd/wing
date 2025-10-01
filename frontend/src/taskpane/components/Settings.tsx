import * as React from "react";
import {
  makeStyles,
  tokens,
  Label,
  Input,
  Dropdown,
  Option,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "10px",
    marginTop: "10px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

interface SettingsProps {
  tone: string;
  language: string;
  onToneChange: (tone: string) => void;
  onLanguageChange: (language: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ tone, language, onToneChange, onLanguageChange }) => {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.field}>
        <Label htmlFor="tone-select">Tom da Reescrita/Correção</Label>
        <Dropdown
          id="tone-select"
          value={tone}
          onOptionSelect={(_, data) => onToneChange(data.optionValue as string)}
        >
          <Option value="formal">Formal</Option>
          <Option value="casual">Casual</Option>
          <Option value="profissional">Profissional</Option>
          <Option value="técnico">Técnico</Option>
        </Dropdown>
      </div>

      <div className={styles.field}>
        <Label htmlFor="language-input">Idioma de Destino (Tradução)</Label>
        <Input
          id="language-input"
          value={language}
          onChange={(_, data) => onLanguageChange(data.value)}
        />
      </div>
    </div>
  );
};

export default Settings;
