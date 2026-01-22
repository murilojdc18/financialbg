import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { OperationSystem } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface ReceivableInput {
  installment_number: number;
  due_date: string;
  amount: number;
}

interface CreateOperationInput {
  client_id: string;
  principal: number;
  rate_monthly: number;
  term_months: number;
  system: OperationSystem;
  start_date: string;
  fee_fixed?: number;
  fee_insurance?: number;
  notes?: string;
  receivables: ReceivableInput[];
}

export function useCreateOperationWithReceivables() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateOperationInput) => {
      const { data, error } = await supabase.rpc('create_operation_with_receivables', {
        p_client_id: input.client_id,
        p_principal: input.principal,
        p_rate_monthly: input.rate_monthly,
        p_term_months: input.term_months,
        p_system: input.system,
        p_start_date: input.start_date,
        p_fee_fixed: input.fee_fixed || 0,
        p_fee_insurance: input.fee_insurance || 0,
        p_notes: input.notes || null,
        p_receivables: input.receivables,
      });

      if (error) throw error;
      return data as string; // operation_id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast({ title: 'Operação criada com sucesso!' });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar operação',
        description: error.message,
      });
    },
  });
}
