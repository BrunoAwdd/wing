import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import {
  FluentProvider,
  webLightTheme,
  Toaster,
  useToastController,
  useId,
} from "@fluentui/react-components";

/* global document, Office, module, require, HTMLElement */

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
  root?.render(
    <FluentProvider theme={webLightTheme}>
      <AppWithToaster />
    </FluentProvider>
  );
});

function AppWithToaster() {
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);
  return (
    <>
      <App dispatchToast={dispatchToast} toastId={toasterId} />
      <Toaster toasterId={toasterId} position="top-end" />
    </>
  );
}

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(
      <FluentProvider theme={webLightTheme}>
        <AppWithToaster />
      </FluentProvider>
    );
  });
}
