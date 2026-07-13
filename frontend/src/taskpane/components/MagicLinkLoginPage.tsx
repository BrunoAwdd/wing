import * as React from "react";
import { useState } from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Input,
  Button,
  Text,
  Spinner,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    boxSizing: "border-box",
    ...shorthands.gap("16px"),
    ...shorthands.padding("24px"),
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "280px",
    ...shorthands.gap("12px"),
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
  },
});

interface MagicLinkLoginPageProps {
  isLoading: boolean;
  authError: string | null;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
}

const MagicLinkLoginPage: React.FC<MagicLinkLoginPageProps> = ({
  isLoading,
  authError,
  requestCode,
  verifyCode,
}) => {
  const styles = useStyles();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setIsSending(true);
    try {
      await requestCode(email.trim());
      setCodeSent(true);
    } catch {
      // O hook exibe a mensagem de erro; mantém o formulário de e-mail aberto.
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return;
    await verifyCode(email.trim(), code.trim());
  };

  return (
    <div className={styles.root}>
      <Text weight="semibold" size={500}>
        Entrar no Wing
      </Text>

      {!codeSent ? (
        <div className={styles.form}>
          <Text>Digite seu e-mail para receber um código de acesso.</Text>
          <Input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            disabled={isSending}
          />
          <Button
            appearance="primary"
            onClick={handleSendCode}
            disabled={isSending || !email.trim()}
          >
            {isSending ? <Spinner size="tiny" /> : "Enviar código"}
          </Button>
        </div>
      ) : (
        <div className={styles.form}>
          <Text>Digite o código de 6 dígitos enviado para {email}.</Text>
          <Input
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            disabled={isLoading}
          />
          <Button appearance="primary" onClick={handleVerify} disabled={isLoading || !code.trim()}>
            {isLoading ? <Spinner size="tiny" /> : "Entrar"}
          </Button>
          <Button appearance="subtle" onClick={() => setCodeSent(false)} disabled={isLoading}>
            Usar outro e-mail
          </Button>
        </div>
      )}

      {authError && <Text className={styles.errorText}>{authError}</Text>}
    </div>
  );
};

export default MagicLinkLoginPage;
