import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Eye } from "lucide-react";
import { Installment, InstallmentStatus } from "@/types/installment";
import { Client } from "@/types/client";
import { formatCurrency } from "@/lib/loan-calculator";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ReceivablesTableProps {
  installments: Installment[];
  clients: Client[];
  onMarkAsPaid: (installment: Installment) => void;
}

const statusConfig: Record<
  InstallmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  em_aberto: { label: "Em aberto", variant: "outline" },
  pago: { label: "Pago", variant: "secondary" },
  atrasado: { label: "Atrasado", variant: "destructive" },
};

export function ReceivablesTable({
  installments,
  clients,
  onMarkAsPaid,
}: ReceivablesTableProps) {
  const navigate = useNavigate();

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Cliente não encontrado";
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parcela</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Operação</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((installment) => {
            const status = statusConfig[installment.status];
            return (
              <TableRow key={installment.id}>
                <TableCell className="font-medium">
                  {installment.installmentNumber}ª
                </TableCell>
                <TableCell>{getClientName(installment.clientId)}</TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-medium"
                    onClick={() => navigate(`/operacoes/${installment.operationId}`)}
                  >
                    {installment.operationId}
                  </Button>
                </TableCell>
                <TableCell>{format(installment.dueDate, "dd/MM/yyyy")}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(installment.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/operacoes/${installment.operationId}`)}
                      title="Ver operação"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {installment.status !== "pago" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMarkAsPaid(installment)}
                        className="gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Pagar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
