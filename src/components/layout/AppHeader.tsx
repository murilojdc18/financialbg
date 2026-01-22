import { SidebarTrigger } from "@/components/ui/sidebar";
import { Landmark } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Landmark className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-foreground tracking-tight">
            FinanceHub
          </span>
          <span className="text-xs text-muted-foreground">
            Gestão Financeira
          </span>
        </div>
      </div>

      <div className="flex-1" />
    </header>
  );
}
