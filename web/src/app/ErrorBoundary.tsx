import { Component, type ErrorInfo, type ReactNode } from "react";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render-time crashes so one bad screen never blanks the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="crash__mark" aria-hidden="true">!</p>
        <h1 className="crash__title">Something broke</h1>
        <p className="crash__sub">The screen hit an error. Reloading usually clears it.</p>
        <button className="crash__btn" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
