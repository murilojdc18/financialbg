import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { OperationsFilters } from "@/components/operations/OperationsFilters";
import { OperationsTable } from "@/components/operations/OperationsTable";
import { EmptyOperationsState } from "@/components/operations/EmptyOperationsState";
import { initialMockClients } from "@/data/mock-clients";
import { initialMockOperations } from "@/data/mock-operations";
import { Operation } from "@/types/operation";
import { Client } from "@/types/client";

export default function Operacoes() {
  const [clients] = useState<Client[]>(initialMockClients);
  const [operations] = useState<Operation[]>(initialMockOperations);

  // Filters state
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const filteredOperations = useMemo(() => {
    return operations.filter((operation) => {
      // Filter by client
      if (selectedClientId !== "all" && operation.clientId !== selectedClientId) {
        return false;
      }

      // Filter by status
      if (selectedStatus !== "all" && operation.status !== selectedStatus) {
        return false;
      }

      // Filter by date range
      if (startDate && operation.createdAt < startDate) {
        return false;
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (operation.createdAt > endOfDay) {
          return false;
        }
      }

      return true;
    });
  }, [operations, selectedClientId, selectedStatus, startDate, endDate]);

  const handleClearFilters = () => {
    setSelectedClientId("all");
    setSelectedStatus("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters =
    selectedClientId !== "all" ||
    selectedStatus !== "all" ||
    startDate !== undefined ||
    endDate !== undefined;

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
