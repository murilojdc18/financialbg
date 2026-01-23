import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DbClient, DbClientInsert, DbClientUpdate } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as DbClient[];
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as DbClient | null;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (client: DbClientInsert) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      // IMPORTANT: Avoid returning representation here.
      // When RLS is enabled, `insert(...).select().single()` requires the newly inserted
      // row to pass SELECT policies as well, which can surface as an RLS error even if
      // INSERT policy is correct. We instead insert with minimal returning and refresh.
      const { error } = await supabase
        .from('clients')
        .insert([{ ...client, owner_id: user.id }]);
      
      if (error) throw error;
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente criado com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao criar cliente', 
        description: error.message 
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: DbClientUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as DbClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao atualizar cliente', 
        description: error.message 
      });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Cliente excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao excluir cliente', 
        description: error.message 
      });
    },
  });
}
