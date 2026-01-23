import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';

export interface Profile {
  id: string;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook that fetches profile data (client_id) and role from user_roles.
 * Role is fetched via useUserRole for security.
 */
export function useProfile() {
  const { user } = useAuth();
  const { role, isAdmin, isClient, isLoading: roleLoading, error: roleError, refetch: refetchRole } = useUserRole();

  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, client_id, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[useProfile] Error fetching profile:', error);
        throw error;
      }
      return data as Profile | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const refetch = () => {
    refetchRole();
    refetchProfile();
  };

  return {
    profile: profile ? { ...profile, role } : null,
    isLoading: profileLoading || roleLoading,
    error: profileError ? (profileError as Error).message : roleError,
    refetch,
    isAdmin,
    isClient,
    role,
    clientId: profile?.client_id ?? null,
  };
}
