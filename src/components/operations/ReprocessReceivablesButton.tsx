import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useReprocessReceivables } from "@/hooks/useReprocessReceivables";

interface ReprocessReceivablesButtonProps {
  operationId: string;
  operationData: {
    principal: number;
    rate_monthly: number;
    term_months: number;
    system: string;
    start_date: string;
    fee_fixed?: number | null;
    fee_insurance?: number | null;
  };
}

export function ReprocessReceivablesButton({ operationId, operationData }: ReprocessReceivablesButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { reprocess, isProcessing, result } = useReprocessReceivables();

  const handleReprocess = async () => {
    await reprocess(operationId, operationData);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Reprocessar parcelas
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reprocessar parcelas</DialogTitle>
            <DialogDescription>
              Isso irá normalizar campos inconsistentes (nulos → 0), corrigir status com base nos pagamentos existentes e recalcular valores.
              Nenhuma regra de negócio será alterada.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="rounded-md border p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Total: {result.total} parcelas</span>
              </div>
              <div className="text-muted-foreground">
                ✅ {result.updated} atualizadas · ⏭️ {result.skipped} sem alteração
              </div>
              {result.failed.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {result.failed.length} falha(s):
                  </div>
                  {result.failed.map((f, i) => (
                    <div key={i} className="text-xs text-destructive pl-5">
                      Parcela #{f.installment}: {f.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result && (
              <Button onClick={handleReprocess} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando…
                  </>
                ) : (
                  "Confirmar reprocessamento"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
