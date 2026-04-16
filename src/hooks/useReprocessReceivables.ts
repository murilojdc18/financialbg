import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { calculateLoan } from "@/lib/loan-calculator";
import { round2 } from "@/lib/money";

interface ReprocessResult {
  total: number;
  updated: number;
  skipped: number;
  failed: { installment: number; reason: string }[];
}

interface OperationData {
  principal: number;
  rate_monthly: number;
  term_months: number;
  system: string;
  start_date: string;
  fee_fixed?: number | null;
  fee_insurance?: number | null;
}

export function useReprocessReceivables() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ReprocessResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reprocess = async (operationId: string, operationData: OperationData) => {
    setIsProcessing(true);
    setResult(null);

    const report: ReprocessResult = { total: 0, updated: 0, skipped: 0, failed: [] };

    try {
      // 1. Fetch all receivables for the operation
      const { data: receivables, error: fetchErr } = await supabase
        .from("receivables")
        .select("*")
        .eq("operation_id", operationId)
        .is("deleted_at", null)
        .order("installment_number");

      if (fetchErr) throw fetchErr;
      if (!receivables || receivables.length === 0) {
        toast({ title: "Nenhuma parcela encontrada", variant: "destructive" });
        setIsProcessing(false);
        return null;
      }

      report.total = receivables.length;

      // 2. Calculate schedule once
      let schedule: { number: number; interest: number; amortization: number; payment: number }[] = [];
      try {
        const loanResult = calculateLoan({
          principal: Number(operationData.principal),
          interestRate: Number(operationData.rate_monthly) * 100,
          isAnnualRate: false,
          termMonths: operationData.term_months,
          amortizationType: operationData.system.toLowerCase() as "price" | "sac",
          startDate: new Date(operationData.start_date),
          fixedFee: Number(operationData.fee_fixed ?? 0),
          insuranceFee: Number(operationData.fee_insurance ?? 0),
        });
        schedule = loanResult.schedule;
      } catch (err) {
        toast({ title: "Erro ao calcular cronograma", description: String(err), variant: "destructive" });
        setIsProcessing(false);
        return null;
      }

      // 3. Fetch all valid payments grouped by receivable
      const receivableIds = receivables.map((r) => r.id);
      const { data: payments } = await supabase
        .from("payments")
        .select("receivable_id, amount")
        .in("receivable_id", receivableIds)
        .or("is_voided.is.null,is_voided.eq.false");

      const paidByReceivable: Record<string, number> = {};
      if (payments) {
        for (const p of payments) {
          paidByReceivable[p.receivable_id] = round2(
            (paidByReceivable[p.receivable_id] ?? 0) + Number(p.amount)
          );
        }
      }

      // 4. Process each receivable
      for (const rec of receivables) {
        try {
          const scheduleRow = schedule.find((s) => s.number === rec.installment_number);

          // Normalize null fields
          const updates: Record<string, unknown> = {};
          let changed = false;

          // Fix null numeric fields
          if (rec.amount_paid === null || rec.amount_paid === undefined) {
            updates.amount_paid = 0;
            changed = true;
          }
          if (rec.penalty_amount === null || rec.penalty_amount === undefined) {
            updates.penalty_amount = 0;
            changed = true;
          }
          if (rec.interest_accrued === null || rec.interest_accrued === undefined) {
            updates.interest_accrued = 0;
            changed = true;
          }
          if (rec.carried_penalty_amount === null || rec.carried_penalty_amount === undefined) {
            updates.carried_penalty_amount = 0;
            changed = true;
          }
          if (rec.carried_interest_amount === null || rec.carried_interest_amount === undefined) {
            updates.carried_interest_amount = 0;
            changed = true;
          }
          if (rec.penalty_applied === null || rec.penalty_applied === undefined) {
            updates.penalty_applied = false;
            changed = true;
          }

          // Fix status based on payments
          const totalPaidForThis = paidByReceivable[rec.id] ?? 0;
          const totalDue = Number(rec.amount);

          if (rec.status !== "RENEGOCIADA") {
            if (totalPaidForThis >= totalDue - 0.01 && totalPaidForThis > 0) {
              if (rec.status !== "PAGO") {
                updates.status = "PAGO";
                changed = true;
              }
            } else {
              // Check if overdue
              const today = new Date();
              const dueDate = new Date(rec.due_date + "T12:00:00");
              if (dueDate < today && rec.status !== "ATRASADO" && rec.status !== "PARCIAL") {
                updates.status = "ATRASADO";
                changed = true;
              } else if (dueDate >= today && rec.status === "ATRASADO") {
                updates.status = "EM_ABERTO";
                changed = true;
              }
            }
          }

          if (!changed) {
            report.skipped++;
            continue;
          }

          const { error: updateErr } = await supabase
            .from("receivables")
            .update(updates)
            .eq("id", rec.id);

          if (updateErr) {
            report.failed.push({ installment: rec.installment_number, reason: updateErr.message });
          } else {
            report.updated++;
          }
        } catch (err) {
          report.failed.push({ installment: rec.installment_number, reason: String(err) });
        }
      }

      setResult(report);
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["operations"] });

      toast({
        title: "Reprocessamento concluído",
        description: `${report.updated} atualizadas, ${report.skipped} sem alteração, ${report.failed.length} falhas`,
      });

      return report;
    } catch (err) {
      toast({ title: "Erro ao reprocessar", description: String(err), variant: "destructive" });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return { reprocess, isProcessing, result };
}
