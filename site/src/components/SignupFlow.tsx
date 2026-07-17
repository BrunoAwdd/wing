import { FormEvent, useEffect, useState } from "react";
import { requestMagicLinkCode, SignupApiError, verifyMagicLinkCode, type AuthSession, type PayablePlan } from "../api";
import { saveSession, type StoredSession } from "../lib/session";
import { startCheckout } from "../lib/checkout";

type Step = "email" | "code" | "done" | "redirecting" | "checkout-failed";

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLAN_LABEL: Record<PayablePlan, string> = {
  basic: "Basic — R$ 24,90/mês",
  pro: "Pro — R$ 49,90/mês",
};

interface SignupFlowProps {
  // Quando definido, o card mostra o contexto ("Assinando o plano X") e,
  // após confirmar o código, vai direto pro checkout desse plano em vez
  // de mostrar a tela de sucesso genérica.
  plan?: PayablePlan | null;
}

export function SignupFlow({ plan = null }: SignupFlowProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const goToCheckout = async (activeSession: AuthSession) => {
    if (!plan) {
      setStep("done");
      return;
    }
    setStep("redirecting");
    try {
      await startCheckout(plan, {
        token: activeSession.token,
        refreshToken: activeSession.refreshToken,
        user: activeSession.user,
      });
    } catch (err) {
      setError(err instanceof SignupApiError ? err.message : "Erro inesperado.");
      setStep("checkout-failed");
    }
  };

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
      const newSession = await verifyMagicLinkCode(email, code);
      saveSession(newSession);
      setSession(newSession);
      setDisplayName(newSession.user.displayName ?? newSession.user.email);
      await goToCheckout(newSession);
    } catch (err) {
      setError(err instanceof SignupApiError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryCheckout = async () => {
    if (!session) return;
    setError(null);
    await goToCheckout({
      token: session.token,
      refreshToken: session.refreshToken,
      user: session.user,
      expiresAt: "",
      refreshTokenExpiresAt: "",
    });
  };

  const planContext = plan && (step === "email" || step === "code")
    ? <p className="signup-plan-context">Assinando o plano {PLAN_LABEL[plan]}</p>
    : null;

  if (step === "redirecting") {
    return (
      <div className="signup-card" role="status">
        <h2>Preparando seu pagamento</h2>
        <p>Você vai ser redirecionado(a) para o checkout seguro em instantes.</p>
      </div>
    );
  }

  if (step === "checkout-failed") {
    return (
      <div className="signup-card" role="status">
        <h2>Conta criada — falta o pagamento</h2>
        <p>
          Bem-vindo(a), {displayName}. Sua conta Robbie foi criada, mas não
          conseguimos iniciar o pagamento do plano {plan ? PLAN_LABEL[plan] : ""} agora.
        </p>
        {error && (
          <p className="signup-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" onClick={handleRetryCheckout}>
          Tentar pagamento novamente
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="signup-card" role="status">
        <h2>Conta criada com sucesso</h2>
        <p>
          Bem-vindo(a), {displayName}. Sua conta Robbie está pronta — o próximo
          passo é instalar o suplemento no Word para começar a usar.
        </p>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form className="signup-card" onSubmit={handleVerifyCode} noValidate>
        {planContext}
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signup-code-error" : undefined}
          autoFocus
        />
        {error && (
          <p id="signup-code-error" className="signup-error" role="alert">
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
      {planContext}
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "signup-email-error" : undefined}
      />
      {error && (
        <p id="signup-email-error" className="signup-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Cadastrar"}
      </button>
    </form>
  );
}
