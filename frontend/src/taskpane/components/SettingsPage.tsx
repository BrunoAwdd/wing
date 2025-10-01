import * as React from "react";
import {
  makeStyles,
  tokens,
  Label,
  Input,
  RadioGroup,
  Radio,
  Button,
  Text,
  shorthands,
} from "@fluentui/react-components";
import { ArrowLeft24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.padding("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    marginLeft: "8px",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    ...shorthands.padding("16px"),
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

interface SettingsPageProps {
  tone: string;
  language: string;
  onToneChange: (tone: string) => void;
  onLanguageChange: (language: string) => void;
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  tone,
  language,
  onToneChange,
  onLanguageChange,
  onBack,
}) => {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Configurações</Text>
      </div>
      <div className={styles.content}>
        <div className={styles.field}>
          <Label id="tone-radiogroup-label">Tom da Reescrita/Correção</Label>
          <RadioGroup value={tone} onChange={(_, data) => onToneChange(data.value as string)} aria-labelledby="tone-radiogroup-label">
            <Radio value="formal" label="Formal" />
            <Radio value="casual" label="Casual" />
            <Radio value="profissional" label="Profissional" />
            <Radio value="técnico" label="Técnico" />
          </RadioGroup>
        </div>

        <div className={styles.field}>
          <Label htmlFor="language-input">Idioma de Destino (Tradução)</Label>
          <Input id="language-input" value={language} onChange={(_, data) => onLanguageChange(data.value)} />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
