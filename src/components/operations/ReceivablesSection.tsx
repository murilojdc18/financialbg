import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Receipt, AlertCircle } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { formatCurrency } from "@/lib/loan-calculator";
import { useReceivablesByOperation } from "@/hooks/useReceivables";
import { DbReceivable, ReceivableStatus, PaymentMethod } from "@/types/database";

interface ReceivablesSectionProps {
  operationId: string;
}

const statusConfig: Record<
  ReceivableStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  EM_ABERTO: { label: "Em Aberto", variant: "outline" },
  PAGO: { label: "Pago", variant: "secondary" },
  ATRASADO: { label: "Atrasado", variant: "destructive" },
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  OUTRO: "Outro",
};

function getDisplayStatus(receivable: DbReceivable): ReceivableStatus {
  if (receivable.status === "PAGO") {
    return "PAGO";
  }
  
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(receivable.due_date));
  
  if (isBefore(dueDate, today)) {
    return "ATRASADO";
  }
  
  return "EM_ABERTO";
}

export function ReceivablesSection({ operationId }: ReceivablesSectionProps) {
  const { data: receivables, isLoading, error } = useReceivablesByOperation(operationId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <CardTitle>Parcelas</CardTitle>
        </div>
        <CardDescription>
          Parcelas registradas para esta operação
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">
              Erro ao carregar parcelas. Tente novamente mais tarde.
            </p>
          </div>
        ) : !receivables || receivables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma parcela encontrada para esta operação.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Nº</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Método</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((receivable) => {
                  const displayStatus = getDisplayStatus(receivable);
                  const statusStyle = statusConfig[displayStatus];

                  return (
                    <TableRow key={receivable.id}>
                      <TableCell className="font-medium">
                        {receivable.installment_number}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(receivable.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(receivable.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusStyle.variant}>
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {receivable.paid_at
                          ? format(parseISO(receivable.paid_at), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {receivable.payment_method
                          ? paymentMethodLabels[receivable.payment_method]
                          : "—"}
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
  );
}
