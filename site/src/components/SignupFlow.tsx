import { FormEvent, useEffect, useState } from "react";
import { requestMagicLinkCode, SignupApiError, verifyMagicLinkCode } from "../api";

type Step = "email" | "code" | "done";

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupFlow() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError("Informe um e-mail válido.");
      return;
    }

    setSubmitting(true);
    try {
      await requestMagicLinkCode(email);
      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof SignupApiError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await requestMagicLinkCode(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof SignupApiError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (code.trim().length === 0) {
      setError("Informe o código recebido por e-mail.");
      return;
    }

    setSubmitting(true);
    try {
      const session = await verifyMagicLinkCode(email, code);
      setDisplayName(session.user.displayName ?? session.user.email);
      setStep("done");
    } catch (err) {
      setError(err instanceof SignupApiError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="signup-card" role="status">
        <h2>Conta criada com sucesso</h2>
        <p>
          Bem-vindo(a), {displayName}. Sua conta Wing está pronta — o próximo
          passo é instalar o suplemento no Word para começar a usar.
        </p>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form className="signup-card" onSubmit={handleVerifyCode} noValidate>
        <h2>Confirme seu e-mail</h2>
        <p>Enviamos um código para {email}.</p>
        <label htmlFor="signup-code">Código de acesso</label>
        <input
          id="signup-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={submitting}
          autoFocus
        />
        {error && (
          <p className="signup-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Confirmando…" : "Confirmar código"}
        </button>
        <button
          type="button"
          className="signup-secondary"
          onClick={handleResend}
          disabled={submitting || cooldown > 0}
        >
          {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
        </button>
      </form>
    );
  }

  return (
    <form className="signup-card" onSubmit={handleRequestCode} noValidate>
      <h2>Criar conta</h2>
      <label htmlFor="signup-email">E-mail</label>
      <input
        id="signup-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={submitting}
        autoFocus
      />
      {error && (
        <p className="signup-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Cadastrar"}
      </button>
    </form>
  );
}
