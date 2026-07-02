import { useState } from "react";
import { useAppStore } from "@/state/useAppStore";

// Per-tab, not persisted: sessionStorage survives a simple refresh within the
// same tab (so the chooser does not nag once dismissed) but resets on a new
// browser session/tab. That is intentional and documented in PLAN.md: if the
// workspace is still virgin, reappearing on a fresh session is honest, not a
// bug.
const DISMISS_KEY = "romboiq:first-run-chooser-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // sessionStorage unavailable (private mode, etc.) - chooser will just
    // reappear on next render pass, which is a safe fallback.
  }
}

export function FirstRunChooser({ isVirgin }: { isVirgin: boolean }) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isVirgin || dismissed) return null;

  function close() {
    writeDismissed();
    setDismissed(true);
  }

  function exploreDemo() {
    useAppStore.getState().loadDemoWorkspace();
    close();
  }

  return (
    <div className="first-run-chooser-overlay" role="dialog" aria-modal="true">
      <div className="card first-run-chooser-panel">
        <span className="eyebrow">RomboIQ / primer arranque</span>
        <h2>Como queres empezar</h2>
        <p className="muted-panel">
          Elegi una opcion. Podes cambiarla despues desde Contexto activo.
        </p>
        <div className="first-run-chooser-options">
          <button
            type="button"
            className="first-run-chooser-option"
            onClick={exploreDemo}
          >
            <b>Explorar demo</b>
            <small>
              Caso piloto con plantel, sesion y reportes ya cargados, para ver
              el flujo completo.
            </small>
          </button>
          <button
            type="button"
            className="first-run-chooser-option primary"
            onClick={close}
          >
            <b>Empezar desde cero</b>
            <small>
              Workspace real y vacio. Cargas tu propio plantel y evidencia.
            </small>
          </button>
        </div>
      </div>
    </div>
  );
}
