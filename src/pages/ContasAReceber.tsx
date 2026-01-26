import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReceivablesFilters } from "@/components/receivables/ReceivablesFilters";
import { ReceivablesSummaryCards } from "@/components/receivables/ReceivablesSummaryCards";
import { ReceivablesTable } from "@/components/receivables/ReceivablesTable";
import { EmptyReceivablesState } from "@/components/receivables/EmptyReceivablesState";
import { useClients } from "@/hooks/useClients";
import { useReceivables } from "@/hooks/useReceivables";
import { ReceivableStatus } from "@/types/database";
import { Loader2 } from "lucide-react";
import { isAfter, isBefore, startOfDay, parseISO } from "date-fns";

export default function ContasAReceber() {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: receivables = [], isLoading: loadingReceivables, error } = useReceivables();
  
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<ReceivableStatus | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Update overdue status automatically (in-memory, for display)
  const processedReceivables = useMemo(() => {
    const today = startOfDay(new Date());
    return receivables.map((rec) => {
      const dueDate = parseISO(rec.due_date);
      // Se está em aberto e vencido, mostrar como atrasado
      if (rec.status === "EM_ABERTO" && isBefore(startOfDay(dueDate), today)) {
        return { ...rec, status: "ATRASADO" as ReceivableStatus };
      }
      // Se tem pagamento parcial e está vencido, mostrar como atrasado também
      if (rec.status === "PARCIAL" && isBefore(startOfDay(dueDate), today)) {
        return { ...rec, status: "ATRASADO" as ReceivableStatus };
      }
      return rec;
    });
  }, [receivables]);

  // Apply filters
  const filteredReceivables = useMemo(() => {
    return processedReceivables.filter((rec) => {
      if (selectedClientId !== "all" && rec.client_id !== selectedClientId) {
        return false;
      }
      if (selectedStatus !== "all" && rec.status !== selectedStatus) {
        return false;
      }
      const dueDate = parseISO(rec.due_date);
      if (startDate && isBefore(dueDate, startOfDay(startDate))) {
        return false;
      }
      if (endDate && isAfter(dueDate, startOfDay(endDate))) {
        return false;
      }
      return true;
    });
  }, [processedReceivables, selectedClientId, selectedStatus, startDate, endDate]);

  // Calculate summaries
  const summaries = useMemo(() => {
    const openItems = filteredReceivables.filter((i) => i.status === "EM_ABERTO");
    const paidItems = filteredReceivables.filter((i) => i.status === "PAGO");
    const overdueItems = filteredReceivables.filter((i) => i.status === "ATRASADO");
    const partialItems = filteredReceivables.filter((i) => i.status === "PARCIAL");
    
    return {
      totalOpen: openItems.reduce((sum, i) => sum + Number(i.amount), 0),
      totalPaid: paidItems.reduce((sum, i) => sum + Number(i.amount_paid || i.amount), 0),
      totalOverdue: overdueItems.reduce((sum, i) => sum + Number(i.amount), 0),
      totalPartial: partialItems.reduce((sum, i) => sum + Number(i.amount) - Number(i.amount_paid || 0), 0),
      countOpen: openItems.length,
      countPaid: paidItems.length,
      countOverdue: overdueItems.length,
      countPartial: partialItems.length,
    };
  }, [filteredReceivables]);

  const hasActiveFilters =
    selectedClientId !== "all" ||
    selectedStatus !== "all" ||
    startDate !== undefined ||
    endDate !== undefined;

  const handleClearFilters = () => {
    setSelectedClientId("all");
    setSelectedStatus("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const isLoading = loadingClients || loadingReceivables;

  if (isLoading) {
    return (
      <PageContainer title="Contas a Receber" description="Carregando...">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Contas a Receber" description="Erro ao carregar">
        <div className="text-center py-16 text-destructive">
          Erro ao carregar contas: {error.message}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Contas a Receber"
      description="Acompanhe parcelas, vencimentos e registre pagamentos parciais ou totais."
    >
      <div className="space-y-6">
        <ReceivablesFilters
          clients={clients}
          selectedClientId={selectedClientId}
          selectedStatus={selectedStatus}
          startDate={startDate}
          endDate={endDate}
          onClientChange={setSelectedClientId}
          onStatusChange={(status) => setSelectedStatus(status as ReceivableStatus | "all")}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearFilters={handleClearFilters}
        />

        <ReceivablesSummaryCards
          totalOpen={summaries.totalOpen}
          totalPaid={summaries.totalPaid}
          totalOverdue={summaries.totalOverdue}
          countOpen={summaries.countOpen}
          countPaid={summaries.countPaid}
          countOverdue={summaries.countOverdue}
          selectedStatus={selectedStatus}
          onStatusClick={setSelectedStatus}
        />

        {filteredReceivables.length === 0 ? (
          <EmptyReceivablesState hasFilters={hasActiveFilters} />
        ) : (
          <ReceivablesTable
            receivables={filteredReceivables}
            clients={clients}
          />
        )}
      </div>
    </PageContainer>
  );
}
