import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { DbOperation, DbReceivable } from '@/types/database';

export interface PortalOperation extends DbOperation {
  // Minimal fields for portal display
}

export interface PortalReceivable extends DbReceivable {
  operations: {
    late_grace_days: number;
    late_penalty_percent: number;
    late_interest_monthly_percent: number;
  };
}

export function usePortalOperations() {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['portal', 'operations', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('operations')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'ATIVA')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PortalOperation[];
    },
    enabled: !!clientId && isClient,
  });
}

export function usePortalReceivables() {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['portal', 'receivables', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('receivables')
        .select(`
          *,
          operations!inner (
            late_grace_days,
            late_penalty_percent,
            late_interest_monthly_percent
          )
        `)
        .eq('client_id', clientId)
        .neq('status', 'PAGO')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as PortalReceivable[];
    },
    enabled: !!clientId && isClient,
  });
}

export function usePortalDashboardStats() {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['portal', 'stats', clientId],
    queryFn: async () => {
      if (!clientId) {
        return { activeOperations: 0, pendingReceivables: 0, paidReceivables: 0 };
      }

      // Count active operations
      const { count: activeOperations, error: opError } = await supabase
        .from('operations')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'ATIVA');

      if (opError) throw opError;

      // Count pending receivables
      const { count: pendingReceivables, error: pendError } = await supabase
        .from('receivables')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .neq('status', 'PAGO');

      if (pendError) throw pendError;

      // Count paid receivables
      const { count: paidReceivables, error: paidError } = await supabase
        .from('receivables')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'PAGO');

      if (paidError) throw paidError;

      return {
        activeOperations: activeOperations ?? 0,
        pendingReceivables: pendingReceivables ?? 0,
        paidReceivables: paidReceivables ?? 0,
      };
    },
    enabled: !!clientId && isClient,
  });
}

// All operations (not just active) for the operations list page
export function usePortalAllOperations(statusFilter?: string) {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['portal', 'all-operations', clientId, statusFilter],
    queryFn: async () => {
      if (!clientId) return [];

      let query = supabase
        .from('operations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'TODAS') {
        query = query.eq('status', statusFilter as 'ATIVA' | 'QUITADA' | 'CANCELADA');
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PortalOperation[];
    },
    enabled: !!clientId && isClient,
  });
}

// Single operation with validation
export function usePortalOperation(operationId: string) {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['portal', 'operation', operationId, clientId],
    queryFn: async () => {
      if (!clientId || !operationId) return null;

      const { data, error } = await supabase
        .from('operations')
        .select('*')
        .eq('id', operationId)
        .eq('client_id', clientId) // Ensures belongs to client
        .maybeSingle();

      if (error) throw error;
      return data as PortalOperation | null;
    },
    enabled: !!clientId && !!operationId && isClient,
  });
}

// Receivables for a specific operation
export function usePortalOperationReceivables(operationId: string) {
  const { clientId, isClient } = useProfile();

  return useQuery({
    queryKey: ['portal', 'operation-receivables', operationId, clientId],
    queryFn: async () => {
      if (!clientId || !operationId) return [];

      const { data, error } = await supabase
        .from('receivables')
        .select(`
          *,
          operations!inner (
            late_grace_days,
            late_penalty_percent,
            late_interest_monthly_percent
          )
        `)
        .eq('operation_id', operationId)
        .eq('client_id', clientId) // Ensures belongs to client
        .order('installment_number', { ascending: true });

      if (error) throw error;
      return data as PortalReceivable[];
    },
    enabled: !!clientId && !!operationId && isClient,
  });
}
