import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { DbReceivable, DbReceivableInsert, DbReceivableUpdate, DbReceivableWithRelations, PaymentMethod } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useReceivables() {
  return useQuery({
    queryKey: ['receivables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*, clients(*), operations(*)')
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

  return useMutation({
    mutationFn: async ({ 
      id, 
      paid_at, 
      payment_method, 
      notes 
    }: { 
      id: string; 
      paid_at: string; 
      payment_method: PaymentMethod; 
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('receivables')
        .update({ 
          status: 'PAGO', 
          paid_at, 
          payment_method, 
          notes 
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbReceivable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
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
