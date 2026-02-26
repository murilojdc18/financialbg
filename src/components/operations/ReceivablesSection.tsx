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
import { Loader2, Receipt, AlertCircle, Info, CheckCircle, History } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { formatCurrency } from "@/lib/loan-calculator";
import { calculateReceivableDue, LateFeeConfig, ReceivableDueResult } from "@/lib/receivable-calculator";
import { useReceivablesByOperation } from "@/hooks/useReceivables";
import { ReceivableForPayment } from "@/hooks/useFlexiblePaymentV2";
import { DbReceivable, ReceivableStatus } from "@/types/database";
import { FlexiblePaymentDialog } from "@/components/receivables/FlexiblePaymentDialog";
import { PaymentsHistoryDrawer } from "@/components/receivables/PaymentsHistoryDrawer";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";

interface ReceivablesSectionProps {
  operationId: string;
  lateFeeConfig: LateFeeConfig;
  operationData?: {
    principal: number;
    rate_monthly: number;
    term_months: number;
    system: string;
    start_date: string;
    fee_fixed?: number | null;
    fee_insurance?: number | null;
  };
}

function getDisplayStatus(receivable: DbReceivable): ReceivableStatus {
  if (receivable.status === "PAGO") return "PAGO";
  if (receivable.status === "PARCIAL") return "PARCIAL";
  
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(receivable.due_date));
  
  if (isBefore(dueDate, today)) return "ATRASADO";
  return "EM_ABERTO";
}

export function ReceivablesSection({ operationId, lateFeeConfig, operationData }: ReceivablesSectionProps) {
  const { data: receivables, isLoading, error } = useReceivablesByOperation(operationId);
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableForPayment | null>(null);
  const [selectedForHistory, setSelectedForHistory] = useState<{ id: string; number: number } | null>(null);

  const handleMarkAsPaid = (receivable: DbReceivable) => {
    // Converter para ReceivableForPayment
    const forPayment: ReceivableForPayment = {
      id: receivable.id,
      operation_id: receivable.operation_id,
      client_id: receivable.client_id,
      installment_number: receivable.installment_number,
      due_date: receivable.due_date,
      amount: receivable.amount,
      amount_paid: receivable.amount_paid ?? 0,
      status: receivable.status,
      penalty_applied: receivable.penalty_applied ?? false,
      penalty_amount: receivable.penalty_amount ?? 0,
      interest_accrued: receivable.interest_accrued ?? 0,
      last_interest_calc_at: receivable.last_interest_calc_at ?? null,
      notes: receivable.notes ?? null,
      // Novos campos para encargos carregados
      carried_penalty_amount: receivable.carried_penalty_amount ?? 0,
      carried_interest_amount: receivable.carried_interest_amount ?? 0,
      accrual_frozen_at: receivable.accrual_frozen_at ?? null,
      operations: {
        late_grace_days: lateFeeConfig.lateGraceDays,
        late_penalty_percent: lateFeeConfig.latePenaltyPercent,
        late_interest_monthly_percent: 1,
        late_interest_daily_percent: lateFeeConfig.lateInterestDailyPercent ?? 0.5,
        principal: operationData?.principal ?? 0,
        rate_monthly: operationData?.rate_monthly ?? 0,
        term_months: operationData?.term_months ?? 0,
        system: operationData?.system ?? 'PRICE',
        start_date: operationData?.start_date ?? '',
        fee_fixed: operationData?.fee_fixed,
        fee_insurance: operationData?.fee_insurance,
      },
    };
    setSelectedReceivable(forPayment);
    setDialogOpen(true);
  };

  const handleViewHistory = (receivable: DbReceivable) => {
    setSelectedForHistory({ id: receivable.id, number: receivable.installment_number });
    setHistoryOpen(true);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["receivables", "operation", operationId] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    setDialogOpen(false);
    setSelectedReceivable(null);
  };

  // Função para calcular encargos detalhados (usando novo calculador)
  const calculateFees = (receivable: DbReceivable): ReceivableDueResult | null => {
    if (receivable.status === "PAGO") return null;

    return calculateReceivableDue(
      {
        amount: receivable.amount,
        amountPaid: receivable.amount_paid ?? 0,
        penaltyApplied: receivable.penalty_applied ?? false,
        penaltyAmount: receivable.penalty_amount ?? 0,
        interestAccrued: receivable.interest_accrued ?? 0,
        carriedPenaltyAmount: receivable.carried_penalty_amount ?? 0,
        carriedInterestAmount: receivable.carried_interest_amount ?? 0,
        accrualFrozenAt: receivable.accrual_frozen_at ?? null,
        dueDate: receivable.due_date,
      },
      lateFeeConfig
    );
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
            <span className="ml-2 text-xs">
              (Multa: {lateFeeConfig.latePenaltyPercent}% | Mora: {lateFeeConfig.lateInterestDailyPercent ?? 0.5}% ao dia
              {lateFeeConfig.lateGraceDays > 0 && ` | Carência: ${lateFeeConfig.lateGraceDays} dias`})
            </span>
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
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Nº</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Multa</TableHead>
                    <TableHead className="text-right">Juros</TableHead>
                    <TableHead className="text-right">Total Devido</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((receivable) => {
                    const displayStatus = getDisplayStatus(receivable);
                    const isPaid = receivable.status === "PAGO";
                    const feeResult = calculateFees(receivable);
                    
                    // Encargos (incluindo carregados)
                    const carriedPenalty = receivable.carried_penalty_amount ?? 0;
                    const carriedInterest = receivable.carried_interest_amount ?? 0;
                    const hasCarriedFees = carriedPenalty > 0 || carriedInterest > 0;
                    
                    const amountPaid = receivable.amount_paid ?? 0;
                    
                    // Total devido = original + multa + juros
                    const totalDue = isPaid 
                      ? amountPaid 
                      : (feeResult?.breakdown.total ?? receivable.amount);
                    
                    // Saldo = total devido - pago
                    const balance = isPaid ? 0 : (feeResult?.breakdown.total ?? receivable.amount);

                    return (
                      <TableRow key={receivable.id}>
                        <TableCell className="font-medium">
                          {receivable.installment_number}
                          {hasCarriedFees && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1 text-xs text-amber-600">*</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Encargos trazidos de renegociação
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(receivable.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(receivable.amount)}
                          {(receivable as any).is_manual_amount && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1 text-xs text-amber-600 cursor-help">±</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Ajuste manual: {(receivable as any).manual_adjustment_amount > 0 ? '+' : ''}{formatCurrency((receivable as any).manual_adjustment_amount ?? 0)}
                                {(receivable as any).manual_adjustment_reason && (
                                  <span className="block text-xs text-muted-foreground">{(receivable as any).manual_adjustment_reason}</span>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {(feeResult?.breakdown.penalty ?? 0) > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={carriedPenalty > 0 ? "text-amber-600 cursor-help" : "text-destructive"}>
                                  {formatCurrency(feeResult?.breakdown.penalty ?? 0)}
                                </span>
                              </TooltipTrigger>
                              {carriedPenalty > 0 && (
                                <TooltipContent>
                                  Inclui R$ {carriedPenalty.toFixed(2)} de renegociação
                                </TooltipContent>
                              )}
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">R$ 0,00</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {(feeResult?.breakdown.interest ?? 0) > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={carriedInterest > 0 ? "text-amber-600 cursor-help" : "text-destructive cursor-help"}>
                                  {formatCurrency(feeResult?.breakdown.interest ?? 0)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {carriedInterest > 0 
                                  ? `Inclui R$ ${carriedInterest.toFixed(2)} de renegociação`
                                  : `${feeResult?.daysOverdue ?? 0} dias em atraso`
                                }
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">R$ 0,00</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {feeResult?.isOverdue ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-destructive cursor-help flex items-center justify-end gap-1">
                                  {formatCurrency(totalDue)}
                                  <Info className="h-3 w-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1 text-sm">
                                  <p>Principal: {formatCurrency(feeResult.breakdown.principal)}</p>
                                  <p>Multa: {formatCurrency(feeResult.breakdown.penalty)}</p>
                                  <p>Juros ({feeResult.daysOverdue}d): {formatCurrency(feeResult.breakdown.interest)}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            formatCurrency(totalDue)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {amountPaid > 0 ? (
                            <span className="text-primary">{formatCurrency(amountPaid)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {isPaid ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={balance > 0 ? "text-warning" : "text-primary"}>
                              {formatCurrency(balance)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={displayStatus} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {amountPaid > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleViewHistory(receivable)}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver pagamentos</TooltipContent>
                              </Tooltip>
                            )}
                            {!isPaid && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsPaid(receivable)}
                                className="gap-1"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Pagar
                              </Button>
                            )}
                          </div>
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

      {/* Dialog de pagamento flexível */}
      <FlexiblePaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        receivable={selectedReceivable}
        onSuccess={handlePaymentSuccess}
      />

      {/* Drawer de histórico de pagamentos */}
      <PaymentsHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        receivableId={selectedForHistory?.id ?? null}
        installmentNumber={selectedForHistory?.number}
      />
    </TooltipProvider>
  );
}
