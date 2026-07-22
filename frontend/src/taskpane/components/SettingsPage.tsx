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
import type { WingSessionUser } from "../services/sessionService";
import {
  getBillingStatus,
  startCheckout,
  openBillingPortal,
  type WingBillingStatus,
} from "../services/billingService";

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
  qualityLevel: string;
  onToneChange: (tone: string) => void;
  onLanguageChange: (language: string) => void;
  onQualityLevelChange: (qualityLevel: string) => void;
  onBack: () => void;
  user: WingSessionUser;
  onSignOut: () => void;
  sessionToken: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  tone,
  language,
  qualityLevel,
  onToneChange,
  onLanguageChange,
  onQualityLevelChange,
  onBack,
  user,
  onSignOut,
  sessionToken,
}) => {
  const styles = useStyles();
  const [billingStatus, setBillingStatus] = React.useState<WingBillingStatus | null>(null);
  const [billingError, setBillingError] = React.useState<string | null>(null);
  const [billingActionLoading, setBillingActionLoading] = React.useState(false);
  const activePlan = billingStatus?.plan ?? user.plan;

  React.useEffect(() => {
    let cancelled = false;
    getBillingStatus(sessionToken)
      .then((status) => {
        if (!cancelled) setBillingStatus(status);
      })
      .catch(() => {
        if (!cancelled) setBillingError("Não foi possível carregar os dados da assinatura.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const handleUpgrade = async () => {
    setBillingActionLoading(true);
    setBillingError(null);
    try {
      const url = await startCheckout(sessionToken);
      window.open(url, "_blank");
    } catch {
      setBillingError("Não foi possível iniciar o checkout. Tente novamente.");
    } finally {
      setBillingActionLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setBillingActionLoading(true);
    setBillingError(null);
    try {
      const url = await openBillingPortal(sessionToken);
      window.open(url, "_blank");
    } catch {
      setBillingError("Não foi possível abrir o portal de assinatura.");
    } finally {
      setBillingActionLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Configurações</Text>
      </div>
      <div className={styles.content}>
        <div className={styles.field}>
          <Label id="tone-radiogroup-label">Tom da Reescrita/Correção</Label>
          <RadioGroup
            value={tone}
            onChange={(_, data) => onToneChange(data.value as string)}
            aria-labelledby="tone-radiogroup-label"
          >
            <Radio value="formal" label="Formal" />
            <Radio value="casual" label="Casual" />
            <Radio value="profissional" label="Profissional" />
            <Radio value="técnico" label="Técnico" />
          </RadioGroup>
        </div>

        <div className={styles.field}>
          <Label htmlFor="language-input">Idioma de Destino (Tradução)</Label>
          <Input
            id="language-input"
            value={language}
            onChange={(_, data) => onLanguageChange(data.value)}
          />
        </div>

        <div className={styles.field}>
          <Label id="quality-level-radiogroup-label">Nível de Qualidade (Reescrita)</Label>
          <RadioGroup
            value={qualityLevel}
            onChange={(_, data) => onQualityLevelChange(data.value as string)}
            aria-labelledby="quality-level-radiogroup-label"
          >
            <Radio value="rapido" label="Rápido" />
            <Radio value="equilibrado" label="Equilibrado" />
            <Radio value="profundo" label="Profundo" />
          </RadioGroup>
        </div>

        <div className={styles.field}>
          <Label>Conta Wing</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Text>{user.displayName || user.email}</Text>
            {user.displayName && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {user.email}
              </Text>
            )}
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Plano: {activePlan.toUpperCase()}
            </Text>
            {billingStatus && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Créditos: {billingStatus.usage.creditsUsed.toLocaleString("pt-BR")}
                {billingStatus.usage.creditLimit !== null
                  ? ` de ${billingStatus.usage.creditLimit.toLocaleString("pt-BR")}`
                  : " usados"}
              </Text>
            )}
          </div>
          {billingError && (
            <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
              {billingError}
            </Text>
          )}
          {activePlan === "free" ? (
            <Button appearance="primary" disabled={billingActionLoading} onClick={() => void handleUpgrade()}>
              Assinar Wing Pro
            </Button>
          ) : (
            <Button
              appearance="secondary"
              disabled={billingActionLoading}
              onClick={() => void handleManageSubscription()}
            >
              Gerenciar assinatura
            </Button>
          )}
          <Button appearance="secondary" onClick={onSignOut}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
