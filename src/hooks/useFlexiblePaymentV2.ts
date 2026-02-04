import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths } from 'date-fns';
import { 
  calculateReceivableDue, 
  allocateDeferToComponents,
  LateFeeConfig 
} from '@/lib/receivable-calculator';
import { ReceivableStatus, PaymentMethod } from '@/types/database';

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
    interest: number;
    principal: number;
  };
  discounts: {
    penalty: number;
    interest: number;
    principal: number;
  };
  defer?: {
    amount: number;
    toDate: Date;
  };
}

/**
 * Hook V2 para registro de pagamento totalmente flexível
 * - Alocação editável (admin define onde vai cada centavo)
 * - Descontos/isenções negociadas
 * - Postergação com valor customizado
 */
export function useFlexiblePaymentV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: FlexiblePaymentV2Input & { receivable: ReceivableForPayment }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { 
        receivable, 
        amountTotal, 
        paymentDate, 
        paymentMethod, 
        note, 
        allocation, 
        discounts, 
        defer 
      } = input;
      
      // Configuração de juros/multa da operação
      const config: LateFeeConfig = {
        lateGraceDays: receivable.operations.late_grace_days ?? 0,
        latePenaltyPercent: Number(receivable.operations.late_penalty_percent) ?? 10,
        lateInterestDailyPercent: Number(receivable.operations.late_interest_daily_percent) ?? 0.5,
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
        paymentDate
      );

      // Calcular saldo restante após alocação + descontos
      const penaltyRemaining = Math.max(0, dueResult.breakdown.penalty - allocation.penalty - discounts.penalty);
      const interestRemaining = Math.max(0, dueResult.breakdown.interest - allocation.interest - discounts.interest);
      const principalRemaining = Math.max(0, dueResult.breakdown.principal - allocation.principal - discounts.principal);
      const totalRemaining = penaltyRemaining + interestRemaining + principalRemaining;

      // Determinar novo status
      let newStatus: ReceivableStatus;
      if (totalRemaining <= 0.01) {
        newStatus = 'PAGO';
      } else if (amountTotal > 0) {
        newStatus = 'PARCIAL';
      } else if (dueResult.isOverdue) {
        newStatus = 'ATRASADO';
      } else {
        newStatus = 'EM_ABERTO';
      }

      const isPaidInFull = newStatus === 'PAGO';
      const newAmountPaid = (receivable.amount_paid ?? 0) + amountTotal;

      // 1. Inserir registro de pagamento com alocação e descontos
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          receivable_id: receivable.id,
          client_id: receivable.client_id,
          operation_id: receivable.operation_id,
          amount: amountTotal,
          amount_total: amountTotal,
          alloc_penalty: allocation.penalty,
          alloc_interest: allocation.interest,
          alloc_principal: allocation.principal,
          discount_penalty: discounts.penalty,
          discount_interest: discounts.interest,
          discount_principal: discounts.principal,
          paid_at: paymentDate.toISOString(),
          method: paymentMethod,
          note: note || null,
        });

      if (paymentError) throw paymentError;

      // 2. Atualizar receivable
      const shouldApplyPenalty = dueResult.penaltyCurrent > 0 || receivable.penalty_applied;
      
      const receivableUpdate: Record<string, unknown> = {
        amount_paid: newAmountPaid,
        penalty_amount: dueResult.totalPenalty,
        interest_accrued: dueResult.totalInterest,
        last_interest_calc_at: paymentDate.toISOString().split('T')[0],
        status: newStatus,
        penalty_applied: shouldApplyPenalty,
      };

      if (isPaidInFull) {
        receivableUpdate.paid_at = paymentDate.toISOString();
        receivableUpdate.payment_method = paymentMethod;
      }

      const { error: updateError } = await supabase
        .from('receivables')
        .update(receivableUpdate)
        .eq('id', receivable.id);

      if (updateError) throw updateError;

      // 3. Reemitir saldo se solicitado (criar nova parcela como N+1)
      let newReceivableId: string | null = null;
      
      if (defer && defer.amount > 0.01 && !isPaidInFull) {
        // Alocar o valor a postergar: juros -> multa -> principal
        const deferAllocation = allocateDeferToComponents(
          defer.amount,
          penaltyRemaining,
          interestRemaining,
          principalRemaining
        );
        
        // Data de vencimento da nova parcela (vem do DatePicker)
        const newDueDate = defer.toDate;
        
        // Número da nova parcela = N+1 (próxima após a atual)
        const currentN = receivable.installment_number;
        const newInstallmentNumber = currentN + 1;

        // ====== SHIFT FUTURE INSTALLMENTS ======
        // Step 1: Fetch all future installments (>= N+1)
        const { data: futureInstallments, error: fetchError } = await supabase
          .from('receivables')
          .select('id, installment_number, due_date')
          .eq('operation_id', receivable.operation_id)
          .gte('installment_number', newInstallmentNumber)
          .order('installment_number', { ascending: false }); // DESC order to avoid conflicts
        
        if (fetchError) throw fetchError;

        // Step 2: Shift each future installment (+1 to number, +1 month to due_date)
        // Process in descending order to avoid unique constraint conflicts
        if (futureInstallments && futureInstallments.length > 0) {
          for (const installment of futureInstallments) {
            const newNumber = installment.installment_number + 1;
            const currentDueDate = new Date(installment.due_date);
            const shiftedDueDate = addMonths(currentDueDate, 1);
            
            const { error: shiftError } = await supabase
              .from('receivables')
              .update({
                installment_number: newNumber,
                due_date: shiftedDueDate.toISOString().split('T')[0],
              })
              .eq('id', installment.id);
            
            if (shiftError) throw shiftError;
          }
        }

        // Step 3: Insert new installment as N+1
        const { data: newReceivable, error: insertError } = await supabase
          .from('receivables')
          .insert({
            operation_id: receivable.operation_id,
            client_id: receivable.client_id,
            installment_number: newInstallmentNumber,
            due_date: newDueDate.toISOString().split('T')[0],
            amount: deferAllocation.carriedPrincipal,
            status: 'EM_ABERTO' as ReceivableStatus,
            amount_paid: 0,
            penalty_applied: false,
            penalty_amount: 0,
            interest_accrued: 0,
            carried_penalty_amount: deferAllocation.carriedPenalty,
            carried_interest_amount: deferAllocation.carriedInterest,
            renegotiated_from_receivable_id: receivable.id,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        
        newReceivableId = newReceivable?.id ?? null;

        // Step 4: Update original installment status
        const saldoQueFica = totalRemaining - defer.amount;
        const originalStatus: ReceivableStatus = saldoQueFica <= 0.01 ? 'RENEGOCIADA' : 'PARCIAL';

        const renegotiationNote = `Parcela reemitida para ${newInstallmentNumber} (${newDueDate.toISOString().split('T')[0]}): Principal R$ ${deferAllocation.carriedPrincipal.toFixed(2)} + Multa R$ ${deferAllocation.carriedPenalty.toFixed(2)} + Juros R$ ${deferAllocation.carriedInterest.toFixed(2)}`;
        
        const originalUpdate: Record<string, unknown> = {
          renegotiated_to_receivable_id: newReceivableId,
          accrual_frozen_at: paymentDate.toISOString().split('T')[0],
          notes: receivable.notes 
            ? `${receivable.notes}\n${renegotiationNote}` 
            : renegotiationNote,
          status: originalStatus,
        };

        if (originalStatus === 'RENEGOCIADA') {
          originalUpdate.paid_at = paymentDate.toISOString();
        }

        await supabase
          .from('receivables')
          .update(originalUpdate)
          .eq('id', receivable.id);
      }

      return {
        receivableId: receivable.id,
        newReceivableId,
        allocation,
        discounts,
        newStatus,
        isPaidInFull,
        saldoRestante: {
          principal: principalRemaining,
          penalty: penaltyRemaining,
          interest: interestRemaining,
          total: totalRemaining,
        },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      
      if (result.newReceivableId) {
        toast({
          title: 'Pagamento registrado',
          description: `Saldo postergado para nova parcela.`,
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
