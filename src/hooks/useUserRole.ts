import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
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

      // First check if user has ADMIN role in user_roles
      const { data: isAdmin, error: adminError } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'ADMIN' });

      if (adminError) {
        console.error('[useUserRole] Error checking ADMIN role:', adminError);
        // Fallback to profiles table
        return await checkProfileRole(user.id);
      }

      if (isAdmin === true) {
        return 'ADMIN';
      }

      // Check if user has CLIENT role in user_roles
      const { data: isClient, error: clientError } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'CLIENT' });

      if (clientError) {
        console.error('[useUserRole] Error checking CLIENT role:', clientError);
        // Fallback to profiles table
        return await checkProfileRole(user.id);
      }

      if (isClient === true) {
        return 'CLIENT';
      }

      // No role found in user_roles, fallback to profiles
      return await checkProfileRole(user.id);
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

/**
 * Fallback function to check role from profiles table
 */
async function checkProfileRole(userId: string): Promise<AppRole | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[useUserRole] Error fetching profile role:', error);
    return null;
  }

  if (profile?.role === 'ADMIN' || profile?.role === 'CLIENT') {
    return profile.role;
  }

  return null;
}
