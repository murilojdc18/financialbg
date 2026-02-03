import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Trash2, Archive } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeleteOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
  clientName?: string;
  onSuccess?: () => void;
}

interface OperationStats {
  receivablesCount: number;
  paymentsCount: number;
  hasPayments: boolean;
}

function useOperationStats(operationId: string, open: boolean) {
  return useQuery({
    queryKey: ["operation-stats", operationId],
    queryFn: async (): Promise<OperationStats> => {
      // Count receivables
      const { count: receivablesCount, error: recError } = await supabase
        .from("receivables")
        .select("*", { count: "exact", head: true })
        .eq("operation_id", operationId);

      if (recError) throw recError;

      // Count valid payments (not voided)
      const { count: paymentsCount, error: payError } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("operation_id", operationId)
        .eq("is_voided", false);

      if (payError) throw payError;

      return {
        receivablesCount: receivablesCount || 0,
        paymentsCount: paymentsCount || 0,
        hasPayments: (paymentsCount || 0) > 0,
      };
    },
    enabled: open && !!operationId,
  });
}

export function DeleteOperationDialog({
  open,
  onOpenChange,
  operationId,
  clientName,
  onSuccess,
}: DeleteOperationDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [deleteType, setDeleteType] = useState<"hard" | "soft">("soft");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: loadingStats } = useOperationStats(operationId, open);

  // Hard delete mutation
  const hardDeleteMutation = useMutation({
    mutationFn: async () => {
      // Delete receivables first
      const { error: recError } = await supabase
        .from("receivables")
        .delete()
        .eq("operation_id", operationId);

      if (recError) throw recError;

      // Then delete operation
      const { error: opError } = await supabase
        .from("operations")
        .delete()
        .eq("id", operationId);

      if (opError) throw opError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      toast({
        title: "Operação excluída",
        description: "A operação foi removida permanentemente.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    },
  });

  // Soft delete (cancel/archive) mutation
  const softDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("operations")
        .update({
          status: "CANCELADA",
          archived_at: new Date().toISOString(),
        })
        .eq("id", operationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      toast({
        title: "Operação cancelada",
        description: "A operação foi arquivada e não poderá receber novos pagamentos.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    },
  });

  const handleConfirm = () => {
    if (deleteType === "hard" && !stats?.hasPayments) {
      hardDeleteMutation.mutate();
    } else {
      softDeleteMutation.mutate();
    }
  };

  const isProcessing = hardDeleteMutation.isPending || softDeleteMutation.isPending;

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmed(false);
      setDeleteType("soft");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir Operação
          </AlertDialogTitle>
          <AlertDialogDescription>
            {clientName
              ? `Operação do cliente "${clientName}"`
              : `Operação ${operationId.slice(0, 8)}`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loadingStats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats summary */}
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              <p>
                <strong>Parcelas:</strong> {stats?.receivablesCount || 0}
              </p>
              <p>
                <strong>Pagamentos registrados:</strong> {stats?.paymentsCount || 0}
              </p>
            </div>

            {/* Warning for operations with payments */}
            {stats?.hasPayments && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta operação possui pagamentos registrados. Para manter a auditoria,
                  não é possível excluir definitivamente. Você pode Cancelar/Arquivar.
                </AlertDescription>
              </Alert>
            )}

            {/* Delete type selection */}
            <RadioGroup
              value={deleteType}
              onValueChange={(v) => setDeleteType(v as "hard" | "soft")}
              className="space-y-3"
            >
              <div
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                  deleteType === "soft"
                    ? "border-primary bg-primary/5"
                    : "border-muted"
                }`}
              >
                <RadioGroupItem value="soft" id="soft" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="soft" className="flex items-center gap-2 cursor-pointer">
                    <Archive className="h-4 w-4" />
                    Cancelar/Arquivar (recomendado)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mantém histórico e auditoria. A operação ficará com status "Cancelada".
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                  stats?.hasPayments
                    ? "opacity-50 cursor-not-allowed"
                    : deleteType === "hard"
                    ? "border-destructive bg-destructive/5"
                    : "border-muted"
                }`}
              >
                <RadioGroupItem
                  value="hard"
                  id="hard"
                  className="mt-1"
                  disabled={stats?.hasPayments}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="hard"
                    className={`flex items-center gap-2 ${
                      stats?.hasPayments ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir definitivamente
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.hasPayments
                      ? "Bloqueado: existem pagamentos registrados."
                      : "Remove permanentemente a operação e todas as parcelas."}
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* Confirmation checkbox */}
            <div className="flex items-start space-x-2 pt-2">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(!!checked)}
              />
              <Label htmlFor="confirm" className="text-sm cursor-pointer">
                Entendo que esta ação pode ser irreversível
              </Label>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!confirmed || loadingStats || isProcessing}
            className={
              deleteType === "hard" && !stats?.hasPayments
                ? "bg-destructive hover:bg-destructive/90"
                : ""
            }
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {deleteType === "hard" && !stats?.hasPayments
              ? "Excluir definitivamente"
              : "Cancelar/Arquivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
