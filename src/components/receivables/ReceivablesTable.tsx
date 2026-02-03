import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Eye, History, Info } from "lucide-react";
import { DbReceivableWithRelations, DbClient } from "@/types/database";
import { formatCurrency } from "@/lib/loan-calculator";
import { calculateReceivableDue, LateFeeConfig } from "@/lib/receivable-calculator";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { ReceivableForPayment } from "@/hooks/useFlexiblePaymentV2";
import { FlexiblePaymentDialog } from "./FlexiblePaymentDialog";
import { PaymentsHistoryDrawer } from "./PaymentsHistoryDrawer";
import { useQueryClient } from "@tanstack/react-query";

interface ReceivablesTableProps {
  receivables: DbReceivableWithRelations[];
  clients: DbClient[];
  onMarkAsPaid?: (receivable: DbReceivableWithRelations) => void;
}

export function ReceivablesTable({
  receivables,
}: ReceivablesTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableForPayment | null>(null);
  const [selectedForHistory, setSelectedForHistory] = useState<{ id: string; number: number } | null>(null);

  const handleMarkAsPaid = (receivable: DbReceivableWithRelations) => {
    // Obter config de late fee da operação
    const config: LateFeeConfig = {
      lateGraceDays: receivable.operations?.late_grace_days ?? 0,
      latePenaltyPercent: Number(receivable.operations?.late_penalty_percent) ?? 10,
      lateInterestDailyPercent: Number(receivable.operations?.late_interest_daily_percent) ?? 0.5,
    };

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
        late_grace_days: config.lateGraceDays,
        late_penalty_percent: config.latePenaltyPercent,
        late_interest_monthly_percent: 1,
        late_interest_daily_percent: config.lateInterestDailyPercent ?? 0.5,
      },
    };
    setSelectedReceivable(forPayment);
    setDialogOpen(true);
  };

  const handleViewHistory = (receivable: DbReceivableWithRelations) => {
    setSelectedForHistory({ id: receivable.id, number: receivable.installment_number });
    setHistoryOpen(true);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["receivables"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    setDialogOpen(false);
    setSelectedReceivable(null);
  };

  // Calcular encargos para uma receivable
  const calculateFees = (receivable: DbReceivableWithRelations) => {
    if (receivable.status === "PAGO") return null;

    const config: LateFeeConfig = {
      lateGraceDays: receivable.operations?.late_grace_days ?? 0,
      latePenaltyPercent: Number(receivable.operations?.late_penalty_percent) ?? 10,
      lateInterestDailyPercent: Number(receivable.operations?.late_interest_daily_percent) ?? 0.5,
    };

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
      config
    );
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Parcela</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead className="text-center">Caixa</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Total Devido</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receivables.map((receivable) => {
              const isPaid = receivable.status === "PAGO";
              const feeResult = calculateFees(receivable);
              const amountPaid = receivable.amount_paid ?? 0;
              
              // Encargos carregados
              const carriedPenalty = receivable.carried_penalty_amount ?? 0;
              const carriedInterest = receivable.carried_interest_amount ?? 0;
              const hasCarriedFees = carriedPenalty > 0 || carriedInterest > 0;
              
              const totalDue = isPaid 
                ? amountPaid 
                : (feeResult?.breakdown.total ?? receivable.amount);
              
              const balance = isPaid ? 0 : (feeResult?.breakdown.total ?? receivable.amount);

              return (
                <TableRow key={receivable.id}>
                  <TableCell className="font-medium">
                    {receivable.installment_number}ª
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
                  <TableCell>{receivable.clients?.name || "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      className="p-0 h-auto font-medium"
                      onClick={() => navigate(`/operacoes/${receivable.operation_id}`)}
                    >
                      {receivable.operation_id.slice(0, 8)}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={receivable.operations?.cash_source === "B&G" ? "default" : "secondary"}>
                      {receivable.operations?.cash_source || "B&G"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(parseISO(receivable.due_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(receivable.amount))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {feeResult?.isOverdue || hasCarriedFees ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={hasCarriedFees ? "text-amber-600 cursor-help flex items-center justify-end gap-1" : "text-destructive cursor-help flex items-center justify-end gap-1"}>
                            {formatCurrency(totalDue)}
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <div className="space-y-1 text-sm">
                            <p>Principal: {formatCurrency(feeResult?.breakdown.principal ?? receivable.amount)}</p>
                            <p>Multa: {formatCurrency(feeResult?.breakdown.penalty ?? 0)}</p>
                            <p>Juros: {formatCurrency(feeResult?.breakdown.interest ?? 0)}</p>
                            {hasCarriedFees && (
                              <p className="text-amber-600 font-medium pt-1 border-t">
                                Inclui encargos de renegociação
                              </p>
                            )}
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
                  <TableCell>
                    <StatusBadge status={receivable.status} />
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/operacoes/${receivable.operation_id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver operação</TooltipContent>
                      </Tooltip>
                      {!isPaid && (
                        <Button
                          variant="outline"
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
