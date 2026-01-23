import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Receipt, AlertCircle, Info } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { formatCurrency } from "@/lib/loan-calculator";
import { calculateLateFees, LateFeeConfig } from "@/lib/late-fee-calculator";
import { useReceivablesByOperation } from "@/hooks/useReceivables";
import { DbReceivable, ReceivableStatus, PaymentMethod } from "@/types/database";

interface ReceivablesSectionProps {
  operationId: string;
  lateFeeConfig: LateFeeConfig;
}

const statusConfig: Record<
  ReceivableStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  EM_ABERTO: { label: "Em Aberto", variant: "outline" },
  PAGO: { label: "Pago", variant: "secondary" },
  ATRASADO: { label: "Atrasado", variant: "destructive" },
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  OUTRO: "Outro",
};

function getDisplayStatus(receivable: DbReceivable): ReceivableStatus {
  if (receivable.status === "PAGO") {
    return "PAGO";
  }
  
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(receivable.due_date));
  
  if (isBefore(dueDate, today)) {
    return "ATRASADO";
  }
  
  return "EM_ABERTO";
}

export function ReceivablesSection({ operationId, lateFeeConfig }: ReceivablesSectionProps) {
  const { data: receivables, isLoading, error } = useReceivablesByOperation(operationId);

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle>Parcelas</CardTitle>
          </div>
          <CardDescription>
            Parcelas registradas para esta operação
            {lateFeeConfig.latePenaltyPercent > 0 && (
              <span className="ml-2 text-xs">
                (Multa: {lateFeeConfig.latePenaltyPercent}% | Juros: {lateFeeConfig.lateInterestMonthlyPercent}% a.m.
                {lateFeeConfig.lateGraceDays > 0 && ` | Carência: ${lateFeeConfig.lateGraceDays} dias`})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">
                Erro ao carregar parcelas. Tente novamente mais tarde.
              </p>
            </div>
          ) : !receivables || receivables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma parcela encontrada para esta operação.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Nº</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-center w-24">Dias Atraso</TableHead>
                    <TableHead className="text-right">Valor Atualizado</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Método</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((receivable) => {
                    const displayStatus = getDisplayStatus(receivable);
                    const statusStyle = statusConfig[displayStatus];
                    const isPaid = receivable.status === "PAGO";
                    
                    // Calcula multa/juros apenas para parcelas não pagas
                    const lateFeeResult = !isPaid
                      ? calculateLateFees(receivable.due_date, receivable.amount, lateFeeConfig)
                      : null;

                    return (
                      <TableRow key={receivable.id}>
                        <TableCell className="font-medium">
                          {receivable.installment_number}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(receivable.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(receivable.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isPaid ? (
                            <span className="text-muted-foreground">—</span>
                          ) : lateFeeResult && lateFeeResult.daysOverdue > 0 ? (
                            <span className="text-destructive font-medium">
                              {lateFeeResult.daysOverdue}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isPaid ? (
                            <span className="text-muted-foreground">
                              {receivable.amount_paid 
                                ? formatCurrency(receivable.amount_paid)
                                : "—"}
                            </span>
                          ) : lateFeeResult && lateFeeResult.hasLateFees ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-semibold text-destructive">
                                {formatCurrency(lateFeeResult.updatedAmount)}
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <div className="space-y-1 text-sm">
                                    <p><strong>Detalhamento:</strong></p>
                                    <p>Valor original: {formatCurrency(lateFeeResult.originalAmount)}</p>
                                    <p>Multa ({lateFeeConfig.latePenaltyPercent}%): {formatCurrency(lateFeeResult.penalty)}</p>
                                    <p>Juros ({lateFeeResult.daysOverdue} dias): {formatCurrency(lateFeeResult.interest)}</p>
                                    <p className="font-semibold pt-1 border-t">
                                      Total: {formatCurrency(lateFeeResult.updatedAmount)}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : (
                            <span className="font-medium">
                              {formatCurrency(receivable.amount)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusStyle.variant}>
                            {statusStyle.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {receivable.paid_at
                            ? format(parseISO(receivable.paid_at), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {receivable.payment_method
                            ? paymentMethodLabels[receivable.payment_method]
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
