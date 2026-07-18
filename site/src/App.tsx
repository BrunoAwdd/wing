import { Home } from "./pages/Home";
import { CheckoutSuccess } from "./pages/CheckoutSuccess";
import { CheckoutCanceled } from "./pages/CheckoutCanceled";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfUse } from "./pages/TermsOfUse";
import { ContactSupport } from "./pages/ContactSupport";

// Site estático de uma página só — não justifica puxar uma lib de rotas
// pra 2 páginas extra fora da landing (destino pós-checkout do Stripe).
export function App() {
  switch (window.location.pathname) {
    case "/sucesso":
      return <CheckoutSuccess />;
    case "/cancelado":
      return <CheckoutCanceled />;
    case "/privacidade":
      return <PrivacyPolicy />;
    case "/termos":
      return <TermsOfUse />;
    case "/contato":
      return <ContactSupport />;
    default:
      return <Home />;
  }
}
