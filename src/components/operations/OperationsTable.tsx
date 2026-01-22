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
import { Operation, OperationStatus } from "@/types/operation";
import { Client } from "@/types/client";
import { formatCurrency, formatPercent } from "@/lib/loan-calculator";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface OperationsTableProps {
  operations: Operation[];
  clients: Client[];
}

const statusConfig: Record<
  OperationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ativa: { label: "Ativa", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

const amortizationLabels: Record<string, string> = {
  price: "Price",
  sac: "SAC",
};

export function OperationsTable({ operations, clients }: OperationsTableProps) {
  const navigate = useNavigate();

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Cliente não encontrado";
  };

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
                  {operation.id}
                </TableCell>
                <TableCell className="font-medium">
                  {getClientName(operation.clientId)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(operation.principal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(operation.interestRate)} a.m.
                </TableCell>
                <TableCell className="text-center">
                  {operation.termMonths} meses
                </TableCell>
                <TableCell className="text-center">
                  {amortizationLabels[operation.amortizationType]}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {format(operation.createdAt, "dd/MM/yyyy")}
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
