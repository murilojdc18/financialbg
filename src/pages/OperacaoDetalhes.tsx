import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Calendar, Percent, Clock, DollarSign, Calculator } from "lucide-react";
import { initialMockOperations } from "@/data/mock-operations";
import { initialMockClients } from "@/data/mock-clients";
import { formatCurrency, formatPercent, calculateLoan } from "@/lib/loan-calculator";
import { InstallmentScheduleTable } from "@/components/simulator/InstallmentScheduleTable";
import { format } from "date-fns";
import { OperationStatus } from "@/types/operation";

const statusConfig: Record<
  OperationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ativa: { label: "Ativa", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export default function OperacaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const operation = initialMockOperations.find((op) => op.id === id);
  const client = operation
    ? initialMockClients.find((c) => c.id === operation.clientId)
    : null;

  if (!operation) {
    return (
      <PageContainer title="Operação não encontrada" description="">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">
              A operação solicitada não foi encontrada.
            </p>
            <Button onClick={() => navigate("/operacoes")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Operações
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const status = statusConfig[operation.status];

  // Calculate loan schedule using existing calculator
  const loanResult = calculateLoan({
    principal: operation.principal,
    interestRate: operation.interestRate,
    isAnnualRate: false,
    termMonths: operation.termMonths,
    amortizationType: operation.amortizationType,
    startDate: operation.createdAt,
  });

  return (
    <PageContainer
      title={`Operação ${operation.id}`}
      description={`Detalhes da operação de ${operation.type.toLowerCase()}`}
    >
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="outline" onClick={() => navigate("/operacoes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {/* Operation Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliente</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{client?.name || "—"}</div>
              <p className="text-xs text-muted-foreground">{client?.document || "Sem documento"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Principal</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{formatCurrency(operation.principal)}</div>
              <p className="text-xs text-muted-foreground">Financiado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Juros</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{formatPercent(operation.interestRate)} a.m.</div>
              <p className="text-xs text-muted-foreground">
                {formatPercent(loanResult.annualRate)} a.a.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={status.variant} className="text-sm">
                {status.label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                Criada em {format(operation.createdAt, "dd/MM/yyyy")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prazo</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operation.termMonths} meses</div>
              <p className="text-xs text-muted-foreground">
                Sistema {operation.amortizationType.toUpperCase()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Juros</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(loanResult.totalInterest)}
              </div>
              <p className="text-xs text-muted-foreground">
                {((loanResult.totalInterest / operation.principal) * 100).toFixed(1)}% do principal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(loanResult.totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground">
                1ª parcela: {formatCurrency(loanResult.firstInstallment)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Installment Schedule */}
        <InstallmentScheduleTable result={loanResult} />
      </div>
    </PageContainer>
  );
}
