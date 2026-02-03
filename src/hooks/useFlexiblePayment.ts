import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  calculateReceivableDue, 
  allocatePaymentToComponents,
  allocateDeferToComponents,
  determineStatus,
  LateFeeConfig 
} from '@/lib/receivable-calculator';
import { DbPayment, DbReceivable, ReceivableStatus, PaymentMethod } from '@/types/database';

export interface FlexiblePaymentInput {
  receivableId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  note?: string;
  // Postergar saldo
  deferBalance?: boolean;
  deferDays?: number;
  deferToDate?: Date;
  // Valor customizado a postergar (se não for o saldo total)
  customDeferAmount?: number;
}

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
  // Novos campos
  carried_penalty_amount: number;
  carried_interest_amount: number;
  accrual_frozen_at: string | null;
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
export function usePaymentsByReceivable(receivableId: string) {
  return useQuery({
    queryKey: ['payments', 'receivable', receivableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('receivable_id', receivableId)
        .eq('is_voided', false)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      return data as DbPayment[];
    },
    enabled: !!receivableId,
  });
}

/**
 * Hook principal para registro de pagamento flexível
 * Corrigido para carregar encargos na nova parcela ao postergar
 */
export function useFlexiblePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: FlexiblePaymentInput & { receivable: ReceivableForPayment }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { receivable, amount, paymentDate, paymentMethod, note, deferBalance, deferDays, deferToDate, customDeferAmount } = input;
      
      // Configuração de juros/multa da operação
      const config: LateFeeConfig = {
        lateGraceDays: receivable.operations.late_grace_days ?? 0,
        latePenaltyPercent: Number(receivable.operations.late_penalty_percent) ?? 10,
        lateInterestDailyPercent: Number(receivable.operations.late_interest_daily_percent) ?? 0.5,
      };

      // Calcular encargos detalhados na data do pagamento
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
        paymentDate
      );

      // Alocar pagamento
      const allocation = allocatePaymentToComponents(
        amount,
        dueResult.breakdown.penalty,
        dueResult.breakdown.interest,
        dueResult.breakdown.principal
      );

      // Calcular novos valores após o pagamento
      const newAmountPaid = (receivable.amount_paid ?? 0) + amount;
      
      // Atualizar valores de multa/juros registrados
      const updatedPenaltyAmount = dueResult.totalPenalty;
      const updatedInterestAccrued = dueResult.totalInterest;
      const shouldApplyPenalty = dueResult.penaltyCurrent > 0 || receivable.penalty_applied;

      // Determinar novo status
      const newStatus = determineStatus(
        allocation.newPrincipalRemaining,
        allocation.newPenaltyRemaining,
        allocation.newInterestRemaining,
        newAmountPaid,
        dueResult.isOverdue
      );

      const isPaidInFull = newStatus === 'PAGO';

      // 1. Inserir registro de pagamento com alocação
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          receivable_id: receivable.id,
          client_id: receivable.client_id,
          operation_id: receivable.operation_id,
          amount,
          amount_total: amount,
          alloc_penalty: allocation.allocatedToPenalty,
          alloc_interest: allocation.allocatedToInterest,
          alloc_principal: allocation.allocatedToPrincipal,
          paid_at: paymentDate.toISOString(),
          method: paymentMethod,
          note: note || null,
        });

      if (paymentError) throw paymentError;

      // 2. Atualizar receivable
      const receivableUpdate: Record<string, unknown> = {
        amount_paid: newAmountPaid,
        penalty_amount: updatedPenaltyAmount,
        interest_accrued: updatedInterestAccrued,
        last_interest_calc_at: paymentDate.toISOString().split('T')[0],
        status: newStatus,
        penalty_applied: shouldApplyPenalty,
      };

      // Definir paid_at apenas se totalmente quitada
      if (isPaidInFull) {
        receivableUpdate.paid_at = paymentDate.toISOString();
        receivableUpdate.payment_method = paymentMethod;
      }

      const { error: updateError } = await supabase
        .from('receivables')
        .update(receivableUpdate)
        .eq('id', receivable.id);

      if (updateError) throw updateError;

      // 3. Postergar saldo se solicitado
      let newReceivableId: string | null = null;
      
      if (deferBalance && !isPaidInFull) {
        // Saldo restante total disponível após o pagamento
        const saldoPrincipalRestante = allocation.newPrincipalRemaining;
        const saldoPenaltyRestante = allocation.newPenaltyRemaining;
        const saldoInterestRestante = allocation.newInterestRemaining;
        const saldoTotalRestante = saldoPrincipalRestante + saldoPenaltyRestante + saldoInterestRestante;
        
        // Determinar valor a postergar (usa customDeferAmount se fornecido, senão saldo total)
        const valorAPostegar = customDeferAmount !== undefined && customDeferAmount >= 0
          ? Math.min(customDeferAmount, saldoTotalRestante)
          : saldoTotalRestante;
        
        if (valorAPostegar > 0.01) {
          // Alocar o valor a postergar: juros -> multa -> principal
          const deferAllocation = allocateDeferToComponents(
            valorAPostegar,
            saldoPenaltyRestante,
            saldoInterestRestante,
            saldoPrincipalRestante
          );
          
          // Calcular nova data de vencimento A PARTIR DA DATA DO PAGAMENTO
          let newDueDate: Date;
          if (deferToDate) {
            newDueDate = deferToDate;
          } else {
            const days = deferDays || 30;
            // CORREÇÃO: Usar paymentDate como base, não new Date()
            newDueDate = new Date(paymentDate);
            newDueDate.setDate(newDueDate.getDate() + days);
          }

          // Buscar próximo número de parcela
          const { data: maxInstallment } = await supabase
            .from('receivables')
            .select('installment_number')
            .eq('operation_id', receivable.operation_id)
            .order('installment_number', { ascending: false })
            .limit(1)
            .single();

          const nextInstallmentNumber = (maxInstallment?.installment_number ?? 0) + 1;

          // CRIAR NOVA PARCELA COM ENCARGOS CARREGADOS
          const { data: newReceivable, error: insertError } = await supabase
            .from('receivables')
            .insert({
              operation_id: receivable.operation_id,
              client_id: receivable.client_id,
              installment_number: nextInstallmentNumber,
              due_date: newDueDate.toISOString().split('T')[0],
              // Principal postergado
              amount: deferAllocation.carriedPrincipal,
              status: 'EM_ABERTO' as ReceivableStatus,
              amount_paid: 0,
              // Não reaplicar multa (penalty_applied = false para novo vencimento)
              penalty_applied: false,
              penalty_amount: 0,
              interest_accrued: 0,
              // ENCARGOS CARREGADOS
              carried_penalty_amount: deferAllocation.carriedPenalty,
              carried_interest_amount: deferAllocation.carriedInterest,
              // Rastrear origem
              renegotiated_from_receivable_id: receivable.id,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          
          newReceivableId = newReceivable?.id ?? null;

          // Determinar status da parcela original
          const saldoQuefica = saldoTotalRestante - valorAPostegar;
          const originalStatus: ReceivableStatus = saldoQuefica <= 0.01 ? 'PAGO' : 'PARCIAL';

          // ATUALIZAR PARCELA ORIGINAL
          const renegotiationNote = `Saldo postergado: Principal R$ ${deferAllocation.carriedPrincipal.toFixed(2)} + Multa R$ ${deferAllocation.carriedPenalty.toFixed(2)} + Juros R$ ${deferAllocation.carriedInterest.toFixed(2)} → Parcela ${nextInstallmentNumber}`;
          
          const originalUpdate: Record<string, unknown> = {
            renegotiated_to_receivable_id: newReceivableId,
            // Congelar acumulação na data do pagamento
            accrual_frozen_at: paymentDate.toISOString().split('T')[0],
            notes: receivable.notes 
              ? `${receivable.notes}\n${renegotiationNote}` 
              : renegotiationNote,
            status: originalStatus,
          };

          // Se zerou tudo, marcar como pago
          if (originalStatus === 'PAGO') {
            originalUpdate.paid_at = paymentDate.toISOString();
          }

          await supabase
            .from('receivables')
            .update(originalUpdate)
            .eq('id', receivable.id);
        }
      }

      return {
        receivableId: receivable.id,
        newReceivableId,
        allocation,
        newStatus,
        isPaidInFull,
        // Retornar para debugging
        saldoRestante: {
          principal: allocation.newPrincipalRemaining,
          penalty: allocation.newPenaltyRemaining,
          interest: allocation.newInterestRemaining,
        },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      
      if (result.newReceivableId) {
        toast({
          title: 'Pagamento registrado',
          description: `Saldo restante (principal + encargos) postergado para nova parcela.`,
        });
      } else if (result.isPaidInFull) {
        toast({
          title: 'Parcela quitada!',
          description: 'O pagamento foi registrado com sucesso.',
        });
      } else {
        toast({
          title: 'Pagamento parcial registrado',
          description: 'O saldo restante continua em aberto.',
        });
      }
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar pagamento',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    },
  });
}
