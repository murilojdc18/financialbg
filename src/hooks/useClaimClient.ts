import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ClaimClientInput {
  cpf: string;
  secondFactor: string;
}

interface ClaimClientResponse {
  success: boolean;
  message: string;
  clientName?: string;
}

export function useClaimClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: async (input: ClaimClientInput): Promise<ClaimClientResponse> => {
      const { data, error } = await supabase.functions.invoke<ClaimClientResponse>('claim-client', {
        body: input,
      });

      if (error) {
        console.error('Claim client error:', error.message);
        throw new Error('Não foi possível processar a solicitação. Tente novamente.');
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Dados não conferem. Verifique as informações.');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate profile query to refresh client_id
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  return {
    claimClient: claimMutation.mutateAsync,
    isLoading: claimMutation.isPending,
    error: claimMutation.error,
    reset: claimMutation.reset,
  };
}
