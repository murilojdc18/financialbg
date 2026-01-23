import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useProfile } from './useProfile';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientCertificate {
  id: string;
  client_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientCertificates() {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['client-certificates', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_certificates')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ClientCertificate[];
    },
    enabled: !!clientId && isClient,
  });
}

export function useUploadCertificate() {
  const queryClient = useQueryClient();
  const { clientId } = useProfile();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!clientId || !user?.id) {
        throw new Error('Usuário não autenticado ou sem cliente vinculado');
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${clientId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('client-certificates')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert record in database
      const { data, error: insertError } = await supabase
        .from('client_certificates')
        .insert({
          client_id: clientId,
          user_id: user.id,
          file_path: filePath,
          file_name: file.name,
          status: 'PENDENTE',
        })
        .select()
        .single();

      if (insertError) {
        // If insert fails, try to delete the uploaded file
        await supabase.storage.from('client-certificates').remove([filePath]);
        throw insertError;
      }

      return data as ClientCertificate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-certificates'] });
    },
  });
}

export function useDownloadCertificate() {
  return useMutation({
    mutationFn: async (filePath: string) => {
      const { data, error } = await supabase.storage
        .from('client-certificates')
        .download(filePath);

      if (error) throw error;
      return data;
    },
  });
}
