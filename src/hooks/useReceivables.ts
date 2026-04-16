import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DbReceivable,
  DbReceivableInsert,
  DbReceivableUpdate,
  DbReceivableWithRelations,
  PaymentMethod,
} from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { calculateReceivableDue, LateFeeConfig } from "@/lib/receivable-calculator";

export function useReceivables() {
  return useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select(
          `
          *, 
          clients(*), 
          operations(
            *,
            cash_source,
            late_grace_days,
            late_penalty_percent,
            late_interest_monthly_percent,
            late_interest_daily_percent
          )
        `,
        )
        .is("deleted_at", null)
        .order("due_date");

      if (error) throw error;
      return data as DbReceivableWithRelations[];
    },
  });
}

export function useReceivablesByOperation(operationId: string) {
  return useQuery({
    queryKey: ["receivables", "operation", operationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*")
        .eq("operation_id", operationId)
        .is("deleted_at", null)
        .order("installment_number");

      if (error) throw error;
      return data as DbReceivable[];
    },
    enabled: !!operationId,
  });
}

export function useCreateReceivables() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (receivables: DbReceivableInsert[]) => {
      const { data, error } = await supabase.from("receivables").insert(receivables).select();

      if (error) throw error;
      return data as DbReceivable[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      toast({ title: "Parcelas criadas com sucesso!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar parcelas",
        description: error.message,
      });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      paid_at,
      payment_method,
      notes,
      amount,
    }: {
      id: string;
      paid_at: string;
      payment_method: PaymentMethod;
      notes?: string;
      amount: number;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Buscar receivable com dados da operação para calcular encargos reais
      const { data: receivable, error: fetchError } = await supabase
        .from("receivables")
        .select(
          `
          *,
          operations(
            late_grace_days,
            late_penalty_percent,
            late_interest_daily_percent
          )
        `,
        )
        .eq("id", id)
        .single();

      if (fetchError || !receivable) throw new Error("Parcela não encontrada");

      // 2. Calcular encargos reais na data do pagamento
      const config: LateFeeConfig = {
        lateGraceDays: receivable.operations?.late_grace_days ?? 0,
        latePenaltyPercent: Number(receivable.operations?.late_penalty_percent ?? 10),
        lateInterestDailyPercent: Number(receivable.operations?.late_interest_daily_percent ?? 0.5),
      };

      const paymentDate = new Date(paid_at);

      const dueResult = calculateReceivableDue(
        {
          amount: Number(receivable.amount),
          amountPaid: Number(receivable.amount_paid ?? 0),
          penaltyApplied: receivable.penalty_applied ?? false,
          penaltyAmount: Number(receivable.penalty_amount ?? 0),
          interestAccrued: Number(receivable.interest_accrued ?? 0),
          carriedPenaltyAmount: Number(receivable.carried_penalty_amount ?? 0),
          carriedInterestAmount: Number(receivable.carried_interest_amount ?? 0),
          accrualFrozenAt: receivable.accrual_frozen_at ?? null,
          dueDate: receivable.due_date,
        },
        config,
        paymentDate,
      );

      // 3. Alocar o valor pago corretamente entre multa, juros e principal
      //    Ordem de alocação: multa → juros → principal
      let remaining = amount;

      const allocPenalty = Math.min(remaining, dueResult.breakdown.penalty);
      remaining -= allocPenalty;

      const allocInterest = Math.min(remaining, dueResult.breakdown.interest);
      remaining -= allocInterest;

      const allocPrincipal = Math.min(remaining, dueResult.breakdown.principal);

      const shouldApplyPenalty = dueResult.penaltyCurrent > 0 || receivable.penalty_applied;

      // 4. Atualizar receivable
      const { data: updatedReceivable, error: receivableError } = await supabase
        .from("receivables")
        .update({
          status: "PAGO",
          paid_at,
          payment_method,
          // BUG CORRIGIDO: a coluna correta na tabela receivables é 'notes'
          notes,
          amount_paid: amount,
          penalty_applied: shouldApplyPenalty,
          penalty_amount: dueResult.totalPenalty,
          interest_accrued: dueResult.totalInterest,
          last_interest_calc_at: paymentDate.toISOString().split("T")[0],
          accrual_frozen_at: paymentDate.toISOString().split("T")[0],
        })
        .eq("id", id)
        .select()
        .single();

      if (receivableError) throw receivableError;

      // 5. Inserir registro em payments com alocação correta
      //    BUG CORRIGIDO: campo correto é 'note' (não 'notes') na tabela payments
      //    BUG CORRIGIDO: alocação distribuída entre multa, juros e principal
      const { error: paymentError } = await supabase.from("payments").insert({
        receivable_id: id,
        client_id: updatedReceivable.client_id,
        operation_id: updatedReceivable.operation_id,
        amount,
        amount_total: amount,
        alloc_principal: Math.round(allocPrincipal * 100) / 100,
        alloc_penalty: Math.round(allocPenalty * 100) / 100,
        alloc_interest: Math.round(allocInterest * 100) / 100,
        paid_at,
        method: payment_method,
        // BUG CORRIGIDO: coluna correta na tabela payments é 'note' (não 'notes')
        note: notes || null,
      });

      if (paymentError) throw paymentError;

      return updatedReceivable as DbReceivable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast({ title: "Pagamento registrado com sucesso!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao registrar pagamento",
        description: error.message,
      });
    },
  });
}

export function useUpdateReceivable() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: DbReceivableUpdate & { id: string }) => {
      const { data, error } = await supabase.from("receivables").update(updates).eq("id", id).select().single();

      if (error) throw error;
      return data as DbReceivable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar parcela",
        description: error.message,
      });
    },
  });
}
