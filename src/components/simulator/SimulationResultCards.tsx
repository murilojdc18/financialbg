import {
  Banknote,
  Calendar,
  Percent,
  TrendingUp,
  Wallet,
  CreditCard,
  PiggyBank,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoanResult, formatCurrency, formatPercent } from "@/lib/loan-calculator";

interface SimulationResultCardsProps {
  result: LoanResult;
}

interface ResultCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description?: string;
  highlight?: boolean;
}

function ResultCard({ icon, label, value, description, highlight }: ResultCardProps) {
  return (
    <Card className={highlight ? "border-primary bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              highlight ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-lg font-semibold truncate ${highlight ? "text-primary" : ""}`}>
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SimulationResultCards({ result }: SimulationResultCardsProps) {
  const amortizationLabel = result.amortizationType === "price" ? "Tabela Price" : "SAC";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ResultCard
        icon={<Banknote className="h-5 w-5" />}
        label="Valor Financiado"
        value={formatCurrency(result.principal)}
        highlight
      />

      <ResultCard
        icon={<Percent className="h-5 w-5" />}
        label="Taxa Mensal"
        value={formatPercent(result.monthlyRate)}
        description={`${formatPercent(result.annualRate)} ao ano`}
      />

      <ResultCard
        icon={<Calendar className="h-5 w-5" />}
        label="Prazo"
        value={`${result.termMonths} meses`}
        description={amortizationLabel}
      />

      <ResultCard
        icon={<CreditCard className="h-5 w-5" />}
        label="1ª Parcela"
        value={formatCurrency(result.firstInstallment)}
        highlight
      />

      <ResultCard
        icon={<Wallet className="h-5 w-5" />}
        label="Parcela Média"
        value={formatCurrency(result.averageInstallment)}
      />

      <ResultCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Total de Juros"
        value={formatCurrency(result.totalInterest)}
        description={`${((result.totalInterest / result.principal) * 100).toFixed(1)}% do principal`}
      />

      <ResultCard
        icon={<PiggyBank className="h-5 w-5" />}
        label="Total em Taxas"
        value={formatCurrency(result.totalFees)}
        description="Tarifa + Seguro"
      />

      <ResultCard
        icon={<Banknote className="h-5 w-5" />}
        label="Total a Pagar"
        value={formatCurrency(result.totalPaid)}
        highlight
      />
    </div>
  );
}
