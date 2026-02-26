import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback message shown in the error UI */
  fallbackMessage?: string;
  /** Called when the user clicks "Close" — useful for closing modals */
  onClose?: () => void;
  /** Inline = renders error inside a card; fullpage = centered on screen */
  variant?: "inline" | "fullpage";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  render() {
    if (this.state.hasError) {
      const message = this.props.fallbackMessage || "Ocorreu um erro inesperado. Verifique os valores e tente novamente.";
      const isInline = this.props.variant !== "fullpage";

      const content = (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Algo deu errado</h3>
            <p className="text-sm text-muted-foreground max-w-md">{message}</p>
          </div>
          <div className="flex gap-2">
            {this.props.onClose && (
              <Button variant="outline" size="sm" onClick={this.handleClose}>
                <X className="h-4 w-4 mr-1" />
                Fechar
              </Button>
            )}
            <Button size="sm" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Tentar novamente
            </Button>
          </div>
        </div>
      );

      if (isInline) {
        return (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5">
            {content}
          </div>
        );
      }

      return (
        <div className="flex h-screen items-center justify-center p-4">
          <div className="rounded-lg border border-destructive/50 bg-background shadow-lg max-w-lg w-full">
            {content}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
