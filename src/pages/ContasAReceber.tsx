import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReceivablesFilters } from "@/components/receivables/ReceivablesFilters";
import { ReceivablesSummaryCards } from "@/components/receivables/ReceivablesSummaryCards";
import { ReceivablesTable } from "@/components/receivables/ReceivablesTable";
import { MarkAsPaidDialog } from "@/components/receivables/MarkAsPaidDialog";
import { EmptyReceivablesState } from "@/components/receivables/EmptyReceivablesState";
import { initialMockInstallments } from "@/data/mock-installments";
import { initialMockClients } from "@/data/mock-clients";
import { Installment, InstallmentStatus, InstallmentFormData } from "@/types/installment";
import { toast } from "@/hooks/use-toast";
import { isAfter, isBefore, startOfDay } from "date-fns";

export default function ContasAReceber() {
  const [installments, setInstallments] = useState<Installment[]>(initialMockInstallments);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<InstallmentStatus | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);

  // Update overdue status automatically
  const processedInstallments = useMemo(() => {
    const today = startOfDay(new Date());
    return installments.map((inst) => {
      if (inst.status === "em_aberto" && isBefore(startOfDay(inst.dueDate), today)) {
        return { ...inst, status: "atrasado" as InstallmentStatus };
      }
      return inst;
    });
  }, [installments]);

  // Apply filters
  const filteredInstallments = useMemo(() => {
    return processedInstallments.filter((inst) => {
      if (selectedClientId !== "all" && inst.clientId !== selectedClientId) {
        return false;
      }
      if (selectedStatus !== "all" && inst.status !== selectedStatus) {
        return false;
      }
      if (startDate && isBefore(inst.dueDate, startOfDay(startDate))) {
        return false;
      }
      if (endDate && isAfter(inst.dueDate, startOfDay(endDate))) {
        return false;
      }
      return true;
    });
  }, [processedInstallments, selectedClientId, selectedStatus, startDate, endDate]);

  // Calculate summaries
  const summaries = useMemo(() => {
    const openItems = filteredInstallments.filter((i) => i.status === "em_aberto");
    const paidItems = filteredInstallments.filter((i) => i.status === "pago");
    const overdueItems = filteredInstallments.filter((i) => i.status === "atrasado");
    
    return {
      totalOpen: openItems.reduce((sum, i) => sum + i.amount, 0),
      totalPaid: paidItems.reduce((sum, i) => sum + i.amount, 0),
      totalOverdue: overdueItems.reduce((sum, i) => sum + i.amount, 0),
      countOpen: openItems.length,
      countPaid: paidItems.length,
      countOverdue: overdueItems.length,
    };
  }, [filteredInstallments]);

  const handleMarkAsPaid = (installment: Installment) => {
    setSelectedInstallment(installment);
    setDialogOpen(true);
  };

  const handleConfirmPayment = (data: InstallmentFormData) => {
    if (!selectedInstallment) return;

    setInstallments((prev) =>
      prev.map((inst) =>
        inst.id === selectedInstallment.id
          ? {
              ...inst,
              status: "pago" as InstallmentStatus,
              paidAt: data.paidAt,
              paymentMethod: data.paymentMethod,
              notes: data.notes,
            }
          : inst
      )
    );

    toast({
      title: "Pagamento registrado",
      description: `Parcela ${selectedInstallment.installmentNumber}ª marcada como paga.`,
    });

    setDialogOpen(false);
    setSelectedInstallment(null);
  };

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

  return (
    <PageContainer
      title="Contas a Receber"
      description="Acompanhe parcelas, duplicatas, vencimentos e registre pagamentos."
    >
      <div className="space-y-6">
        <ReceivablesFilters
          clients={initialMockClients}
          selectedClientId={selectedClientId}
          selectedStatus={selectedStatus}
          startDate={startDate}
          endDate={endDate}
          onClientChange={setSelectedClientId}
          onStatusChange={setSelectedStatus}
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
        />

        {filteredInstallments.length === 0 ? (
          <EmptyReceivablesState hasFilters={hasActiveFilters} />
        ) : (
          <ReceivablesTable
            installments={filteredInstallments}
            clients={initialMockClients}
            onMarkAsPaid={handleMarkAsPaid}
          />
        )}
      </div>

      <MarkAsPaidDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        installment={selectedInstallment}
        onConfirm={handleConfirmPayment}
      />
    </PageContainer>
  );
}
