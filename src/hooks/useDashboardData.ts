import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface DashboardFilters {
  startDate: string | null;
  endDate: string | null;
  clientId: string | null;
  operationId: string | null;
  operationStatus: string | null;
  cashSource: string | null;
}

export interface PaymentWithDetails {
  id: string;
  paid_at: string;
  amount_total: number;
  alloc_principal: number;
  alloc_interest: number;
  alloc_penalty: number;
  discount_principal: number;
  discount_interest: number;
  discount_penalty: number;
  method: string;
  note: string | null;
  receivable_id: string;
  operation_id: string | null;
  client_id: string | null;
  client_name: string;
  operation_status: string;
  cash_source: string;
  installment_number: number;
}

export interface ClientSummary {
  client_id: string;
  client_name: string;
  total_principal: number;
  total_interest: number;
  total_penalty: number;
  total_amount: number;
  payment_count: number;
}

export interface DashboardSummary {
  total_received: number;
  total_principal: number;
  total_interest: number;
  total_penalty: number;
  total_discount_principal: number;
  total_discount_interest: number;
  total_discount_penalty: number;
  total_discounts: number;
}

export function useDashboardData(filters: DashboardFilters) {
  const paymentsQuery = useQuery({
    queryKey: ["dashboard-payments", filters],
    queryFn: async () => {
      // Build query with joins
      let query = supabase
        .from("payments")
        .select(`
          id,
          paid_at,
          amount_total,
          alloc_principal,
          alloc_interest,
          alloc_penalty,
          discount_principal,
          discount_interest,
          discount_penalty,
          method,
          note,
          receivable_id,
          operation_id,
          client_id,
          clients!payments_client_id_fkey (
            id,
            name
          ),
          operations!payments_operation_id_fkey (
            id,
            status,
            cash_source
          ),
          receivables!payments_receivable_id_fkey (
            installment_number
          )
        `)
        .eq("is_voided", false)
        .order("paid_at", { ascending: false });

      // Apply filters
      if (filters.startDate) {
        query = query.gte("paid_at", filters.startDate);
      }
      if (filters.endDate) {
        // Add 1 day to include the end date fully
        const endDatePlusOne = new Date(filters.endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("paid_at", endDatePlusOne.toISOString().split("T")[0]);
      }
      if (filters.clientId) {
        query = query.eq("client_id", filters.clientId);
      }
      if (filters.operationId) {
        query = query.eq("operation_id", filters.operationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map and filter by operation status/cash_source client-side (join filters)
      const mapped: PaymentWithDetails[] = (data || [])
        .map((p: any) => ({
          id: p.id,
          paid_at: p.paid_at,
          amount_total: Number(p.amount_total) || 0,
          alloc_principal: Number(p.alloc_principal) || 0,
          alloc_interest: Number(p.alloc_interest) || 0,
          alloc_penalty: Number(p.alloc_penalty) || 0,
          discount_principal: Number(p.discount_principal) || 0,
          discount_interest: Number(p.discount_interest) || 0,
          discount_penalty: Number(p.discount_penalty) || 0,
          method: p.method || "",
          note: p.note,
          receivable_id: p.receivable_id,
          operation_id: p.operation_id,
          client_id: p.client_id,
          client_name: p.clients?.name || "Cliente desconhecido",
          operation_status: p.operations?.status || "",
          cash_source: p.operations?.cash_source || "",
          installment_number: p.receivables?.installment_number || 0,
        }))
        .filter((p) => {
          if (filters.operationStatus && p.operation_status !== filters.operationStatus) {
            return false;
          }
          if (filters.cashSource && p.cash_source !== filters.cashSource) {
            return false;
          }
          return true;
        });

      return mapped;
    },
  });

  // Calculate summaries from payments
  const summary: DashboardSummary = useMemo(() => {
    const payments = paymentsQuery.data || [];
    return {
      total_received: payments.reduce((sum, p) => sum + p.amount_total, 0),
      total_principal: payments.reduce((sum, p) => sum + p.alloc_principal, 0),
      total_interest: payments.reduce((sum, p) => sum + p.alloc_interest, 0),
      total_penalty: payments.reduce((sum, p) => sum + p.alloc_penalty, 0),
      total_discount_principal: payments.reduce((sum, p) => sum + p.discount_principal, 0),
      total_discount_interest: payments.reduce((sum, p) => sum + p.discount_interest, 0),
      total_discount_penalty: payments.reduce((sum, p) => sum + p.discount_penalty, 0),
      total_discounts: payments.reduce(
        (sum, p) => sum + p.discount_principal + p.discount_interest + p.discount_penalty,
        0
      ),
    };
  }, [paymentsQuery.data]);

  // Group by client
  const clientSummaries: ClientSummary[] = useMemo(() => {
    const payments = paymentsQuery.data || [];
    const byClient: Record<string, ClientSummary> = {};

    for (const p of payments) {
      const key = p.client_id || "unknown";
      if (!byClient[key]) {
        byClient[key] = {
          client_id: key,
          client_name: p.client_name,
          total_principal: 0,
          total_interest: 0,
          total_penalty: 0,
          total_amount: 0,
          payment_count: 0,
        };
      }
      byClient[key].total_principal += p.alloc_principal;
      byClient[key].total_interest += p.alloc_interest;
      byClient[key].total_penalty += p.alloc_penalty;
      byClient[key].total_amount += p.amount_total;
      byClient[key].payment_count += 1;
    }

    return Object.values(byClient).sort((a, b) => b.total_amount - a.total_amount);
  }, [paymentsQuery.data]);

  // Get payments for a specific client
  const getPaymentsForClient = (clientId: string): PaymentWithDetails[] => {
    return (paymentsQuery.data || []).filter((p) => p.client_id === clientId);
  };

  return {
    payments: paymentsQuery.data || [],
    summary,
    clientSummaries,
    getPaymentsForClient,
    isLoading: paymentsQuery.isLoading,
    error: paymentsQuery.error,
    refetch: paymentsQuery.refetch,
  };
}

// Fetch clients for filter dropdown
export function useClientsForFilter() {
  return useQuery({
    queryKey: ["clients-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

// Fetch operations for filter dropdown
export function useOperationsForFilter(clientId?: string | null) {
  return useQuery({
    queryKey: ["operations-for-filter", clientId],
    queryFn: async () => {
      let query = supabase
        .from("operations")
        .select("id, principal, start_date, client_id, clients(name)")
        .order("start_date", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((op: any) => ({
        id: op.id,
        label: `${op.clients?.name || "?"} - R$ ${op.principal?.toLocaleString("pt-BR")} (${op.start_date})`,
      }));
    },
  });
}
