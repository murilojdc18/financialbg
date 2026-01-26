import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  calculateDetailedLateFees, 
  allocatePayment, 
  determineReceivableStatus,
  LateFeeConfig 
} from '@/lib/late-fee-calculator';
import { DbReceivable, ReceivableStatus, PaymentMethod } from '@/types/database';
import { parseISO, startOfDay, differenceInDays } from 'date-fns';

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
    queryKey: ['payments', 'receivable', receivableId, 'valid'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('receivable_id', receivableId)
        .eq('is_voided', false)
        .order('paid_at', { ascending: false });

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
    queryKey: ['payments', 'receivable', receivableId, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('receivable_id', receivableId)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      return data as PaymentWithVoid[];
    },
    enabled: !!receivableId,
  });
}

/**
 * Recalcula o estado da receivable baseado em todos os pagamentos válidos
 */
async function recomputeReceivable(receivableId: string): Promise<void> {
  // 1. Buscar receivable com dados da operação
  const { data: receivable, error: recError } = await supabase
    .from('receivables')
    .select(`
      *,
      operations(
        late_grace_days,
        late_penalty_percent,
        late_interest_monthly_percent,
        late_interest_daily_percent
      )
    `)
    .eq('id', receivableId)
    .single();

  if (recError || !receivable) {
    throw new Error('Parcela não encontrada');
  }

  // 2. Buscar pagamentos válidos (não anulados)
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('*')
    .eq('receivable_id', receivableId)
    .eq('is_voided', false)
    .order('paid_at', { ascending: true });

  if (payError) throw payError;

  const validPayments = payments || [];
  
  // 3. Calcular totais
  const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Se não há pagamentos válidos, resetar para estado inicial
  if (validPayments.length === 0) {
    const today = startOfDay(new Date());
    const dueDate = parseISO(receivable.due_date);
    const isOverdue = today > dueDate;

    await supabase
      .from('receivables')
      .update({
        amount_paid: 0,
        penalty_applied: false,
        penalty_amount: 0,
        interest_accrued: 0,
        last_interest_calc_at: null,
        paid_at: null,
        payment_method: null,
        status: isOverdue ? 'ATRASADO' : 'EM_ABERTO',
      })
      .eq('id', receivableId);

    return;
  }

  // 4. Recalcular encargos baseado no último pagamento válido
  const lastPayment = validPayments[validPayments.length - 1];
  const lastPaymentDate = parseISO(lastPayment.paid_at);
  
  const config: LateFeeConfig = {
    lateGraceDays: receivable.operations?.late_grace_days ?? 0,
    latePenaltyPercent: Number(receivable.operations?.late_penalty_percent) ?? 10,
    lateInterestDailyPercent: Number(receivable.operations?.late_interest_daily_percent) ?? 0.5,
    lateInterestMonthlyPercent: Number(receivable.operations?.late_interest_monthly_percent) ?? 1,
  };

  // Calcular encargos até a data do último pagamento
  const dueDate = parseISO(receivable.due_date);
  const graceDays = config.lateGraceDays;
  const daysOverdue = Math.max(0, differenceInDays(lastPaymentDate, dueDate) - graceDays);

  let penaltyAmount = 0;
  let interestAmount = 0;
  let penaltyApplied = false;

  if (daysOverdue > 0) {
    // Multa (uma única vez)
    penaltyAmount = Math.round(Number(receivable.amount) * (config.latePenaltyPercent / 100) * 100) / 100;
    penaltyApplied = true;

    // Juros simples diários
    interestAmount = Math.round(
      Number(receivable.amount) * (config.lateInterestDailyPercent / 100) * daysOverdue * 100
    ) / 100;
  }

  // 5. Alocar pagamentos
  const totalDue = Number(receivable.amount) + penaltyAmount + interestAmount;
  
  // Calcular quanto foi alocado a cada componente
  const allocation = allocatePayment(
    totalPaid,
    penaltyAmount,
    interestAmount,
    Number(receivable.amount)
  );

  const penaltyRemaining = Math.max(0, penaltyAmount - allocation.allocatedToPenalty);
  const interestRemaining = Math.max(0, interestAmount - allocation.allocatedToInterest);
  const principalRemaining = Math.max(0, Number(receivable.amount) - allocation.allocatedToPrincipal);

  // 6. Determinar novo status
  const newStatus = determineReceivableStatus(
    principalRemaining,
    penaltyRemaining,
    interestRemaining,
    totalPaid,
    daysOverdue > 0
  );

  const isPaidInFull = newStatus === 'PAGO';

  // 7. Atualizar receivable
  const updateData: Record<string, unknown> = {
    amount_paid: Math.round(totalPaid * 100) / 100,
    penalty_applied: penaltyApplied,
    penalty_amount: penaltyAmount,
    interest_accrued: interestAmount,
    last_interest_calc_at: lastPaymentDate.toISOString().split('T')[0],
    status: newStatus,
    paid_at: isPaidInFull ? lastPayment.paid_at : null,
    payment_method: isPaidInFull ? lastPayment.method : null,
  };

  await supabase
    .from('receivables')
    .update(updateData)
    .eq('id', receivableId);
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
        throw new Error('O valor deve ser maior que zero');
      }

      // 1. Atualizar o pagamento
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          amount,
          paid_at: paidAt.toISOString(),
          method,
          note: note || null,
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // 2. Recalcular receivable
      await recomputeReceivable(receivableId);

      return { paymentId, receivableId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({
        title: 'Pagamento atualizado',
        description: 'O pagamento foi editado e os totais recalculados.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao editar pagamento',
        description: error instanceof Error ? error.message : 'Tente novamente.',
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
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Marcar pagamento como anulado
      const { error: voidError } = await supabase
        .from('payments')
        .update({
          is_voided: true,
          void_reason: voidReason || null,
          voided_at: new Date().toISOString(),
          voided_by: user.id,
        })
        .eq('id', paymentId);

      if (voidError) throw voidError;

      // 2. Recalcular receivable
      await recomputeReceivable(receivableId);

      return { paymentId, receivableId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({
        title: 'Pagamento desfeito',
        description: 'O pagamento foi anulado e os totais recalculados.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao desfazer pagamento',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    },
  });
}
