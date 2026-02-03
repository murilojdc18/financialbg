import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardCards } from "@/components/dashboard/DashboardCards";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ClientPaymentsTable } from "@/components/dashboard/ClientPaymentsTable";
import { PaymentDetailsDrawer } from "@/components/dashboard/PaymentDetailsDrawer";
import { ExportCSVButton } from "@/components/dashboard/ExportCSVButton";
import {
  useDashboardData,
  DashboardFilters as FiltersType,
} from "@/hooks/useDashboardData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [filters, setFilters] = useState<FiltersType>({
    startDate: null,
    endDate: null,
    clientId: null,
    operationId: null,
    operationStatus: null,
    cashSource: null,
  });

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { payments, summary, clientSummaries, getPaymentsForClient, isLoading, error } =
    useDashboardData(filters);

  const selectedClient = clientSummaries.find((c) => c.client_id === selectedClientId);
  const selectedClientPayments = selectedClientId
    ? getPaymentsForClient(selectedClientId)
    : [];

  return (
    <PageContainer
      title="Dashboard"
      description="Visão geral dos recebimentos e relatórios"
    >
      <div className="space-y-6">
        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <DashboardFilters filters={filters} onFiltersChange={setFilters} />

        {/* Summary Cards */}
        <DashboardCards summary={summary} isLoading={isLoading} />

        {/* Export button */}
        <div className="flex justify-end">
          <ExportCSVButton payments={payments} disabled={isLoading} />
        </div>

        {/* Client table */}
        <ClientPaymentsTable
          clientSummaries={clientSummaries}
          onClientClick={setSelectedClientId}
          isLoading={isLoading}
        />

        {/* Client payments drawer */}
        <PaymentDetailsDrawer
          open={!!selectedClientId}
          onOpenChange={(open) => !open && setSelectedClientId(null)}
          clientName={selectedClient?.client_name || ""}
          payments={selectedClientPayments}
        />
      </div>
    </PageContainer>
  );
}
