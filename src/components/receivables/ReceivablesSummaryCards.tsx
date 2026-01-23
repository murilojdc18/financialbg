import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/loan-calculator";
import { cn } from "@/lib/utils";
import { ReceivableStatus } from "@/types/database";

interface ReceivablesSummaryCardsProps {
  totalOpen: number;
  totalPaid: number;
  totalOverdue: number;
  countOpen: number;
  countPaid: number;
  countOverdue: number;
  selectedStatus?: ReceivableStatus | "all";
  onStatusClick?: (status: ReceivableStatus | "all") => void;
}

export function ReceivablesSummaryCards({
  totalOpen,
  totalPaid,
  totalOverdue,
  countOpen,
  countPaid,
  countOverdue,
  selectedStatus,
  onStatusClick,
}: ReceivablesSummaryCardsProps) {
  const isSelected = (status: ReceivableStatus | "all") => selectedStatus === status;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Total Geral - Neutro */}
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isSelected("all")
            ? "ring-2 ring-primary shadow-md"
            : "border-border"
        )}
        onClick={() => onStatusClick?.("all")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalOpen + totalPaid + totalOverdue)}
          </div>
          <p className="text-xs text-muted-foreground">
            {countOpen + countPaid + countOverdue} parcelas
          </p>
        </CardContent>
      </Card>

      {/* Em Aberto - Neutro/Primário */}
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isSelected("EM_ABERTO")
            ? "ring-2 ring-primary shadow-md border-primary/50 bg-primary/5"
            : "border-border bg-card"
        )}
        onClick={() => onStatusClick?.("EM_ABERTO")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
          <Clock className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(totalOpen)}
          </div>
          <p className="text-xs text-muted-foreground">{countOpen} parcelas</p>
        </CardContent>
      </Card>

      {/* Pago - Verde */}
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isSelected("PAGO")
            ? "ring-2 ring-[hsl(var(--success))] shadow-md border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/10"
            : "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5"
        )}
        onClick={() => onStatusClick?.("PAGO")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--success))]">Pago</CardTitle>
          <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--success))]">
            {formatCurrency(totalPaid)}
          </div>
          <p className="text-xs text-muted-foreground">{countPaid} parcelas</p>
        </CardContent>
      </Card>

      {/* Atrasado - Vermelho */}
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isSelected("ATRASADO")
            ? "ring-2 ring-destructive shadow-md border-destructive/50 bg-destructive/10"
            : "border-destructive/30 bg-destructive/5"
        )}
        onClick={() => onStatusClick?.("ATRASADO")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-destructive">Atrasado</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {formatCurrency(totalOverdue)}
          </div>
          <p className="text-xs text-muted-foreground">{countOverdue} parcelas</p>
        </CardContent>
      </Card>
    </div>
  );
}
