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
  operations: {
    late_grace_days: number;
    late_penalty_percent: number;
    late_interest_monthly_percent: number;
    late_interest_daily_percent: number;
  };
}

/**
 * Hook para buscar pagamentos de uma receivable
 */
export function usePaymentsByReceivable(receivableId: string) {
  return useQuery({
    queryKey: ['payments', 'receivable', receivableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('receivable_id', receivableId)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      return data as DbPayment[];
    },
    enabled: !!receivableId,
  });
}

/**
 * Hook principal para registro de pagamento flexível
 */
export function useFlexiblePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: FlexiblePaymentInput & { receivable: ReceivableForPayment }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { receivable, amount, paymentDate, paymentMethod, note, deferBalance, deferDays, deferToDate } = input;
      
      // Configuração de juros/multa da operação
      const config: LateFeeConfig = {
        lateGraceDays: receivable.operations.late_grace_days ?? 0,
        latePenaltyPercent: Number(receivable.operations.late_penalty_percent) ?? 10,
        lateInterestDailyPercent: Number(receivable.operations.late_interest_daily_percent) ?? 0.5,
        lateInterestMonthlyPercent: Number(receivable.operations.late_interest_monthly_percent) ?? 1,
      };

      // Calcular encargos detalhados
      const feeResult = calculateDetailedLateFees(
        {
          amount: receivable.amount,
          amountPaid: receivable.amount_paid ?? 0,
          penaltyApplied: receivable.penalty_applied ?? false,
          penaltyAmount: receivable.penalty_amount ?? 0,
          interestAccrued: receivable.interest_accrued ?? 0,
          lastInterestCalcAt: receivable.last_interest_calc_at,
          dueDate: receivable.due_date,
        },
        config,
        paymentDate
      );

      // Atualizar multa e juros no receivable
      const updatedPenaltyAmount = (receivable.penalty_amount ?? 0) + feeResult.newPenalty;
      const updatedInterestAccrued = (receivable.interest_accrued ?? 0) + feeResult.newInterest;
      const shouldApplyPenalty = feeResult.newPenalty > 0;

      // Alocar pagamento
      const allocation = allocatePayment(
        amount,
        feeResult.penaltyRemaining + feeResult.newPenalty,
        feeResult.interestRemaining + feeResult.newInterest,
        feeResult.principalRemaining
      );

      // Calcular novos saldos após este pagamento
      const newPenaltyRemaining = Math.max(0, (feeResult.penaltyRemaining + feeResult.newPenalty) - allocation.allocatedToPenalty);
      const newInterestRemaining = Math.max(0, (feeResult.interestRemaining + feeResult.newInterest) - allocation.allocatedToInterest);
      const newPrincipalRemaining = Math.max(0, feeResult.principalRemaining - allocation.allocatedToPrincipal);
      
      const newAmountPaid = (receivable.amount_paid ?? 0) + amount;

      // Determinar novo status
      const newStatus = determineReceivableStatus(
        newPrincipalRemaining,
        newPenaltyRemaining,
        newInterestRemaining,
        newAmountPaid,
        feeResult.daysOverdue > 0
      );

      const isPaidInFull = newStatus === 'PAGO';

      // 1. Inserir registro de pagamento
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          receivable_id: receivable.id,
          client_id: receivable.client_id,
          operation_id: receivable.operation_id,
          amount,
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
      };

      // Marcar multa como aplicada se foi aplicada neste pagamento
      if (shouldApplyPenalty || receivable.penalty_applied) {
        receivableUpdate.penalty_applied = true;
      }

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
        const balanceRemaining = newPrincipalRemaining + newPenaltyRemaining + newInterestRemaining;
        
        if (balanceRemaining > 0.01) {
          // Calcular nova data de vencimento
          let newDueDate: Date;
          if (deferToDate) {
            newDueDate = deferToDate;
          } else {
            const days = deferDays || 30;
            newDueDate = new Date();
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

          // Criar nova parcela com saldo restante
          const { data: newReceivable, error: insertError } = await supabase
            .from('receivables')
            .insert({
              operation_id: receivable.operation_id,
              client_id: receivable.client_id,
              installment_number: nextInstallmentNumber,
              due_date: newDueDate.toISOString().split('T')[0],
              amount: Math.round(balanceRemaining * 100) / 100,
              status: 'EM_ABERTO' as ReceivableStatus,
              amount_paid: 0,
              penalty_applied: false,
              penalty_amount: 0,
              interest_accrued: 0,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          
          newReceivableId = newReceivable?.id ?? null;

          // Atualizar parcela original como renegociada
          const renegotiationNote = `Saldo de R$ ${balanceRemaining.toFixed(2)} postergado para parcela ${nextInstallmentNumber}`;
          
          await supabase
            .from('receivables')
            .update({
              renegotiated_to_receivable_id: newReceivableId,
              notes: receivable.notes 
                ? `${receivable.notes}\n${renegotiationNote}` 
                : renegotiationNote,
              // Marcar como PAGO já que o saldo foi movido
              status: 'PAGO' as ReceivableStatus,
              paid_at: paymentDate.toISOString(),
            })
            .eq('id', receivable.id);
        }
      }

      return {
        receivableId: receivable.id,
        newReceivableId,
        allocation,
        newStatus,
        isPaidInFull,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      
      if (result.newReceivableId) {
        toast({
          title: 'Pagamento registrado',
          description: `Saldo restante postergado para nova parcela.`,
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
