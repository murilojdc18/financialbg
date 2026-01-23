import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export interface EnsuredProfile {
  id: string;
  role: 'ADMIN' | 'CLIENT' | null;
  client_id: string | null;
}

interface UseEnsureProfileResult {
  profile: EnsuredProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEnsureProfile(): UseEnsureProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<EnsuredProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateProfile = async () => {
    if (!user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, role, client_id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[useEnsureProfile] Fetch error:', fetchError);
        throw fetchError;
      }

      if (existingProfile) {
        setProfile(existingProfile as EnsuredProfile);
        setIsLoading(false);
        return;
      }

      // Profile doesn't exist - try to create one with CLIENT role by default
      console.log('[useEnsureProfile] Creating default profile for user:', user.id);
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          role: 'CLIENT',
          client_id: null,
        })
        .select('id, role, client_id')
        .single();

      if (insertError) {
        console.error('[useEnsureProfile] Insert error:', insertError);
        // If insert fails (e.g., RLS policy), set error but don't throw
        setError('Não foi possível criar seu perfil. Contate o administrador.');
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setProfile(newProfile as EnsuredProfile);
    } catch (err) {
      console.error('[useEnsureProfile] Error:', err);
      setError('Erro ao carregar perfil. Tente novamente.');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrCreateProfile();
  }, [user?.id]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchOrCreateProfile,
  };
}
