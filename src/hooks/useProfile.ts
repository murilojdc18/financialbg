import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  role: 'ADMIN' | 'CLIENT';
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();

  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[useProfile] Error fetching profile:', error);
        throw error;
      }
      return data as Profile | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    profile,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    isAdmin: profile?.role === 'ADMIN',
    isClient: profile?.role === 'CLIENT',
    clientId: profile?.client_id,
  };
}
