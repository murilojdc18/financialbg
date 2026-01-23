import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle, Eye } from "lucide-react";
import { DbReceivableWithRelations, DbClient } from "@/types/database";
import { formatCurrency } from "@/lib/loan-calculator";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";

interface ReceivablesTableProps {
  receivables: DbReceivableWithRelations[];
  clients: DbClient[];
  onMarkAsPaid: (receivable: DbReceivableWithRelations) => void;
}

export function ReceivablesTable({
  receivables,
  onMarkAsPaid,
}: ReceivablesTableProps) {
  const navigate = useNavigate();

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
          {receivables.map((receivable) => {
            return (
              <TableRow key={receivable.id}>
                <TableCell className="font-medium">
                  {receivable.installment_number}ª
                </TableCell>
                <TableCell>{receivable.clients?.name || "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-medium"
                    onClick={() => navigate(`/operacoes/${receivable.operation_id}`)}
                  >
                    {receivable.operation_id.slice(0, 8)}
                  </Button>
                </TableCell>
                <TableCell>{format(parseISO(receivable.due_date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(receivable.amount))}
                </TableCell>
                <TableCell>
                  <StatusBadge status={receivable.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/operacoes/${receivable.operation_id}`)}
                      title="Ver operação"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {receivable.status !== "PAGO" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMarkAsPaid(receivable)}
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
