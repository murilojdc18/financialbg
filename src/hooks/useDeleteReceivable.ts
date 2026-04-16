import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface DeleteReceivableInput {
  receivableId: string;
  operationId: string;
  installmentNumber: number;
  reason?: string;
  mode: 'hard' | 'soft';
}

export function useDeleteReceivable() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: DeleteReceivableInput) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { receivableId, operationId, installmentNumber, reason, mode } = input;

      // Check for non-voided payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('id')
        .eq('receivable_id', receivableId)
        .or('is_voided.is.null,is_voided.eq.false')
        .limit(1);

      if (paymentsError) throw paymentsError;

      const hasPayments = payments && payments.length > 0;

      if (hasPayments && mode === 'hard') {
        throw new Error('Não é possível excluir definitivamente uma parcela com pagamentos registrados. Use o arquivamento.');
      }

      if (mode === 'hard' && !hasPayments) {
        // Hard delete: remove the receivable
        const { error: deleteError } = await supabase
          .from('receivables')
          .delete()
          .eq('id', receivableId);

        if (deleteError) throw deleteError;

        // Renumber subsequent installments (descending to avoid conflicts)
        const { data: futureInstallments, error: fetchError } = await supabase
          .from('receivables')
          .select('id, installment_number')
          .eq('operation_id', operationId)
          .gt('installment_number', installmentNumber)
          .is('deleted_at', null)
          .order('installment_number', { ascending: false });

        if (fetchError) throw fetchError;

        // Shift down one-by-one in descending order
        if (futureInstallments && futureInstallments.length > 0) {
          // First shift to ascending order for correct sequential update
          const sorted = [...futureInstallments].sort((a, b) => a.installment_number - b.installment_number);
          for (const inst of sorted) {
            const { error: shiftError } = await supabase
              .from('receivables')
              .update({ installment_number: inst.installment_number - 1 })
              .eq('id', inst.id);

            if (shiftError) throw shiftError;
          }
        }

        return { mode: 'hard' as const };
      }

      // Soft delete
      const { error: softError } = await supabase
        .from('receivables')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          deleted_reason: reason || null,
        } as any)
        .eq('id', receivableId);

      if (softError) throw softError;

      return { mode: 'soft' as const };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      toast({
        title: result.mode === 'hard' ? 'Parcela excluída' : 'Parcela arquivada',
        description: result.mode === 'hard'
          ? 'A parcela foi removida e as seguintes foram renumeradas.'
          : 'A parcela foi arquivada e não aparecerá mais nas listagens.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir parcela',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    },
  });
}