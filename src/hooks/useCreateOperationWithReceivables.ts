import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperationSystem, CashSource } from '@/types/database';
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
  cash_source?: CashSource;
  receivables: ReceivableInput[];
}

export function useCreateOperationWithReceivables() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateOperationInput) => {
      // Criar operation diretamente com cash_source
      const { data: operation, error: opError } = await supabase
        .from('operations')
        .insert({
          client_id: input.client_id,
          principal: input.principal,
          rate_monthly: input.rate_monthly,
          term_months: input.term_months,
          system: input.system,
          start_date: input.start_date,
          fee_fixed: input.fee_fixed || 0,
          fee_insurance: input.fee_insurance || 0,
          notes: input.notes || null,
          cash_source: input.cash_source || 'B&G',
        })
        .select()
        .single();

      if (opError) throw opError;

      // Criar receivables
      if (input.receivables.length > 0) {
        const receivablesData = input.receivables.map((r) => ({
          operation_id: operation.id,
          client_id: input.client_id,
          installment_number: r.installment_number,
          due_date: r.due_date,
          amount: r.amount,
        }));

        const { error: recError } = await supabase
          .from('receivables')
          .insert(receivablesData);

        if (recError) throw recError;
      }

      return operation.id as string;
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
