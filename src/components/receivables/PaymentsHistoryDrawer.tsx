import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Receipt, Pencil, Undo2, Ban } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/loan-calculator";
import { useAllPaymentsByReceivable, PaymentWithVoid } from "@/hooks/usePaymentCorrection";
import { PaymentMethod } from "@/types/database";
import { EditPaymentDialog } from "./EditPaymentDialog";
import { VoidPaymentDialog } from "./VoidPaymentDialog";

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
  const { data: payments, isLoading } = useAllPaymentsByReceivable(receivableId || '');
  
  // Estados para os diálogos
  const [editingPayment, setEditingPayment] = useState<PaymentWithVoid | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<PaymentWithVoid | null>(null);

  // Separar pagamentos válidos e anulados
  const validPayments = payments?.filter(p => !p.is_voided) || [];
  const voidedPayments = payments?.filter(p => p.is_voided) || [];
  const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl">
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
                    <span>Total pago (válido):</span>
                    <span className="text-primary">
                      {formatCurrency(totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Pagamentos válidos:</span>
                    <span>{validPayments.length}</span>
                  </div>
                  {voidedPayments.length > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>Pagamentos anulados:</span>
                      <span className="text-destructive">{voidedPayments.length}</span>
                    </div>
                  )}
                </div>

                {/* Lista de pagamentos válidos */}
                {validPayments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Pagamentos Válidos</h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validPayments.map((payment) => (
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
                              <TableCell className="text-right">
                                <TooltipProvider>
                                  <div className="flex justify-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setEditingPayment(payment)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Editar pagamento</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => setVoidingPayment(payment)}
                                        >
                                          <Undo2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Desfazer pagamento</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Lista de pagamentos anulados */}
                {voidedPayments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                      Pagamentos Anulados
                    </h4>
                    <div className="rounded-md border border-destructive/20 bg-destructive/5">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {voidedPayments.map((payment) => (
                            <TableRow key={payment.id} className="opacity-60">
                              <TableCell className="line-through">
                                {format(parseISO(payment.paid_at), "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell className="text-right font-medium line-through">
                                {formatCurrency(Number(payment.amount))}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-1">
                                  <Ban className="h-3 w-3 text-destructive" />
                                  <span className="truncate max-w-[150px]">
                                    {payment.void_reason || "Sem motivo informado"}
                                  </span>
                                </div>
                                {payment.voided_at && (
                                  <div className="text-xs text-muted-foreground">
                                    Anulado em {format(parseISO(payment.voided_at), "dd/MM/yyyy")}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Detalhes com notas */}
                {validPayments.some(p => p.note || p.notes) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Observações</h4>
                    {validPayments
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

      {/* Diálogos de edição e anulação */}
      <EditPaymentDialog
        open={!!editingPayment}
        onOpenChange={(open) => !open && setEditingPayment(null)}
        payment={editingPayment}
        receivableId={receivableId || ''}
      />
      
      <VoidPaymentDialog
        open={!!voidingPayment}
        onOpenChange={(open) => !open && setVoidingPayment(null)}
        payment={voidingPayment}
        receivableId={receivableId || ''}
      />
    </>
  );
}
