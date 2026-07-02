import { Component, type ErrorInfo, type ReactNode } from "react";

type TacticalBoardErrorBoundaryProps = {
  children: ReactNode;
};

type TacticalBoardErrorBoundaryState = {
  hasError: boolean;
};

// Local error boundary for the board workspace only (no shell/App.tsx
// change). A render throw anywhere under the board must never leave the
// whole view blank — it shows a sober recovery state instead. React
// unmounts the crashed subtree when the boundary catches it, so clearing
// `hasError` and re-rendering `children` mounts fresh instances (a real
// remount, no extra key trick needed).
export class TacticalBoardErrorBoundary extends Component<
  TacticalBoardErrorBoundaryProps,
  TacticalBoardErrorBoundaryState
> {
  state: TacticalBoardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TacticalBoardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TacticalBoard render error", error, info);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className="rombo-board-empty">
          <div>
            <p className="eyebrow">Pizarra tactica</p>
            <h2>La pizarra encontro un error</h2>
            <p>
              Algo fallo al dibujar esta escena. Tu trabajo guardado no se
              perdio; recarga la pizarra para intentar de nuevo.
            </p>
            <div className="rombo-board-empty-actions">
              <button
                type="button"
                className="primary"
                onClick={this.handleReload}
              >
                Recargar la pizarra
              </button>
            </div>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
