import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { addDays } from "date-fns";
import {
  calculateReceivableDue,
  allocateDeferToComponents,
  LateFeeConfig,
  DeferPriority,
} from "@/lib/receivable-calculator";
import { ReceivableStatus, PaymentMethod } from "@/types/database";
import { ContractInterestBreakdown } from "@/lib/contract-interest-calculator";
import { isZeroMoney, round2 } from "@/lib/money";

export interface ReceivableForPayment {
  id: string;
  operation_id: string;
  client_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: ReceivableStatus;
  penalty_applied: boolean;
  penalty_amount: number;
  interest_accrued: number;
  last_interest_calc_at: string | null;
  notes: string | null;
  carried_penalty_amount: number;
  carried_interest_amount: number;
  accrual_frozen_at: string | null;
  operations: {
    late_grace_days: number;
    late_penalty_percent: number;
    late_interest_monthly_percent: number;
    late_interest_daily_percent: number;
    // Operation schedule data for contract interest calculation
    principal: number;
    rate_monthly: number;
    term_months: number;
    system: string;
    start_date: string;
    fee_fixed?: number | null;
    fee_insurance?: number | null;
  };
}

export interface FlexiblePaymentV2Input {
  receivableId: string;
  amountTotal: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  note?: string;
  allocation: {
    penalty: number;
    lateInterest: number;
    contractInterest: number;
    principal: number;
  };
  discounts: {
    penalty: number;
    lateInterest: number;
    contractInterest: number;
    principal: number;
  };
  defer?: {
    amount: number;
    toDate: Date;
    priority?: DeferPriority;
  };
  /** When true, creates a COMPLETE copy of the current installment instead of just the remainder */
  isInterestOnlyPayment?: boolean;
  /** Schedule breakdown for the current installment (needed for interest-only reissue) */
  scheduleBreakdown?: ContractInterestBreakdown | null;
  /** Manual adjustment to the new installment amount */
  manualAdjustment?: {
    amount: number;
    reason: string;
    finalAmount: number;
  };
}

/**
 * Calcula o intervalo em dias entre duas parcelas consecutivas.
 * Usado para shift das parcelas futuras ao inserir N+1.
 * BUG CORRIGIDO: antes usava addMonths(+1) fixo, que pode deslocar datas incorretamente
 * em operações com vencimentos em dias diferentes do ciclo mensal.
 * Agora calcula o intervalo real entre a parcela N e N+1 e replica esse intervalo.
 */
function calcShiftDays(
  futureInstallments: { installment_number: number; due_date: string }[],
  newInstallmentNumber: number,
  newDueDate: Date,
): number {
  // Encontra a parcela que vai ser deslocada para N+2 (era N+1)
  const nextInLine = futureInstallments.find((i) => i.installment_number === newInstallmentNumber);

  if (!nextInLine) return 30; // fallback

  // O intervalo correto é: quantos dias estão entre a nova parcela (N+1) e a N+1 original
  const existingDueDate = new Date(nextInLine.due_date + "T12:00:00"); // noon para evitar DST
  const newDueDateNoon = new Date(newDueDate);
  newDueDateNoon.setHours(12, 0, 0, 0);

  const diffMs = existingDueDate.getTime() - newDueDateNoon.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Se a nova parcela está ANTES da existente N+1, precisamos empurrar as futuras
  // pelo mesmo intervalo que seria entre a N+1 nova e a N+1 existente.
  // Se negativo (nova data é depois da existente), usar 30 dias como fallback seguro.
  if (diffDays <= 0) return 30;
  return diffDays;
}

/**
 * Hook V2 para registro de pagamento totalmente flexível
 * - Alocação editável (admin define onde vai cada centavo)
 * - Descontos/isenções negociadas
 * - Postergação com valor customizado
 * - Modo "pagou só juros" → reemite parcela completa
 */
export function useFlexiblePaymentV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: FlexiblePaymentV2Input & { receivable: ReceivableForPayment }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const {
        receivable,
        amountTotal,
        paymentDate,
        paymentMethod,
        note,
        allocation,
        discounts,
        defer,
        isInterestOnlyPayment,
        scheduleBreakdown,
        manualAdjustment,
      } = input;

      const roundedAmountTotal = round2(amountTotal);
      const normalizedAllocation = {
        penalty: round2(allocation.penalty),
        lateInterest: round2(allocation.lateInterest),
        contractInterest: round2(allocation.contractInterest),
        principal: round2(allocation.principal),
      };
      const normalizedDiscounts = {
        penalty: round2(discounts.penalty),
        lateInterest: round2(discounts.lateInterest),
        contractInterest: round2(discounts.contractInterest),
        principal: round2(discounts.principal),
      };
      const totalAllocated = round2(
        normalizedAllocation.penalty +
          normalizedAllocation.lateInterest +
          normalizedAllocation.contractInterest +
          normalizedAllocation.principal,
      );

      if (!isZeroMoney(totalAllocated - roundedAmountTotal)) {
        throw new Error("A soma da alocação deve ser igual ao valor recebido.");
      }

      // Configuração de juros/multa da operação
      const config: LateFeeConfig = {
        lateGraceDays: receivable.operations.late_grace_days ?? 0,
        latePenaltyPercent: Number(receivable.operations.late_penalty_percent ?? 10),
        lateInterestDailyPercent: Number(receivable.operations.late_interest_daily_percent ?? 0.5),
      };

      // Calcular encargos na data do pagamento (para referência)
      const dueResult = calculateReceivableDue(
        {
          amount: receivable.amount,
          amountPaid: receivable.amount_paid ?? 0,
          penaltyApplied: receivable.penalty_applied ?? false,
          penaltyAmount: receivable.penalty_amount ?? 0,
          interestAccrued: receivable.interest_accrued ?? 0,
          carriedPenaltyAmount: receivable.carried_penalty_amount ?? 0,
          carriedInterestAmount: receivable.carried_interest_amount ?? 0,
          accrualFrozenAt: receivable.accrual_frozen_at,
          dueDate: receivable.due_date,
        },
        config,
        paymentDate,
      );

      // Calcular saldo restante após alocação + descontos
      // CRITICAL FIX: dueResult.breakdown uses 3 components:
      //   - penalty = late penalty (multa)
      //   - interest = late mora interest ONLY (NOT contract interest)
      //   - principal = amortization + contract interest combined
      // The user allocates in 4 components, so we must combine alloc_contractInterest + alloc_principal
      // when subtracting from dueResult.breakdown.principal.
      const totalAllocFromPrincipalBucket = round2(
        normalizedAllocation.contractInterest + normalizedAllocation.principal,
      );
      const totalDiscountFromPrincipalBucket = round2(
        normalizedDiscounts.contractInterest + normalizedDiscounts.principal,
      );
      const penaltyRemaining = round2(
        Math.max(0, dueResult.breakdown.penalty - normalizedAllocation.penalty - normalizedDiscounts.penalty),
      );
      const interestRemaining = round2(
        Math.max(0, dueResult.breakdown.interest - normalizedAllocation.lateInterest - normalizedDiscounts.lateInterest),
      );
      const principalRemaining = round2(
        Math.max(0, dueResult.breakdown.principal - totalAllocFromPrincipalBucket - totalDiscountFromPrincipalBucket),
      );
      const totalRemaining = round2(penaltyRemaining + interestRemaining + principalRemaining);
      const hasRemainingBalance = !isZeroMoney(totalRemaining);
      const saldoRestante = {
        principal: isZeroMoney(principalRemaining) ? 0 : principalRemaining,
        penalty: isZeroMoney(penaltyRemaining) ? 0 : penaltyRemaining,
        interest: isZeroMoney(interestRemaining) ? 0 : interestRemaining,
        total: hasRemainingBalance ? totalRemaining : 0,
      };
      const deferAmount = defer ? round2(defer.amount) : 0;
      const hasValidDeferDate = Boolean(defer?.toDate && !Number.isNaN(defer.toDate.getTime()));
      const hasValidDefer = Boolean(defer && deferAmount >= 0.01 && hasValidDeferDate);
      const canReissueInterestOnly = Boolean(
        isInterestOnlyPayment &&
        scheduleBreakdown &&
        scheduleBreakdown.installmentTotal > 0 &&
        normalizedAllocation.principal < 0.01 &&
        normalizedAllocation.contractInterest > 0.01 &&
        dueResult.breakdown.principal > 0.01,
      );

      if (hasRemainingBalance && !hasValidDefer) {
        throw new Error("Existe saldo remanescente. Informe valor e vencimento válidos para a nova parcela.");
      }

      // Any payment always marks the original as PAGO
      const newStatus: ReceivableStatus = "PAGO";
      const newAmountPaid = round2((receivable.amount_paid ?? 0) + roundedAmountTotal);
      const paidAtIso = paymentDate.toISOString();
      const paidAtDate = paidAtIso.split("T")[0];

      // 1. Inserir registro de pagamento com alocação e descontos
      const { error: paymentError } = await supabase.from("payments").insert({
        receivable_id: receivable.id,
        client_id: receivable.client_id,
        operation_id: receivable.operation_id,
        amount: roundedAmountTotal,
        amount_total: roundedAmountTotal,
        alloc_penalty: normalizedAllocation.penalty,
        alloc_interest: round2(normalizedAllocation.lateInterest + normalizedAllocation.contractInterest),
        alloc_late_interest: normalizedAllocation.lateInterest,
        alloc_contract_interest: normalizedAllocation.contractInterest,
        alloc_principal: normalizedAllocation.principal,
        discount_penalty: normalizedDiscounts.penalty,
        discount_interest: round2(normalizedDiscounts.lateInterest + normalizedDiscounts.contractInterest),
        discount_late_interest: normalizedDiscounts.lateInterest,
        discount_contract_interest: normalizedDiscounts.contractInterest,
        discount_principal: normalizedDiscounts.principal,
        paid_at: paidAtIso,
        method: paymentMethod,
        note: note || null,
      });

      if (paymentError) throw paymentError;

      // 2. Atualizar receivable — SEMPRE como PAGO
      const shouldApplyPenalty = dueResult.penaltyCurrent > 0 || receivable.penalty_applied;

      const receivableUpdate: Record<string, unknown> = {
        amount_paid: newAmountPaid,
        penalty_amount: dueResult.totalPenalty,
        interest_accrued: dueResult.totalInterest,
        last_interest_calc_at: paidAtDate,
        status: "PAGO" as ReceivableStatus,
        penalty_applied: shouldApplyPenalty,
        paid_at: paidAtIso,
        payment_method: paymentMethod,
        accrual_frozen_at: paidAtDate,
      };

      const { error: updateError } = await supabase
        .from("receivables")
        .update(receivableUpdate)
        .eq("id", receivable.id);

      if (updateError) throw updateError;

      if (!hasRemainingBalance) {
        return {
          receivableId: receivable.id,
          newReceivableId: null,
          allocation: normalizedAllocation,
          discounts: normalizedDiscounts,
          newStatus,
          isInterestOnlyPayment: false,
          saldoRestante,
        };
      }

      // 3. Reemitir saldo se solicitado (criar nova parcela como N+1)
      let newReceivableId: string | null = null;

      if (defer && hasValidDefer) {
        const newDueDate = defer.toDate;
        const currentN = receivable.installment_number;
        const newInstallmentNumber = currentN + 1;

        // ====== SHIFT FUTURE INSTALLMENTS (descending order to avoid conflicts) ======
        const { data: futureInstallments, error: fetchError } = await supabase
          .from("receivables")
          .select("id, installment_number, due_date")
          .eq("operation_id", receivable.operation_id)
          .gte("installment_number", newInstallmentNumber)
          .order("installment_number", { ascending: false });

        if (fetchError) throw fetchError;

        if (futureInstallments && futureInstallments.length > 0) {
          // BUG CORRIGIDO: a versão anterior usava addMonths(currentDueDate, 1) fixo para todas
          // as parcelas futuras. Isso é errado porque o intervalo entre as parcelas pode não ser
          // exatamente 1 mês (ex: parcelas com vencimento em dia específico ou operações SAC
          // com datas customizadas). Agora calculamos o intervalo real entre a nova parcela N+1
          // e a parcela que já existia como N+1, e aplicamos esse mesmo intervalo em dias.
          const shiftDays = calcShiftDays(futureInstallments, newInstallmentNumber, newDueDate);

          for (const installment of futureInstallments) {
            const newNumber = installment.installment_number + 1;
            // Shift: soma o intervalo calculado na data original de cada parcela futura
            const currentDueDate = new Date(installment.due_date + "T12:00:00");
            const shiftedDueDate = addDays(currentDueDate, shiftDays);

            const { error: shiftError } = await supabase
              .from("receivables")
              .update({
                installment_number: newNumber,
                due_date: shiftedDueDate.toISOString().split("T")[0],
              })
              .eq("id", installment.id);

            if (shiftError) throw shiftError;
          }
        }

        // Determine new installment values based on payment mode
        let newInstallmentAmount: number;
        let newCarriedPenalty = 0;
        let newCarriedInterest = 0;
        let renegotiationNote: string;

        if (canReissueInterestOnly && scheduleBreakdown) {
          // ===== INTEREST-ONLY: Reissue a COMPLETE copy of the current installment =====
          // The amortization wasn't paid, so we reissue the same installment total
          newInstallmentAmount = round2(scheduleBreakdown.installmentTotal);
          renegotiationNote = `Pagamento somente de juros. Parcela completa reemitida como ${newInstallmentNumber}ª (${newDueDate.toISOString().split("T")[0]}): Juros Contratual R$ ${scheduleBreakdown.contractInterest.toFixed(2)} + Amortização R$ ${scheduleBreakdown.amortization.toFixed(2)} = Total R$ ${scheduleBreakdown.installmentTotal.toFixed(2)}`;
        } else {
          // ===== STANDARD DEFER: carry only the remaining balance =====
          const deferAllocation = allocateDeferToComponents(
            deferAmount,
            penaltyRemaining,
            interestRemaining,
            principalRemaining,
            defer.priority || "principal",
          );
          newInstallmentAmount = round2(deferAllocation.carriedPrincipal);
          newCarriedPenalty = round2(deferAllocation.carriedPenalty);
          newCarriedInterest = round2(deferAllocation.carriedInterest);
          renegotiationNote = `Parcela reemitida para ${newInstallmentNumber} (${newDueDate.toISOString().split("T")[0]}): Principal R$ ${deferAllocation.carriedPrincipal.toFixed(2)} + Multa R$ ${deferAllocation.carriedPenalty.toFixed(2)} + Juros R$ ${deferAllocation.carriedInterest.toFixed(2)}`;
        }

        // Apply manual adjustment if provided
        let adjustmentAmount = 0;
        let adjustmentReason = "";
        let isManualAmount = false;

        if (manualAdjustment && !isZeroMoney(manualAdjustment.amount)) {
          adjustmentAmount = round2(manualAdjustment.amount);
          adjustmentReason = manualAdjustment.reason;
          isManualAmount = true;
          // Override the installment amount with the final amount
          newInstallmentAmount = round2(manualAdjustment.finalAmount);
          renegotiationNote += ` | Ajuste manual: R$ ${adjustmentAmount > 0 ? "+" : ""}${adjustmentAmount.toFixed(2)} (${adjustmentReason})`;
        }

        // Insert new installment as N+1
        const newReceivableInsert: Record<string, unknown> = {
          operation_id: receivable.operation_id,
          client_id: receivable.client_id,
          installment_number: newInstallmentNumber,
          due_date: newDueDate.toISOString().split("T")[0],
          amount: newInstallmentAmount,
          status: "EM_ABERTO" as ReceivableStatus,
          amount_paid: 0,
          penalty_applied: false,
          penalty_amount: 0,
          interest_accrued: 0,
          carried_penalty_amount: newCarriedPenalty,
          carried_interest_amount: newCarriedInterest,
          renegotiated_from_receivable_id: receivable.id,
          manual_adjustment_amount: adjustmentAmount,
          manual_adjustment_reason: adjustmentReason || null,
          is_manual_amount: isManualAmount,
        };

        const { data: newReceivable, error: insertError } = await supabase
          .from("receivables")
          .insert(newReceivableInsert as any)
          .select("id")
          .single();

        if (insertError) throw insertError;

        newReceivableId = newReceivable?.id ?? null;

        // Update original with renegotiation link
        await supabase
          .from("receivables")
          .update({
            renegotiated_to_receivable_id: newReceivableId,
            notes: receivable.notes ? `${receivable.notes}\n${renegotiationNote}` : renegotiationNote,
          })
          .eq("id", receivable.id);
      }

      return {
        receivableId: receivable.id,
        newReceivableId,
        allocation: normalizedAllocation,
        discounts: normalizedDiscounts,
        newStatus,
        isInterestOnlyPayment: canReissueInterestOnly,
        saldoRestante,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["operations"] });

      if (result.newReceivableId) {
        toast({
          title: "Parcela quitada!",
          description: result.isInterestOnlyPayment
            ? "Pagamento de juros registrado. Parcela completa reemitida."
            : "Saldo restante postergado para nova parcela.",
        });
      } else {
        toast({
          title: "Parcela quitada!",
          description: "O pagamento foi registrado com sucesso.",
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao registrar pagamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });
}
