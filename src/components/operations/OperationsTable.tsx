import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DbOperationWithClient, OperationStatus } from "@/types/database";
import { formatCurrency, formatPercent } from "@/lib/loan-calculator";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

interface OperationsTableProps {
  operations: DbOperationWithClient[];
  clients: { id: string; name: string }[];
}

const statusConfig: Record<
  OperationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ATIVA: { label: "Ativa", variant: "default" },
  QUITADA: { label: "Quitada", variant: "secondary" },
  CANCELADA: { label: "Cancelada", variant: "destructive" },
};

const systemLabels: Record<string, string> = {
  PRICE: "Price",
  SAC: "SAC",
};

export function OperationsTable({ operations }: OperationsTableProps) {
  const navigate = useNavigate();

  const handleViewDetails = (operationId: string) => {
    navigate(`/operacoes/${operationId}`);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Taxa</TableHead>
            <TableHead className="text-center">Prazo</TableHead>
            <TableHead className="text-center">Sistema</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operations.map((operation) => {
            const status = statusConfig[operation.status];
            return (
              <TableRow key={operation.id}>
                <TableCell className="font-mono text-sm">
                  {operation.id.slice(0, 8)}
                </TableCell>
                <TableCell className="font-medium">
                  {operation.clients?.name || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(operation.principal))}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(Number(operation.rate_monthly) * 100)} a.m.
                </TableCell>
                <TableCell className="text-center">
                  {operation.term_months} meses
                </TableCell>
                <TableCell className="text-center">
                  {systemLabels[operation.system]}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {format(parseISO(operation.created_at), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(operation.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver detalhes
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
