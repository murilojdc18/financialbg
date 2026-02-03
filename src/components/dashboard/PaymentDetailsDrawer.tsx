import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentWithDetails } from "@/hooks/useDashboardData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  payments: PaymentWithDetails[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

const METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  OUTRO: "Outro",
};

export function PaymentDetailsDrawer({
  open,
  onOpenChange,
  clientName,
  payments,
}: PaymentDetailsDrawerProps) {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount_total, 0);
  const totalPrincipal = payments.reduce((sum, p) => sum + p.alloc_principal, 0);
  const totalInterest = payments.reduce((sum, p) => sum + p.alloc_interest, 0);
  const totalPenalty = payments.reduce((sum, p) => sum + p.alloc_penalty, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pagamentos de {clientName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qtde Pagamentos</p>
              <p className="text-xl font-bold">{payments.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Principal</p>
              <p className="font-medium">{formatCurrency(totalPrincipal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Juros + Multa</p>
              <p className="font-medium">
                {formatCurrency(totalInterest + totalPenalty)}
              </p>
            </div>
          </div>

          {/* Payments table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Multa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paid_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        #{payment.installment_number}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {METHOD_LABELS[payment.method] || payment.method}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payment.alloc_principal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payment.alloc_interest)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payment.alloc_penalty)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(payment.amount_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Notes section */}
          {payments.some((p) => p.note) && (
            <div className="space-y-2">
              <h4 className="font-medium">Observações</h4>
              {payments
                .filter((p) => p.note)
                .map((p) => (
                  <div key={p.id} className="text-sm text-muted-foreground">
                    <span className="font-medium">{formatDate(p.paid_at)}:</span>{" "}
                    {p.note}
                  </div>
                ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
