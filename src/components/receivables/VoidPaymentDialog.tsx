import { useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useVoidPayment, PaymentWithVoid } from "@/hooks/usePaymentCorrection";
import { formatCurrency } from "@/lib/loan-calculator";

interface VoidPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentWithVoid | null;
  receivableId: string;
}

export function VoidPaymentDialog({
  open,
  onOpenChange,
  payment,
  receivableId,
}: VoidPaymentDialogProps) {
  const [reason, setReason] = useState("");
  const { mutate: voidPayment, isPending } = useVoidPayment();

  const handleVoid = () => {
    if (!payment) return;

    voidPayment(
      {
        paymentId: payment.id,
        receivableId,
        voidReason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setReason("");
          onOpenChange(false);
        },
      }
    );
  };

  if (!payment) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Desfazer Pagamento
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá anular o pagamento selecionado. O pagamento não será
            excluído, apenas marcado como anulado para manter o histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Detalhes do pagamento */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Valor:</span>
            <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Data:</span>
            <span>{format(parseISO(payment.paid_at), "dd/MM/yyyy")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Método:</span>
            <span>{payment.method}</span>
          </div>
        </div>

        {/* Motivo */}
        <div className="space-y-2">
          <Label htmlFor="void-reason">Motivo da anulação (opcional)</Label>
          <Textarea
            id="void-reason"
            placeholder="Ex: Valor informado incorretamente, data errada..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="resize-none"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleVoid}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            Desfazer Pagamento
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
