import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Calendar,
  Percent,
  Clock,
  DollarSign,
  Calculator,
  Mail,
  Phone,
  MapPin,
  FileText,
  Building2,
  CreditCard,
  Shield,
  Loader2,
} from "lucide-react";
import { useOperation } from "@/hooks/useOperations";
import { formatCurrency, formatPercent, calculateLoan } from "@/lib/loan-calculator";
import { InstallmentScheduleTable } from "@/components/simulator/InstallmentScheduleTable";
import { ReceivablesSection } from "@/components/operations/ReceivablesSection";
import { StatusSelect } from "@/components/operations/StatusSelect";
import { format, parseISO } from "date-fns";


export default function OperacaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: operation, isLoading, error } = useOperation(id || "");

  if (isLoading) {
    return (
      <PageContainer title="Carregando..." description="">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (error || !operation) {
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

  const client = operation.clients;

  // Calculate loan schedule using existing calculator
  const loanResult = calculateLoan({
    principal: Number(operation.principal),
    interestRate: Number(operation.rate_monthly) * 100, // Convert decimal to percentage
    isAnnualRate: false,
    termMonths: operation.term_months,
    amortizationType: operation.system.toLowerCase() as "price" | "sac",
    startDate: parseISO(operation.start_date),
  });

  return (
    <PageContainer
      title={`Operação ${operation.id.slice(0, 8)}`}
      description="Detalhes completos da operação de empréstimo"
    >
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="outline" onClick={() => navigate("/operacoes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {/* Client and Operation Info - Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Client Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Dados do Cliente</CardTitle>
              </div>
              <CardDescription>Informações do cliente vinculado à operação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {client ? (
                <>
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nome / Razão Social</p>
                      <p className="font-semibold">{client.name}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Documento (CPF/CNPJ)</p>
                      <p className="font-medium">{client.document || "Não informado"}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="font-medium">{client.email || "Não informado"}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                      <p className="font-medium">{client.phone || "Não informado"}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                      <p className="font-medium">{client.address || "Não informado"}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Cliente não encontrado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Operation Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle>Dados da Operação</CardTitle>
                </div>
                <StatusSelect
                  operationId={operation.id}
                  currentStatus={operation.status}
                  variant="detail"
                />
              </div>
              <CardDescription>Informações detalhadas do empréstimo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ID da Operação</p>
                    <p className="font-semibold font-mono text-sm">{operation.id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Data de Início</p>
                    <p className="font-medium">{format(parseISO(operation.start_date), "dd/MM/yyyy")}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Valor Principal</p>
                    <p className="font-semibold text-lg">{formatCurrency(Number(operation.principal))}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Percent className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Taxa de Juros</p>
                    <p className="font-semibold">{formatPercent(Number(operation.rate_monthly) * 100)} a.m.</p>
                    <p className="text-xs text-muted-foreground">{formatPercent(loanResult.annualRate)} a.a.</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Prazo</p>
                    <p className="font-semibold">{operation.term_months} meses</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calculator className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sistema de Amortização</p>
                    <p className="font-semibold">{operation.system}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Taxas Adicionais</p>
                  {(Number(operation.fee_fixed) > 0 || Number(operation.fee_insurance) > 0) ? (
                    <div className="text-sm">
                      {Number(operation.fee_fixed) > 0 && <p>Taxa fixa: {formatCurrency(Number(operation.fee_fixed))}</p>}
                      {Number(operation.fee_insurance) > 0 && <p>Seguro: {formatCurrency(Number(operation.fee_insurance))}</p>}
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">Nenhuma taxa adicional</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">1ª Parcela</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(loanResult.firstInstallment)}</div>
              <p className="text-xs text-muted-foreground">Valor inicial</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Parcela Média</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(loanResult.averageInstallment)}</div>
              <p className="text-xs text-muted-foreground">Média mensal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Juros</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(loanResult.totalInterest)}
              </div>
              <p className="text-xs text-muted-foreground">
                {((loanResult.totalInterest / Number(operation.principal)) * 100).toFixed(1)}% do principal
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
              <p className="text-xs text-muted-foreground">Principal + Juros</p>
            </CardContent>
          </Card>
        </div>

        {/* Parcelas do Supabase */}
        <ReceivablesSection operationId={operation.id} />

        {/* Cronograma Simulado (para referência) */}
        <InstallmentScheduleTable result={loanResult} />
      </div>
    </PageContainer>
  );
}
