import { format, parseISO } from "date-fns";
import { Loader2, Receipt, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { formatCurrency } from "@/lib/loan-calculator";
import { usePaymentsByReceivable } from "@/hooks/useFlexiblePayment";
import { PaymentMethod } from "@/types/database";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  OUTRO: "Outro",
};

interface PaymentsHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivableId: string | null;
  installmentNumber?: number;
}

export function PaymentsHistoryDrawer({
  open,
  onOpenChange,
  receivableId,
  installmentNumber,
}: PaymentsHistoryDrawerProps) {
  const { data: payments, isLoading } = usePaymentsByReceivable(receivableId || '');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Pagamentos
          </SheetTitle>
          <SheetDescription>
            {installmentNumber 
              ? `Parcela ${installmentNumber}ª` 
              : 'Todos os pagamentos desta parcela'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !payments || payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento registrado
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex justify-between font-medium">
                  <span>Total pago:</span>
                  <span className="text-primary">
                    {formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>Quantidade de pagamentos:</span>
                  <span>{payments.length}</span>
                </div>
              </div>

              {/* Lista de pagamentos */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {format(parseISO(payment.paid_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(payment.amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {paymentMethodLabels[payment.method] || payment.method}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Detalhes com notas */}
              {payments.some(p => p.note || p.notes) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Observações</h4>
                  {payments
                    .filter(p => p.note || p.notes)
                    .map((payment) => (
                      <div key={payment.id} className="rounded-md border p-3 text-sm">
                        <p className="text-muted-foreground text-xs mb-1">
                          {format(parseISO(payment.paid_at), "dd/MM/yyyy")}:
                        </p>
                        <p>{payment.note || payment.notes}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
