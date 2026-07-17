import { Home } from "./pages/Home";
import { CheckoutSuccess } from "./pages/CheckoutSuccess";
import { CheckoutCanceled } from "./pages/CheckoutCanceled";

// Site estático de uma página só — não justifica puxar uma lib de rotas
// pra 2 páginas extra fora da landing (destino pós-checkout do Stripe).
export function App() {
  switch (window.location.pathname) {
    case "/sucesso":
      return <CheckoutSuccess />;
    case "/cancelado":
      return <CheckoutCanceled />;
    default:
      return <Home />;
  }
}
