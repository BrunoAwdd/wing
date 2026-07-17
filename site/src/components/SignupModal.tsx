import { useEffect } from "react";
import { SignupFlow } from "./SignupFlow";
import type { PayablePlan } from "../api";

interface SignupModalProps {
  plan: PayablePlan;
  onClose: () => void;
}

export function SignupModal({ plan, onClose }: SignupModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>
        <SignupFlow plan={plan} />
      </div>
    </div>
  );
}
