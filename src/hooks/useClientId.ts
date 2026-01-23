import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseClientIdResult {
  clientId: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook that fetches the user's client_id from profiles table.
 * This is separate from role checking for security reasons.
 */
export function useClientId(): UseClientIdResult {
  const { user } = useAuth();

  const { data: clientId, isLoading, error, refetch } = useQuery({
    queryKey: ['client-id', user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user?.id) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[useClientId] Error fetching client_id:', error);
        return null;
      }

      return profile?.client_id ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    clientId: clientId ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
