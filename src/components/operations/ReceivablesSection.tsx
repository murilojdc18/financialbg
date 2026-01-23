import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Loader2, Receipt, AlertCircle, Info, CheckCircle } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { formatCurrency } from "@/lib/loan-calculator";
import { calculateLateFees, LateFeeConfig, LateFeeResult } from "@/lib/late-fee-calculator";
import { useReceivablesByOperation, useMarkAsPaid } from "@/hooks/useReceivables";
import { DbReceivable, ReceivableStatus, PaymentMethod } from "@/types/database";
import { MarkReceivablePaidDialog } from "./MarkReceivablePaidDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";

interface ReceivablesSectionProps {
  operationId: string;
  lateFeeConfig: LateFeeConfig;
}

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

interface SelectedReceivable {
  id: string;
  installmentNumber: number;
  originalAmount: number;
  lateFeeResult: LateFeeResult;
}

export function ReceivablesSection({ operationId, lateFeeConfig }: ReceivablesSectionProps) {
  const { data: receivables, isLoading, error } = useReceivablesByOperation(operationId);
  const markAsPaid = useMarkAsPaid();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<SelectedReceivable | null>(null);

  const handleMarkAsPaid = (
    receivable: DbReceivable,
    lateFeeResult: LateFeeResult
  ) => {
    setSelectedReceivable({
      id: receivable.id,
      installmentNumber: receivable.installment_number,
      originalAmount: receivable.amount,
      lateFeeResult,
    });
    setDialogOpen(true);
  };

  const handleConfirmPayment = async (data: {
    paidAt: Date;
    paymentMethod: PaymentMethod;
    amountPaid: number;
  }) => {
    if (!selectedReceivable) return;

    try {
      await markAsPaid.mutateAsync({
        id: selectedReceivable.id,
        paid_at: data.paidAt.toISOString(),
        payment_method: data.paymentMethod,
        amount: data.amountPaid,
      });
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["receivables", "operation", operationId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      
      toast({
        title: "Pagamento registrado!",
        description: `Parcela ${selectedReceivable.installmentNumber} marcada como paga.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao registrar pagamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
      throw error;
    }
  };

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
                    <TableHead className="text-right w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((receivable) => {
                    const displayStatus = getDisplayStatus(receivable);
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
                          <StatusBadge status={displayStatus} />
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
                        <TableCell className="text-right">
                          {!isPaid && lateFeeResult && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(receivable, lateFeeResult)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
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

      {/* Dialog para marcar como pago */}
      {selectedReceivable && (
        <MarkReceivablePaidDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          installmentNumber={selectedReceivable.installmentNumber}
          originalAmount={selectedReceivable.originalAmount}
          updatedAmount={selectedReceivable.lateFeeResult.updatedAmount}
          hasLateFees={selectedReceivable.lateFeeResult.hasLateFees}
          onConfirm={handleConfirmPayment}
        />
      )}
    </TooltipProvider>
  );
}
