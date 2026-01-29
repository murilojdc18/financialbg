import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { OperationsFilters } from "@/components/operations/OperationsFilters";
import { OperationsTable } from "@/components/operations/OperationsTable";
import { EmptyOperationsState } from "@/components/operations/EmptyOperationsState";
import { useClients } from "@/hooks/useClients";
import { useOperations } from "@/hooks/useOperations";
import { CashSource } from "@/types/database";
import { Loader2 } from "lucide-react";
import { parseISO } from "date-fns";

export default function Operacoes() {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: operations = [], isLoading: loadingOperations, error } = useOperations();

  // Filters state
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCashSource, setSelectedCashSource] = useState<CashSource | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const filteredOperations = useMemo(() => {
    return operations.filter((operation) => {
      // Filter by client
      if (selectedClientId !== "all" && operation.client_id !== selectedClientId) {
        return false;
      }

      // Filter by status
      if (selectedStatus !== "all" && operation.status !== selectedStatus) {
        return false;
      }

      // Filter by cash source
      if (selectedCashSource !== "all" && operation.cash_source !== selectedCashSource) {
        return false;
      }

      // Filter by date range
      const createdAt = parseISO(operation.created_at);
      if (startDate && createdAt < startDate) {
        return false;
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (createdAt > endOfDay) {
          return false;
        }
      }

      return true;
    });
  }, [operations, selectedClientId, selectedStatus, selectedCashSource, startDate, endDate]);

  const handleClearFilters = () => {
    setSelectedClientId("all");
    setSelectedStatus("all");
    setSelectedCashSource("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters =
    selectedClientId !== "all" ||
    selectedStatus !== "all" ||
    selectedCashSource !== "all" ||
    startDate !== undefined ||
    endDate !== undefined;

  const isLoading = loadingClients || loadingOperations;

  if (isLoading) {
    return (
      <PageContainer title="Operações" description="Carregando...">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Operações" description="Erro ao carregar">
        <div className="text-center py-16 text-destructive">
          Erro ao carregar operações: {error.message}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Operações"
      description="Visualize e gerencie todas as operações de crédito ativas e encerradas."
    >
      <div className="space-y-6">
        {/* Filters */}
        <OperationsFilters
          clients={clients}
          selectedClientId={selectedClientId}
          onClientChange={setSelectedClientId}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedCashSource={selectedCashSource}
          onCashSourceChange={setSelectedCashSource}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearFilters={handleClearFilters}
        />

        {/* Table or Empty State */}
        {filteredOperations.length > 0 ? (
          <OperationsTable operations={filteredOperations} clients={clients} />
        ) : (
          <EmptyOperationsState isFiltered={hasActiveFilters} />
        )}
      </div>
    </PageContainer>
  );
}
