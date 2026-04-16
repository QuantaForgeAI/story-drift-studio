import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  title?: string;
  description?: string;
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary captured an exception", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.state.hasError) return;

    const previousKeys = prevProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys ?? [];
    const hasChanged =
      previousKeys.length !== nextKeys.length ||
      nextKeys.some((value, index) => !Object.is(value, previousKeys[index]));

    if (hasChanged) {
      this.setState({ hasError: false });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="glass-panel-elevated flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-severity-high" />
        <div className="space-y-1">
          <h3 className="font-heading text-sm text-foreground">
            {this.props.title ?? "Something went wrong"}
          </h3>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {this.props.description ??
              "The simulator hit an unexpected rendering error. You can retry this panel without reloading the entire app."}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={this.handleReset}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Panel
        </Button>
      </div>
    );
  }
}
