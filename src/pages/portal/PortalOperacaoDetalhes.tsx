import { useParams, Link } from "react-router-dom";
import { usePortalOperation, usePortalOperationReceivables } from "@/hooks/usePortalData";
import { calculateLateFees } from "@/lib/late-fee-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Loader2, FileText, AlertTriangle } from "lucide-react";
import { format, parseISO, isPast, startOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function getReceivableStatus(dueDate: string, status: string): string {
  if (status === 'PAGO') return 'PAGO';
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDate));
  if (isPast(due) && due < today) return 'ATRASADO';
  return 'EM_ABERTO';
}

function getDaysOverdue(dueDate: string): number {
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDate));
  const diff = differenceInDays(today, due);
  return Math.max(0, diff);
}

export default function PortalOperacaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const { data: operation, isLoading: opLoading, error: opError } = usePortalOperation(id || '');
  const { data: receivables, isLoading: recLoading } = usePortalOperationReceivables(id || '');

  const isLoading = opLoading || recLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (opError || !operation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Operação não encontrada</h2>
        <p className="text-muted-foreground mb-6">
          Esta operação não existe ou você não tem permissão para visualizá-la.
        </p>
        <Link to="/portal/operacoes">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para operações
          </Button>
        </Link>
      </div>
    );
  }

  // Calculate totals
  const totalOriginal = receivables?.reduce((sum, r) => sum + r.amount, 0) ?? 0;
  const totalPaid = receivables?.filter(r => r.status === 'PAGO').reduce((sum, r) => sum + r.amount, 0) ?? 0;
  const totalPending = receivables?.filter(r => r.status !== 'PAGO').reduce((sum, r) => sum + r.amount, 0) ?? 0;
  const paidCount = receivables?.filter(r => r.status === 'PAGO').length ?? 0;
  const pendingCount = receivables?.filter(r => r.status !== 'PAGO').length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to="/portal/operacoes">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Detalhes da Operação</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            ID: <span className="font-mono">{operation.id}</span>
          </p>
        </div>
        <Badge 
          variant={operation.status === 'ATIVA' ? 'default' : operation.status === 'QUITADA' ? 'secondary' : 'destructive'}
          className="text-sm px-3 py-1"
        >
          {operation.status === 'ATIVA' ? 'Ativa' : operation.status === 'QUITADA' ? 'Quitada' : 'Cancelada'}
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Principal</span>
              <span className="font-medium">{formatCurrency(operation.principal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa Mensal</span>
              <span className="font-medium">{formatPercent(operation.rate_monthly)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prazo</span>
              <span className="font-medium">{operation.term_months} meses</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sistema</span>
              <Badge variant="outline">{operation.system}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data de Início</span>
              <span className="font-medium">{formatDate(operation.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Criada em</span>
              <span className="font-medium">{formatDate(operation.created_at)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total de Parcelas</span>
              <span className="font-medium">{receivables?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcelas Pagas</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{paidCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcelas Pendentes</span>
              <span className="font-medium">{pendingCount}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Total</span>
                <span className="font-medium">{formatCurrency(totalOriginal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Pago</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Pendente</span>
                <span className="font-medium">{formatCurrency(totalPending)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receivables Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!receivables || receivables.length === 0) ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma parcela encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Nº</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Dias em Atraso</TableHead>
                    <TableHead className="text-right">Valor Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((rec) => {
                    const status = getReceivableStatus(rec.due_date, rec.status);
                    const daysOverdue = status === 'ATRASADO' ? getDaysOverdue(rec.due_date) : 0;
                    
                    const lateFeeResult = calculateLateFees(
                      rec.due_date,
                      rec.amount,
                      {
                        lateGraceDays: rec.operations.late_grace_days,
                        latePenaltyPercent: rec.operations.late_penalty_percent,
                        lateInterestMonthlyPercent: rec.operations.late_interest_monthly_percent,
                      }
                    );

                    return (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">
                          {rec.installment_number}
                        </TableCell>
                        <TableCell>
                          {formatDate(rec.due_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rec.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell className="text-center">
                          {status === 'PAGO' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : daysOverdue > 0 ? (
                            <span className="text-destructive font-medium">{daysOverdue}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {status === 'PAGO' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : lateFeeResult.hasLateFees ? (
                            <span className="text-destructive">
                              {formatCurrency(lateFeeResult.updatedAmount)}
                            </span>
                          ) : (
                            formatCurrency(rec.amount)
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
