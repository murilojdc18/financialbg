import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
// BUG CORRIGIDO: substituído late-fee-calculator (legado) pela receivable-calculator (nova).
// A calculadora nova suporta carried_penalty_amount, carried_interest_amount e accrual_frozen_at,
// necessários para recalcular corretamente parcelas renegociadas após void/edição de pagamento.
import {
  calculateReceivableDue,
  allocatePaymentToComponents,
  determineStatus,
  LateFeeConfig,
} from "@/lib/receivable-calculator";
import { DbReceivable, ReceivableStatus, PaymentMethod } from "@/types/database";
import { parseISO, startOfDay } from "date-fns";

// Interface para pagamento com campos de void
export interface PaymentWithVoid {
  id: string;
  receivable_id: string;
  client_id: string | null;
  operation_id: string | null;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  note: string | null;
  notes: string | null;
  is_voided: boolean;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ReceivableWithOperation extends DbReceivable {
  operations: {
    late_grace_days: number;
    late_penalty_percent: number;
    late_interest_monthly_percent: number;
    late_interest_daily_percent: number;
  };
}

/**
 * Hook para buscar pagamentos válidos (não anulados) de uma receivable
 */
export function useValidPaymentsByReceivable(receivableId: string) {
  return useQuery({
    queryKey: ["payments", "receivable", receivableId, "valid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("receivable_id", receivableId)
        .eq("is_voided", false)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      return data as PaymentWithVoid[];
    },
    enabled: !!receivableId,
  });
}

/**
 * Hook para buscar TODOS os pagamentos (incluindo anulados) de uma receivable
 */
export function useAllPaymentsByReceivable(receivableId: string) {
  return useQuery({
    queryKey: ["payments", "receivable", receivableId, "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("receivable_id", receivableId)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      return data as PaymentWithVoid[];
    },
    enabled: !!receivableId,
  });
}

/**
 * Recalcula o estado da receivable baseado em todos os pagamentos válidos.
 *
 * BUG CORRIGIDO: A versão anterior usava late-fee-calculator que ignorava os campos
 * carried_penalty_amount, carried_interest_amount e accrual_frozen_at. Isso causava
 * valores incorretos ao fazer void/edição de pagamento em parcelas renegociadas.
 * Agora usamos calculateReceivableDue (receivable-calculator) que trata todos esses campos.
 */
async function recomputeReceivable(receivableId: string): Promise<void> {
  // 1. Buscar receivable com dados da operação (incluindo campos de renegociação)
  const { data: receivable, error: recError } = await supabase
    .from("receivables")
    .select(
      `
      *,
      operations(
        late_grace_days,
        late_penalty_percent,
        late_interest_monthly_percent,
        late_interest_daily_percent
      )
    `,
    )
    .eq("id", receivableId)
    .single();

  if (recError || !receivable) {
    throw new Error("Parcela não encontrada");
  }

  // 2. Buscar pagamentos válidos (não anulados) em ordem cronológica
  const { data: payments, error: payError } = await supabase
    .from("payments")
    .select("*")
    .eq("receivable_id", receivableId)
    .eq("is_voided", false)
    .order("paid_at", { ascending: true });

  if (payError) throw payError;

  const validPayments = payments || [];

  // 3. Se não há pagamentos válidos, resetar para estado inicial preservando carried fees
  if (validPayments.length === 0) {
    const today = startOfDay(new Date());
    const dueDate = parseISO(receivable.due_date);
    const isOverdue = today > dueDate;

    await supabase
      .from("receivables")
      .update({
        amount_paid: 0,
        penalty_applied: false,
        penalty_amount: 0,
        interest_accrued: 0,
        last_interest_calc_at: null,
        paid_at: null,
        payment_method: null,
        // Descongelar accrual ao anular todos os pagamentos
        accrual_frozen_at: null,
        status: (isOverdue ? "ATRASADO" : "EM_ABERTO") as ReceivableStatus,
      })
      .eq("id", receivableId);

    return;
  }

  // 4. Usar o último pagamento válido como data de referência
  const lastPayment = validPayments[validPayments.length - 1];
  const lastPaymentDate = parseISO(lastPayment.paid_at);

  const config: LateFeeConfig = {
    lateGraceDays: receivable.operations?.late_grace_days ?? 0,
    latePenaltyPercent: Number(receivable.operations?.late_penalty_percent ?? 10),
    lateInterestDailyPercent: Number(receivable.operations?.late_interest_daily_percent ?? 0.5),
  };

  // 5. Calcular encargos completos na data do último pagamento.
  //    calculateReceivableDue já considera carried_penalty_amount, carried_interest_amount
  //    e accrual_frozen_at — que o late-fee-calculator ignorava.
  //
  //    Para o recálculo pós-void precisamos reconstruir o estado "zerado" dos campos
  //    de multa/juros, pois vamos recalculá-los do zero a partir do vencimento original.
  //    Os campos carried_* do receivable NÃO devem ser alterados pois são históricos
  //    de renegociações anteriores, não dependem dos pagamentos atuais.
  const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const dueResult = calculateReceivableDue(
    {
      amount: Number(receivable.amount),
      // Para recalcular do zero passamos amountPaid = 0 e os encargos já calculados como 0.
      // Assim obtemos os totais brutos de encargos que deveriam estar registrados.
      amountPaid: 0,
      penaltyApplied: false,
      penaltyAmount: 0,
      interestAccrued: 0,
      // Mantemos os carried fees do receivable pois são históricos de renegociações
      carriedPenaltyAmount: Number(receivable.carried_penalty_amount ?? 0),
      carriedInterestAmount: Number(receivable.carried_interest_amount ?? 0),
      // Se a parcela estava congelada antes do último pagamento, respeitamos o freeze
      accrualFrozenAt: receivable.accrual_frozen_at ?? null,
      dueDate: receivable.due_date,
    },
    config,
    lastPaymentDate,
  );

  // 6. Alocar o total pago na ordem: multa → juros → principal
  const allocation = allocatePaymentToComponents(
    totalPaid,
    dueResult.breakdown.penalty,
    dueResult.breakdown.interest,
    dueResult.breakdown.principal,
  );

  // 7. Determinar novo status
  const newStatus = determineStatus(
    allocation.newPrincipalRemaining,
    allocation.newPenaltyRemaining,
    allocation.newInterestRemaining,
    totalPaid,
    dueResult.isOverdue,
  );

  const isPaidInFull = newStatus === "PAGO";

  // 8. Atualizar receivable com os valores recalculados
  const updateData: Record<string, unknown> = {
    amount_paid: Math.round(totalPaid * 100) / 100,
    penalty_applied: dueResult.penaltyCurrent > 0 || dueResult.carriedPenalty > 0,
    penalty_amount: dueResult.totalPenalty,
    interest_accrued: dueResult.totalInterest,
    last_interest_calc_at: lastPaymentDate.toISOString().split("T")[0],
    status: newStatus,
    paid_at: isPaidInFull ? lastPayment.paid_at : null,
    payment_method: isPaidInFull ? lastPayment.method : null,
    // Se foi quitado, congelar na data do último pagamento; se ainda em aberto, descongelar
    accrual_frozen_at: isPaidInFull ? lastPaymentDate.toISOString().split("T")[0] : null,
  };

  await supabase.from("receivables").update(updateData).eq("id", receivableId);
}

/**
 * Hook para editar um pagamento existente
 */
export function useEditPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      paymentId,
      receivableId,
      amount,
      paidAt,
      method,
      note,
    }: {
      paymentId: string;
      receivableId: string;
      amount: number;
      paidAt: Date;
      method: PaymentMethod;
      note?: string;
    }) => {
      if (amount <= 0) {
        throw new Error("O valor deve ser maior que zero");
      }

      // 1. Atualizar o pagamento
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          amount,
          paid_at: paidAt.toISOString(),
          method,
          note: note || null,
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      // 2. Recalcular receivable com a calculadora correta
      await recomputeReceivable(receivableId);

      return { paymentId, receivableId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast({
        title: "Pagamento atualizado",
        description: "O pagamento foi editado e os totais recalculados.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao editar pagamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });
}

/**
 * Hook para anular (void) um pagamento
 */
export function useVoidPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      paymentId,
      receivableId,
      voidReason,
    }: {
      paymentId: string;
      receivableId: string;
      voidReason?: string;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Marcar pagamento como anulado
      const { error: voidError } = await supabase
        .from("payments")
        .update({
          is_voided: true,
          void_reason: voidReason || null,
          voided_at: new Date().toISOString(),
          voided_by: user.id,
        })
        .eq("id", paymentId);

      if (voidError) throw voidError;

      // 2. Recalcular receivable com a calculadora correta
      await recomputeReceivable(receivableId);

      return { paymentId, receivableId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast({
        title: "Pagamento desfeito",
        description: "O pagamento foi anulado e os totais recalculados.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao desfazer pagamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });
}
