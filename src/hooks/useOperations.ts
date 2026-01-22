import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { DbOperation, DbOperationInsert, DbOperationUpdate, DbOperationWithClient } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useOperations() {
  return useQuery({
    queryKey: ['operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('*, clients(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DbOperationWithClient[];
    },
  });
}

export function useOperation(id: string) {
  return useQuery({
    queryKey: ['operations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('*, clients(*)')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as DbOperationWithClient | null;
    },
    enabled: !!id,
  });
}

export function useCreateOperation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (operation: DbOperationInsert) => {
      const { data, error } = await supabase
        .from('operations')
        .insert(operation)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbOperation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      toast({ title: 'Operação criada com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao criar operação', 
        description: error.message 
      });
    },
  });
}

export function useUpdateOperation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: DbOperationUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('operations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbOperation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      toast({ title: 'Operação atualizada com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao atualizar operação', 
        description: error.message 
      });
    },
  });
}

export function useDeleteOperation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      toast({ title: 'Operação excluída com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao excluir operação', 
        description: error.message 
      });
    },
  });
}
