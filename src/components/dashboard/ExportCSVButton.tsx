import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PaymentWithDetails } from "@/hooks/useDashboardData";
import { format } from "date-fns";

interface ExportCSVButtonProps {
  payments: PaymentWithDetails[];
  disabled?: boolean;
}

export function ExportCSVButton({ payments, disabled }: ExportCSVButtonProps) {
  const exportToCSV = () => {
    if (payments.length === 0) return;

    const headers = [
      "Data Pagamento",
      "Cliente",
      "ID Operação",
      "ID Parcela",
      "Nº Parcela",
      "Total Recebido",
      "Principal",
      "Juros",
      "Multa",
      "Desc. Principal",
      "Desc. Juros",
      "Desc. Multa",
      "Método",
      "Observação",
    ];

    const rows = payments.map((p) => [
      format(new Date(p.paid_at), "dd/MM/yyyy HH:mm"),
      p.client_name,
      p.operation_id || "",
      p.receivable_id,
      p.installment_number,
      p.amount_total.toFixed(2).replace(".", ","),
      p.alloc_principal.toFixed(2).replace(".", ","),
      p.alloc_interest.toFixed(2).replace(".", ","),
      p.alloc_penalty.toFixed(2).replace(".", ","),
      p.discount_principal.toFixed(2).replace(".", ","),
      p.discount_interest.toFixed(2).replace(".", ","),
      p.discount_penalty.toFixed(2).replace(".", ","),
      p.method,
      (p.note || "").replace(/"/g, '""'),
    ]);

    // Build CSV content
    const csvContent =
      "\uFEFF" + // BOM for Excel UTF-8
      headers.join(";") +
      "\n" +
      rows.map((row) => row.map((cell) => `"${cell}"`).join(";")).join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio-pagamentos-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      onClick={exportToCSV}
      disabled={disabled || payments.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      Exportar CSV
    </Button>
  );
}
