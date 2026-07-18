import { FormEvent, useState } from "react";
import { createSupportRequest, SupportRequest } from "../api";

const requestedCategory = new URLSearchParams(window.location.search).get("assunto");
const initialCategory: SupportRequest["category"] = requestedCategory === "comercial"
  ? "commercial"
  : requestedCategory === "privacidade"
  ? "privacy"
  : "support";

const initialForm: SupportRequest = {
  name: "",
  email: "",
  category: initialCategory,
  subject: "",
  message: "",
  privacyAccepted: false,
  website: "",
};

export function ContactSupport() {
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [protocol, setProtocol] = useState("");
  const [error, setError] = useState("");

  const update = <K extends keyof SupportRequest>(key: K, value: SupportRequest[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      setProtocol(await createSupportRequest(form));
      setState("sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a solicitação.");
      setState("error");
    }
  };

  return (
    <>
      <header className="legal-header">
        <a className="nav-logo" href="/">Robbie</a>
        <a className="btn btn-secondary" href="/">Voltar ao site</a>
      </header>
      <main className="contact-page">
        <div className="contact-intro">
          <p className="eyebrow">Contato e suporte</p>
          <h1>Como podemos ajudar?</h1>
          <p>Envie sua dúvida comercial, problema técnico ou solicitação de privacidade.</p>
          <div className="contact-guidance">
            <strong>Para sua segurança</strong>
            <span>Não envie senhas, códigos de acesso, dados bancários ou conteúdo confidencial de documentos.</span>
          </div>
        </div>

        {state === "sent" ? (
          <section className="contact-success" aria-live="polite">
            <span className="contact-success-mark" aria-hidden="true">✓</span>
            <h2>Solicitação recebida</h2>
            <p>Registramos sua mensagem e responderemos pelo e-mail informado.</p>
            <p className="contact-protocol">Protocolo: <strong>{protocol}</strong></p>
            <button className="btn btn-secondary" type="button" onClick={() => {
              setForm(initialForm);
              setState("idle");
              setProtocol("");
            }}>Enviar outra solicitação</button>
          </section>
        ) : (
          <form className="contact-form" onSubmit={submit}>
            <div className="form-row">
              <label>Nome
                <input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} />
              </label>
              <label>E-mail
                <input required maxLength={254} type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
              </label>
            </div>
            <label>Assunto da solicitação
              <select value={form.category} onChange={(event) => update("category", event.target.value as SupportRequest["category"])}>
                <option value="support">Suporte técnico</option>
                <option value="billing">Cobrança e assinatura</option>
                <option value="commercial">Comercial</option>
                <option value="privacy">Privacidade e dados</option>
                <option value="other">Outro assunto</option>
              </select>
            </label>
            <label>Título
              <input required maxLength={160} value={form.subject} onChange={(event) => update("subject", event.target.value)} />
            </label>
            <label>Mensagem
              <textarea required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={(event) => update("message", event.target.value)} />
              <span className="field-count">{form.message.length}/5000</span>
            </label>
            <label className="honeypot" aria-hidden="true">Website
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
            </label>
            <label className="contact-consent">
              <input required type="checkbox" checked={form.privacyAccepted} onChange={(event) => update("privacyAccepted", event.target.checked)} />
              <span>Li a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a> e autorizo o uso destes dados para atendimento.</span>
            </label>
            {error && <p className="contact-error" role="alert">{error}</p>}
            <button className="btn btn-primary contact-submit" type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Enviando..." : "Enviar solicitação"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
