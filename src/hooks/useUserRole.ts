import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'ADMIN' | 'CLIENT';

interface UseUserRoleResult {
  role: AppRole | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isAdmin: boolean;
  isClient: boolean;
}

/**
 * Hook that fetches the user's role from user_roles table via has_role RPC.
 * Falls back to checking profiles.role for backwards compatibility.
 */
export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth();

  const { data: role, isLoading, error, refetch } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async (): Promise<AppRole | null> => {
      if (!user?.id) return null;

      // First check if user has admin role in user_roles (lowercase for enum)
      const { data: isAdmin, error: adminError } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });

      if (adminError) {
        console.error('[useUserRole] Error checking admin role:', adminError.message);
        return null;
      }

      if (isAdmin === true) {
        return 'ADMIN';
      }

      // Check if user has client role in user_roles (lowercase for enum)
      const { data: isClient, error: clientError } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'client' });

      if (clientError) {
        console.error('[useUserRole] Error checking client role:', clientError.message);
        return null;
      }

      if (isClient === true) {
        return 'CLIENT';
      }

      // No role found
      return null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    role: role ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    isAdmin: role === 'ADMIN',
    isClient: role === 'CLIENT',
  };
}

// Removed profile fallback - roles must be in user_roles table
