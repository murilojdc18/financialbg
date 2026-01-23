import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/loan-calculator";
import { PaymentMethod } from "@/types/database";

interface MarkReceivablePaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installmentNumber: number;
  originalAmount: number;
  updatedAmount: number;
  hasLateFees: boolean;
  onConfirm: (data: {
    paidAt: Date;
    paymentMethod: PaymentMethod;
    amountPaid: number;
  }) => Promise<void>;
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO", label: "Cartão" },
  { value: "OUTRO", label: "Outro" },
];

export function MarkReceivablePaidDialog({
  open,
  onOpenChange,
  installmentNumber,
  originalAmount,
  updatedAmount,
  hasLateFees,
  onConfirm,
}: MarkReceivablePaidDialogProps) {
  const [paidAt, setPaidAt] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [amountPaid, setAmountPaid] = useState<string>(updatedAmount.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm({
        paidAt,
        paymentMethod,
        amountPaid: amount,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setPaidAt(new Date());
      setPaymentMethod("PIX");
      setAmountPaid(updatedAmount.toFixed(2));
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Marcar Parcela {installmentNumber} como Paga</DialogTitle>
          <DialogDescription>
            Informe os dados do pagamento para registrar a quitação desta parcela.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Resumo do valor */}
          <div className="rounded-md bg-muted p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor original:</span>
              <span>{formatCurrency(originalAmount)}</span>
            </div>
            {hasLateFees && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Valor com encargos (hoje):</span>
                <span className="font-medium">{formatCurrency(updatedAmount)}</span>
              </div>
            )}
          </div>

          {/* Data de pagamento */}
          <div className="space-y-2">
            <Label htmlFor="paidAt">Data de pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="paidAt"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paidAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paidAt ? format(paidAt, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paidAt}
                  onSelect={(date) => date && setPaidAt(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Método de pagamento */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de pagamento</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <SelectTrigger id="paymentMethod" className="w-full">
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor pago */}
          <div className="space-y-2">
            <Label htmlFor="amountPaid">Valor pago (R$)</Label>
            <Input
              id="amountPaid"
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
