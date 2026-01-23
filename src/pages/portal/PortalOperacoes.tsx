import { useState } from "react";
import { Link } from "react-router-dom";
import { usePortalAllOperations } from "@/hooks/usePortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OperationStatus } from "@/types/database";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function getStatusVariant(status: OperationStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'ATIVA':
      return 'default';
    case 'QUITADA':
      return 'secondary';
    case 'CANCELADA':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: OperationStatus): string {
  switch (status) {
    case 'ATIVA':
      return 'Ativa';
    case 'QUITADA':
      return 'Quitada';
    case 'CANCELADA':
      return 'Cancelada';
    default:
      return status;
  }
}

export default function PortalOperacoes() {
  const [statusFilter, setStatusFilter] = useState<string>('ATIVA');
  const { data: operations, isLoading, error } = usePortalAllOperations(statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <p className="text-destructive">Erro ao carregar operações</p>
      </div>
    );
  }

  const isEmpty = !operations || operations.length === 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas Operações</h1>
        <p className="text-muted-foreground">Visualize suas operações de crédito</p>
      </div>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="ATIVA">Ativas</TabsTrigger>
          <TabsTrigger value="QUITADA">Quitadas</TabsTrigger>
          <TabsTrigger value="CANCELADA">Canceladas</TabsTrigger>
          <TabsTrigger value="TODAS">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-6 text-center">
          <div className="w-24 h-24 mb-4 bg-muted rounded-full flex items-center justify-center">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Nenhuma operação encontrada</h2>
          <p className="text-muted-foreground">
            {statusFilter === 'TODAS' 
              ? 'Você ainda não possui operações.' 
              : `Você não possui operações ${getStatusLabel(statusFilter as OperationStatus).toLowerCase()}s.`
            }
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-center">Prazo</TableHead>
                    <TableHead className="text-center">Sistema</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono text-xs">
                        {op.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(op.status)}>
                          {getStatusLabel(op.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(op.principal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(op.rate_monthly)} a.m.
                      </TableCell>
                      <TableCell className="text-center">
                        {op.term_months}x
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{op.system}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(op.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/portal/operacoes/${op.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1.5">
                            Detalhes
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
