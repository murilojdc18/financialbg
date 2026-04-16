import { useState, useEffect } from "react";
import { Loader2, Trash2, Archive, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/loan-calculator";
import { supabase } from "@/integrations/supabase/client";
import { useDeleteReceivable } from "@/hooks/useDeleteReceivable";

interface DeleteReceivableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: {
    id: string;
    operation_id: string;
    installment_number: number;
    due_date: string;
    amount: number;
    status: string;
  } | null;
  onSuccess?: () => void;
}

export function DeleteReceivableDialog({
  open,
  onOpenChange,
  receivable,
  onSuccess,
}: DeleteReceivableDialogProps) {
  const deleteMutation = useDeleteReceivable();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [hasPayments, setHasPayments] = useState<boolean | null>(null);
  const [checkingPayments, setCheckingPayments] = useState(false);

  useEffect(() => {
    if (!open || !receivable) {
      setReason("");
      setConfirmed(false);
      setHasPayments(null);
      return;
    }

    // Check for payments
    setCheckingPayments(true);
    supabase
      .from("payments")
      .select("id")
      .eq("receivable_id", receivable.id)
      .or("is_voided.is.null,is_voided.eq.false")
      .limit(1)
      .then(({ data }) => {
        setHasPayments(data != null && data.length > 0);
        setCheckingPayments(false);
      });
  }, [open, receivable]);

  const handleDelete = async (mode: "hard" | "soft") => {
    if (!receivable || !confirmed) return;

    await deleteMutation.mutateAsync({
      receivableId: receivable.id,
      operationId: receivable.operation_id,
      installmentNumber: receivable.installment_number,
      reason,
      mode,
    });

    onSuccess?.();
    onOpenChange(false);
  };

  if (!receivable) return null;

  const isProcessing = deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !isProcessing && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir Parcela
          </DialogTitle>
          <DialogDescription>
            Confirme a exclusão da parcela abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Parcela:</span>
            <span className="font-medium">{receivable.installment_number}ª</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vencimento:</span>
            <span>{format(parseISO(receivable.due_date), "dd/MM/yyyy")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor:</span>
            <span className="font-medium">{formatCurrency(receivable.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span>{receivable.status}</span>
          </div>
        </div>

        {checkingPayments ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Verificando pagamentos...</span>
          </div>
        ) : hasPayments ? (
          <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              ⚠️ Esta parcela possui pagamentos registrados.
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
              Não é possível excluir definitivamente. A parcela será arquivada (soft delete) para preservar o histórico de pagamentos.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="text-muted-foreground">
              Esta parcela não possui pagamentos. Você pode excluir definitivamente ou arquivar.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason" className="text-sm">Motivo (opcional)</Label>
          <Textarea
            id="reason"
            placeholder="Ex.: parcela criada por engano"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="resize-none h-16"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="confirm"
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
            disabled={isProcessing}
          />
          <Label htmlFor="confirm" className="text-sm">
            Confirmo que quero excluir esta parcela
          </Label>
        </div>

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>

          {/* Soft delete — always available */}
          <Button
            type="button"
            variant="secondary"
            disabled={!confirmed || isProcessing || checkingPayments}
            onClick={() => handleDelete("soft")}
          >
            {isProcessing && deleteMutation.variables?.mode === "soft" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Arquivar
          </Button>

          {/* Hard delete — only if no payments */}
          {!hasPayments && hasPayments !== null && (
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmed || isProcessing || checkingPayments}
              onClick={() => handleDelete("hard")}
            >
              {isProcessing && deleteMutation.variables?.mode === "hard" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir definitivamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}