import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DbReceivable, DbReceivableInsert, DbReceivableUpdate, DbReceivableWithRelations, PaymentMethod } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useReceivables() {
  return useQuery({
    queryKey: ['receivables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select(`
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
        `)
        .is('deleted_at', null)
        .order('due_date');
      
      if (error) throw error;
      return data as DbReceivableWithRelations[];
    },
  });
}

export function useReceivablesByOperation(operationId: string) {
  return useQuery({
    queryKey: ['receivables', 'operation', operationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*')
        .eq('operation_id', operationId)
        .is('deleted_at', null)
        .order('installment_number');
      
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
      const { data, error } = await supabase
        .from('receivables')
        .insert(receivables)
        .select();
      
      if (error) throw error;
      return data as DbReceivable[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast({ title: 'Parcelas criadas com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao criar parcelas', 
        description: error.message 
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
      amount
    }: { 
      id: string; 
      paid_at: string; 
      payment_method: PaymentMethod; 
      notes?: string;
      amount: number;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Atualizar receivable
      const { data: receivable, error: receivableError } = await supabase
        .from('receivables')
        .update({ 
          status: 'PAGO', 
          paid_at, 
          payment_method, 
          notes,
          amount_paid: amount,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (receivableError) throw receivableError;

      // 2. Inserir registro em payments
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          receivable_id: id,
          client_id: receivable.client_id,
          operation_id: receivable.operation_id,
          amount,
          amount_total: amount,
          alloc_principal: amount,
          alloc_penalty: 0,
          alloc_interest: 0,
          paid_at,
          method: payment_method,
          notes
        });
      
      if (paymentError) throw paymentError;

      return receivable as DbReceivable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Pagamento registrado com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao registrar pagamento', 
        description: error.message 
      });
    },
  });
}

export function useUpdateReceivable() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: DbReceivableUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('receivables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbReceivable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao atualizar parcela', 
        description: error.message 
      });
    },
  });
}
