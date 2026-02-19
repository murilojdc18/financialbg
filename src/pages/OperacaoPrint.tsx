import { useParams, useNavigate } from "react-router-dom";
import { useOperation } from "@/hooks/useOperations";
import { formatCurrency, formatPercent, calculateLoan, formatDate } from "@/lib/loan-calculator";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { parseISO } from "date-fns";
import { format } from "date-fns";

export default function OperacaoPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: operation, isLoading, error } = useOperation(id || "");

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !operation) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Operação não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const client = operation.clients;
  const loanResult = calculateLoan({
    principal: Number(operation.principal),
    interestRate: Number(operation.rate_monthly) * 100,
    isAnnualRate: false,
    termMonths: operation.term_months,
    amortizationType: operation.system.toLowerCase() as "price" | "sac",
    startDate: parseISO(operation.start_date),
  });

  const isSac = operation.system === "SAC";
  const rateDisplay = `${formatPercent(Number(operation.rate_monthly) * 100)} a.m.`;

  return (
    <div className="print-page mx-auto max-w-3xl px-8 py-10 bg-background text-foreground">
      {/* Action buttons - hidden on print */}
      <div className="print:hidden flex items-center justify-between mb-8">
        <Button variant="outline" onClick={() => navigate(`/operacoes/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir / Salvar PDF
        </Button>
      </div>

      {/* Header */}
      <div className="text-center mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground">Resumo do Empréstimo</h1>
        <p className="text-sm text-muted-foreground mt-1">Proposta</p>
        {client && (
          <p className="text-base font-medium text-foreground mt-3">
            Cliente: {client.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Emitido em {format(new Date(), "dd/MM/yyyy")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <SummaryItem label="Valor financiado" value={formatCurrency(Number(operation.principal))} highlight />

        {isSac ? (
          <>
            <SummaryItem label="Parcela inicial" value={formatCurrency(loanResult.firstInstallment)} />
            <SummaryItem
              label="Parcela final"
              value={formatCurrency(loanResult.schedule[loanResult.schedule.length - 1]?.payment || 0)}
            />
          </>
        ) : (
          <SummaryItem label="Parcela mensal" value={formatCurrency(loanResult.firstInstallment)} highlight />
        )}

        <SummaryItem label="Taxa aplicada" value={rateDisplay} />
        <SummaryItem label="Prazo" value={`${operation.term_months} meses`} />
        <SummaryItem label="Total a pagar" value={formatCurrency(loanResult.totalPaid)} highlight />
      </div>

      {/* Schedule Table */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-3">Cronograma de Parcelas</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-center py-2 px-3 font-medium text-muted-foreground w-12">Nº</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vencimento</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            {loanResult.schedule.map((row) => (
              <tr key={row.number} className="border-b border-border/50 print-row">
                <td className="text-center py-2 px-3 font-medium">{row.number}</td>
                <td className="py-2 px-3">{formatDate(row.dueDate)}</td>
                <td className="text-right py-2 px-3 font-mono">{formatCurrency(row.payment)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td colSpan={2} className="py-2 px-3 text-right">Total</td>
              <td className="py-2 px-3 text-right font-mono">{formatCurrency(loanResult.totalPaid)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground border-t border-border pt-4 mt-8">
        <p>Valores sujeitos às condições do contrato.</p>
        <p>Em caso de dúvidas, entre em contato.</p>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
