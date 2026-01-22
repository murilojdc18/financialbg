import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/loan-calculator";

interface ReceivablesSummaryCardsProps {
  totalOpen: number;
  totalPaid: number;
  totalOverdue: number;
  countOpen: number;
  countPaid: number;
  countOverdue: number;
}

export function ReceivablesSummaryCards({
  totalOpen,
  totalPaid,
  totalOverdue,
  countOpen,
  countPaid,
  countOverdue,
}: ReceivablesSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
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

      <Card>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pago</CardTitle>
          <CheckCircle className="h-4 w-4 text-secondary-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-secondary-foreground">
            {formatCurrency(totalPaid)}
          </div>
          <p className="text-xs text-muted-foreground">{countPaid} parcelas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Atrasado</CardTitle>
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
