import { SignupFlow } from "../components/SignupFlow";

export function Home() {
  return (
    <main className="page">
      <section className="hero">
        <h1>Wing</h1>
        <p>Assistente de IA para o Microsoft Word.</p>
      </section>
      <SignupFlow />
    </main>
  );
}
