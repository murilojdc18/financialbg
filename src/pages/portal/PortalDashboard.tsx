import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { usePortalOperations, usePortalReceivables, usePortalDashboardStats } from "@/hooks/usePortalData";
import { calculateLateFees } from "@/lib/late-fee-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { FileText, Clock, CheckCircle, MapPin, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import { format, parseISO, isPast, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
}

function getReceivableStatus(dueDate: string, status: string): string {
  if (status === 'PAGO') return 'PAGO';
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDate));
  if (isPast(due) && due < today) return 'ATRASADO';
  return 'EM_ABERTO';
}

export default function PortalDashboard() {
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: operations, isLoading: opsLoading } = usePortalOperations();
  const { data: receivables, isLoading: recLoading } = usePortalReceivables();
  const { data: stats, isLoading: statsLoading } = usePortalDashboardStats();

  const isLoading = profileLoading || opsLoading || recLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasOperations = operations && operations.length > 0;
  const hasReceivables = receivables && receivables.length > 0;
  const isEmpty = !hasOperations && !hasReceivables;

  // Empty state
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="w-full max-w-2xl">
          {/* OpenStreetMap placeholder */}
          <div className="relative w-full h-64 mb-6 rounded-xl overflow-hidden border bg-muted">
            <iframe
              title="Mapa"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-46.7,-23.6,-46.5,-23.5&layer=mapnik"
              className="w-full h-full border-0 opacity-60"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">Sua localização</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Portal</h2>
            <p className="text-muted-foreground mb-6">
              Você ainda não possui operações ativas. Quando houver, elas aparecerão aqui.
            </p>
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Falar com suporte
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas operações</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Operações Ativas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeOperations ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parcelas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingReceivables ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parcelas Pagas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.paidReceivables ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Operations */}
      {hasOperations && (
        <Card>
          <CardHeader>
            <CardTitle>Operações Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operations!.slice(0, 5).map((op) => (
                <div
                  key={op.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/50 rounded-lg gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {formatCurrency(op.principal)} • {op.term_months}x • {op.system}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Criada em {formatDate(op.created_at)}
                    </p>
                  </div>
                  <Link to={`/portal/operacoes/${op.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      Ver detalhes
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
              {operations!.length > 5 && (
                <Link to="/portal/operacoes" className="block">
                  <Button variant="ghost" className="w-full">
                    Ver todas ({operations!.length})
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Receivables */}
      {hasReceivables && (
        <Card>
          <CardHeader>
            <CardTitle>Parcelas Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Parcela</th>
                    <th className="text-left py-2 font-medium">Vencimento</th>
                    <th className="text-right py-2 font-medium">Valor</th>
                    <th className="text-center py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Valor Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables!.slice(0, 10).map((rec) => {
                    const status = getReceivableStatus(rec.due_date, rec.status);
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
                      <tr key={rec.id} className="border-b last:border-0">
                        <td className="py-3">#{rec.installment_number}</td>
                        <td className="py-3">{formatDate(rec.due_date)}</td>
                        <td className="py-3 text-right">{formatCurrency(rec.amount)}</td>
                        <td className="py-3 text-center">
                          <StatusBadge status={status} />
                        </td>
                        <td className="py-3 text-right font-medium">
                          {lateFeeResult.hasLateFees ? (
                            <span className="text-destructive">
                              {formatCurrency(lateFeeResult.updatedAmount)}
                            </span>
                          ) : (
                            formatCurrency(rec.amount)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {receivables!.length > 10 && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Exibindo 10 de {receivables!.length} parcelas
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
