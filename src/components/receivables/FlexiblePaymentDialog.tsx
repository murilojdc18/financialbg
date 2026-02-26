import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Info, ArrowRight, Wand2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/loan-calculator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { 
  calculateReceivableDue, 
  allocateDeferToComponents,
  LateFeeConfig,
  ReceivableDueResult,
  DeferPriority,
} from "@/lib/receivable-calculator";
import { 
  getContractInterestForInstallment, 
  splitPrincipalIntoComponents,
  ContractInterestBreakdown,
} from "@/lib/contract-interest-calculator";
import { PaymentMethod } from "@/types/database";
import { ReceivableForPayment, useFlexiblePaymentV2 } from "@/hooks/useFlexiblePaymentV2";

/** Safe number: returns 0 for NaN, undefined, null, Infinity */
function safeNumber(n: unknown): number {
  if (typeof n === 'number' && isFinite(n)) return n;
  return 0;
}

/** Safe formatCurrency wrapper */
function safeCurrency(n: unknown): string {
  return formatCurrency(safeNumber(n));
}

/** Safe round to 2 decimal places */
function round2(n: number): number {
  const val = safeNumber(n);
  return Math.round(val * 100) / 100;
}

// Schema com validação — 4 campos de alocação
const formSchema = z.object({
  amountTotal: z.number({ required_error: "Valor é obrigatório" }).min(0, "Valor deve ser >= 0"),
  paidAt: z.date({ required_error: "Data de pagamento é obrigatória" }),
  paymentMethod: z.enum(["PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CARTAO", "OUTRO"], {
    required_error: "Selecione um método de pagamento",
  }),
  note: z.string().max(500).optional(),
  // Alocação — 4 componentes
  allocPenalty: z.number().min(0).default(0),
  allocLateInterest: z.number().min(0).default(0),
  allocContractInterest: z.number().min(0).default(0),
  allocPrincipal: z.number().min(0).default(0),
  // Descontos — 4 componentes
  discountPenalty: z.number().min(0).default(0),
  discountLateInterest: z.number().min(0).default(0),
  discountContractInterest: z.number().min(0).default(0),
  discountPrincipal: z.number().min(0).default(0),
  // Postergar/Reemitir
  deferOption: z.enum(["keep", "defer"]).default("keep"),
  deferDays: z.number().min(1).max(365).default(30),
  deferToDate: z.date({ required_error: "Data de vencimento é obrigatória" }),
  customDeferAmount: z.number().min(0).default(0),
  deferPriority: z.enum(["principal", "interest", "penalty"]).default("principal"),
  // Valor final editável da nova parcela
  finalNewInstallmentAmount: z.number().min(0).default(0),
  adjustmentReason: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FlexiblePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: ReceivableForPayment | null;
  onSuccess?: () => void;
}

/** 4-component due breakdown */
interface FourComponentDue {
  contractInterest: number;
  lateInterest: number;
  penalty: number;
  amortization: number;
  total: number;
}

export function FlexiblePaymentDialog({
  open,
  onOpenChange,
  receivable,
  onSuccess,
}: FlexiblePaymentDialogProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <ErrorBoundary
      onClose={handleClose}
      fallbackMessage="Ocorreu um erro no cálculo. Verifique os valores e tente novamente."
      variant="inline"
    >
      <FlexiblePaymentDialogInner
        open={open}
        onOpenChange={onOpenChange}
        receivable={receivable}
        onSuccess={onSuccess}
      />
    </ErrorBoundary>
  );
}

function FlexiblePaymentDialogInner({
  open,
  onOpenChange,
  receivable,
  onSuccess,
}: FlexiblePaymentDialogProps) {
  const flexiblePayment = useFlexiblePaymentV2();
  const [dueResult, setDueResult] = useState<ReceivableDueResult | null>(null);
  const [scheduleBreakdown, setScheduleBreakdown] = useState<ContractInterestBreakdown | null>(null);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountTotal: 0,
      paidAt: new Date(),
      paymentMethod: "PIX",
      note: "",
      allocPenalty: 0,
      allocLateInterest: 0,
      allocContractInterest: 0,
      allocPrincipal: 0,
      discountPenalty: 0,
      discountLateInterest: 0,
      discountContractInterest: 0,
      discountPrincipal: 0,
      deferOption: "keep",
      deferDays: 30,
      deferToDate: addDays(new Date(), 30),
      customDeferAmount: 0,
      deferPriority: "principal",
      finalNewInstallmentAmount: 0,
      adjustmentReason: "",
    },
  });

  const watchAmountTotal = safeNumber(form.watch("amountTotal"));
  const watchPaidAt = form.watch("paidAt");
  const watchAllocPenalty = safeNumber(form.watch("allocPenalty"));
  const watchAllocLateInterest = safeNumber(form.watch("allocLateInterest"));
  const watchAllocContractInterest = safeNumber(form.watch("allocContractInterest"));
  const watchAllocPrincipal = safeNumber(form.watch("allocPrincipal"));
  const watchDiscountPenalty = safeNumber(form.watch("discountPenalty"));
  const watchDiscountLateInterest = safeNumber(form.watch("discountLateInterest"));
  const watchDiscountContractInterest = safeNumber(form.watch("discountContractInterest"));
  const watchDiscountPrincipal = safeNumber(form.watch("discountPrincipal"));
  const watchDeferOption = form.watch("deferOption");
  const watchDeferDays = form.watch("deferDays");
  const watchDeferToDate = form.watch("deferToDate");
  const watchCustomDeferAmount = safeNumber(form.watch("customDeferAmount"));
  const watchDeferPriority = form.watch("deferPriority");
  const watchFinalNewAmount = safeNumber(form.watch("finalNewInstallmentAmount"));
  

  // Calculate schedule breakdown for contract interest
  useEffect(() => {
    if (!receivable || !open) return;
    try {
      const ops = receivable.operations;
      if (ops.principal > 0 && ops.term_months > 0) {
        const breakdown = getContractInterestForInstallment(
          {
            principal: ops.principal,
            rate_monthly: ops.rate_monthly,
            term_months: ops.term_months,
            system: ops.system,
            start_date: ops.start_date,
            fee_fixed: ops.fee_fixed,
            fee_insurance: ops.fee_insurance,
          },
          receivable.installment_number
        );
        setScheduleBreakdown(breakdown);
      } else {
        setScheduleBreakdown(null);
      }
    } catch (err) {
      console.error("[FlexiblePayment] Error calculating schedule breakdown:", err);
      setScheduleBreakdown(null);
    }
  }, [receivable, open]);

  // Calcular encargos quando o dialog abre ou data muda
  useEffect(() => {
    if (!receivable || !open) return;

    try {
      const config: LateFeeConfig = {
        lateGraceDays: safeNumber(receivable.operations.late_grace_days),
        latePenaltyPercent: safeNumber(receivable.operations.late_penalty_percent) || 10,
        lateInterestDailyPercent: safeNumber(receivable.operations.late_interest_daily_percent) || 0.5,
      };

      const result = calculateReceivableDue(
        {
          amount: safeNumber(receivable.amount),
          amountPaid: safeNumber(receivable.amount_paid),
          penaltyApplied: receivable.penalty_applied ?? false,
          penaltyAmount: safeNumber(receivable.penalty_amount),
          interestAccrued: safeNumber(receivable.interest_accrued),
          carriedPenaltyAmount: safeNumber(receivable.carried_penalty_amount),
          carriedInterestAmount: safeNumber(receivable.carried_interest_amount),
          accrualFrozenAt: receivable.accrual_frozen_at,
          dueDate: receivable.due_date,
        },
        config,
        watchPaidAt
      );

      setDueResult(result);
    } catch (err) {
      console.error("[FlexiblePayment] Error calculating due result:", err);
      setDueResult(null);
    }
  }, [receivable, open, watchPaidAt]);

  // 4-component due breakdown
  const fourComponentDue = useMemo<FourComponentDue | null>(() => {
    if (!dueResult) return null;
    
    try {
      const split = splitPrincipalIntoComponents(
        safeNumber(dueResult.breakdown.principal),
        scheduleBreakdown ?? { contractInterest: 0, amortization: 0, installmentTotal: 0 }
      );

      return {
        contractInterest: safeNumber(split.contractInterestRemaining),
        lateInterest: safeNumber(dueResult.breakdown.interest),
        penalty: safeNumber(dueResult.breakdown.penalty),
        amortization: safeNumber(split.amortizationRemaining),
        total: safeNumber(dueResult.breakdown.total),
      };
    } catch (err) {
      console.error("[FlexiblePayment] Error in fourComponentDue:", err);
      return null;
    }
  }, [dueResult, scheduleBreakdown]);

  // Detect "interest-only payment" mode
  const isInterestOnlyPayment = useMemo(() => {
    if (!fourComponentDue || !scheduleBreakdown) return false;
    return watchAllocPrincipal < 0.01 && watchAllocContractInterest > 0.01 && fourComponentDue.amortization > 0.01;
  }, [watchAllocPrincipal, watchAllocContractInterest, fourComponentDue, scheduleBreakdown]);

  // Auto distribuir alocação — order: penalty -> late interest -> contract interest -> principal
  const handleAutoDistribute = useCallback(() => {
    if (!fourComponentDue) return;
    
    let remaining = watchAmountTotal;
    
    const penalty = Math.min(remaining, safeNumber(fourComponentDue.penalty));
    remaining -= penalty;
    
    const lateInterest = Math.min(remaining, safeNumber(fourComponentDue.lateInterest));
    remaining -= lateInterest;

    const contractInterest = Math.min(remaining, safeNumber(fourComponentDue.contractInterest));
    remaining -= contractInterest;
    
    const principal = Math.min(remaining, safeNumber(fourComponentDue.amortization));
    
    form.setValue("allocPenalty", round2(penalty));
    form.setValue("allocLateInterest", round2(lateInterest));
    form.setValue("allocContractInterest", round2(contractInterest));
    form.setValue("allocPrincipal", round2(principal));
  }, [fourComponentDue, watchAmountTotal, form]);

  // Totais calculados — all via useMemo, NO useEffect setState
  const totalAllocated = useMemo(() => {
    return round2(watchAllocPenalty + watchAllocLateInterest + watchAllocContractInterest + watchAllocPrincipal);
  }, [watchAllocPenalty, watchAllocLateInterest, watchAllocContractInterest, watchAllocPrincipal]);

  const allocationDifference = useMemo(() => {
    return round2(watchAmountTotal - totalAllocated);
  }, [watchAmountTotal, totalAllocated]);

  const totalDiscount = useMemo(() => {
    return round2(watchDiscountPenalty + watchDiscountLateInterest + watchDiscountContractInterest + watchDiscountPrincipal);
  }, [watchDiscountPenalty, watchDiscountLateInterest, watchDiscountContractInterest, watchDiscountPrincipal]);

  // Saldo restante após pagamento + descontos (REAL-TIME) — 4 components
  const balanceBreakdown = useMemo(() => {
    if (!fourComponentDue) return { penalty: 0, lateInterest: 0, contractInterest: 0, amortization: 0, total: 0 };
    
    const penalty = round2(Math.max(0, safeNumber(fourComponentDue.penalty) - watchAllocPenalty - watchDiscountPenalty));
    const lateInterest = round2(Math.max(0, safeNumber(fourComponentDue.lateInterest) - watchAllocLateInterest - watchDiscountLateInterest));
    const contractInterest = round2(Math.max(0, safeNumber(fourComponentDue.contractInterest) - watchAllocContractInterest - watchDiscountContractInterest));
    const amortization = round2(Math.max(0, safeNumber(fourComponentDue.amortization) - watchAllocPrincipal - watchDiscountPrincipal));
    
    return {
      penalty,
      lateInterest,
      contractInterest,
      amortization,
      total: round2(penalty + lateInterest + contractInterest + amortization),
    };
  }, [fourComponentDue, watchAllocPenalty, watchAllocLateInterest, watchAllocContractInterest, watchAllocPrincipal, watchDiscountPenalty, watchDiscountLateInterest, watchDiscountContractInterest, watchDiscountPrincipal]);

  // When balance > 0, auto-force defer and set customDeferAmount + finalNewInstallmentAmount
  // CRITICAL FIX: removed `form` from dependency array to prevent infinite loop
  useEffect(() => {
    if (balanceBreakdown.total > 0.01) {
      form.setValue("deferOption", "defer");
      let baseAmount: number;
      if (isInterestOnlyPayment && scheduleBreakdown) {
        baseAmount = safeNumber(scheduleBreakdown.installmentTotal);
      } else {
        baseAmount = balanceBreakdown.total;
      }
      form.setValue("customDeferAmount", baseAmount);
      // Only set finalNewInstallmentAmount if it hasn't been manually changed
      const currentFinal = safeNumber(form.getValues("finalNewInstallmentAmount"));
      if (currentFinal < 0.01) {
        form.setValue("finalNewInstallmentAmount", baseAmount);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceBreakdown.total, isInterestOnlyPayment, scheduleBreakdown]);

  // Computed: base amount for new installment (read-only reference)
  const newInstallmentBaseAmount = useMemo(() => {
    if (isInterestOnlyPayment && scheduleBreakdown) {
      return safeNumber(scheduleBreakdown.installmentTotal);
    }
    return balanceBreakdown.total;
  }, [isInterestOnlyPayment, scheduleBreakdown, balanceBreakdown.total]);

  // Computed: adjustment = final - base
  const manualAdjustment = useMemo(() => {
    return round2(watchFinalNewAmount - newInstallmentBaseAmount);
  }, [watchFinalNewAmount, newInstallmentBaseAmount]);


  // Alocação do valor a postergar — use combined interest + principal for defer components
  const deferAllocationPreview = useMemo(() => {
    if (watchDeferOption !== "defer") return null;
    if (isInterestOnlyPayment && scheduleBreakdown) {
      return null;
    }
    if (watchCustomDeferAmount <= 0) return null;
    
    const totalInterestRemaining = balanceBreakdown.lateInterest + balanceBreakdown.contractInterest;
    
    return allocateDeferToComponents(
      watchCustomDeferAmount,
      balanceBreakdown.penalty,
      totalInterestRemaining,
      balanceBreakdown.amortization,
      watchDeferPriority as DeferPriority
    );
  }, [balanceBreakdown, watchDeferOption, watchCustomDeferAmount, watchDeferPriority, isInterestOnlyPayment, scheduleBreakdown]);

  // Validações
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (watchAmountTotal > 0 && allocationDifference !== 0) {
      errors.push(`Soma da alocação (${safeCurrency(totalAllocated)}) deve ser igual ao valor recebido (${safeCurrency(watchAmountTotal)})`);
    }
    
    if (balanceBreakdown.total > 0.01) {
      if (watchDeferOption !== "defer") {
        errors.push(`Existe saldo remanescente de ${safeCurrency(balanceBreakdown.total)}. Para concluir o pagamento, você precisa postergar esse saldo para uma nova parcela.`);
      }
    }

    return errors;
  }, [allocationDifference, totalAllocated, watchAmountTotal, watchDeferOption, balanceBreakdown.total]);

  const canSubmit = validationErrors.length === 0 && watchAmountTotal > 0 && (balanceBreakdown.total <= 0.01 || watchDeferOption === "defer");

  // Sync deferDays -> deferToDate
  useEffect(() => {
    const paymentDate = watchPaidAt ?? new Date();
    const currentDeferDate = form.getValues("deferToDate");
    const daysFromCurrentDate = currentDeferDate ? differenceInDays(currentDeferDate, paymentDate) : 30;
    
    if (!currentDeferDate || Math.abs(daysFromCurrentDate - (watchDeferDays || 30)) > 0) {
      form.setValue("deferToDate", addDays(paymentDate, watchDeferDays || 30));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchDeferDays, watchPaidAt]);

  const handleSubmit = async (values: FormValues) => {
    if (!receivable || !canSubmit) return;

    try {
      const adjustmentAmount = round2(safeNumber(values.finalNewInstallmentAmount) - newInstallmentBaseAmount);

      await flexiblePayment.mutateAsync({
        receivableId: receivable.id,
        amountTotal: safeNumber(values.amountTotal),
        paymentDate: values.paidAt,
        paymentMethod: values.paymentMethod as PaymentMethod,
        note: values.note,
        allocation: {
          penalty: safeNumber(values.allocPenalty),
          lateInterest: safeNumber(values.allocLateInterest),
          contractInterest: safeNumber(values.allocContractInterest),
          principal: safeNumber(values.allocPrincipal),
        },
        discounts: {
          penalty: safeNumber(values.discountPenalty),
          lateInterest: safeNumber(values.discountLateInterest),
          contractInterest: safeNumber(values.discountContractInterest),
          principal: safeNumber(values.discountPrincipal),
        },
        defer: values.deferOption === "defer" && safeNumber(values.customDeferAmount) > 0.01 ? {
          amount: safeNumber(values.customDeferAmount),
          toDate: values.deferToDate,
          priority: values.deferPriority as DeferPriority,
        } : undefined,
        isInterestOnlyPayment,
        scheduleBreakdown,
        manualAdjustment: Math.abs(adjustmentAmount) > 0.01 ? {
          amount: adjustmentAmount,
          reason: values.adjustmentReason || '',
          finalAmount: safeNumber(values.finalNewInstallmentAmount),
        } : undefined,
        receivable,
      });

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (err) {
      console.error("[FlexiblePayment] Submit error:", err);
      // Error toast is handled by the mutation's onError
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setDueResult(null);
      setScheduleBreakdown(null);
      setDiscountsOpen(false);
    }
    onOpenChange(newOpen);
  };

  if (!receivable) return null;

  const hasCarriedFees = safeNumber(receivable.carried_penalty_amount) > 0 || safeNumber(receivable.carried_interest_amount) > 0;

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento Flexível</DialogTitle>
            <DialogDescription>
              Parcela {receivable.installment_number}ª - Vencimento: {format(new Date(receivable.due_date), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* ========== SALDO DEVIDO — 4 COMPONENTES ========== */}
              {fourComponentDue && dueResult && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="font-medium text-sm mb-2">Saldo devido na data do pagamento:</p>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Juros da operação (contratual):</span>
                    <span>{safeCurrency(fourComponentDue.contractInterest)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={cn("text-muted-foreground", dueResult.isOverdue && "text-destructive")}>
                      Mora ({safeNumber(dueResult.daysOverdue)} dias × {safeNumber(receivable.operations.late_interest_daily_percent)}%/dia):
                    </span>
                    <span className={dueResult.isOverdue ? "text-destructive" : ""}>
                      {safeCurrency(fourComponentDue.lateInterest)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={cn("text-muted-foreground", dueResult.isOverdue && "text-destructive")}>
                      Multa ({safeNumber(receivable.operations.late_penalty_percent)}%):
                    </span>
                    <span className={dueResult.isOverdue ? "text-destructive" : ""}>
                      {safeCurrency(fourComponentDue.penalty)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Principal (amortização):</span>
                    <span>{safeCurrency(fourComponentDue.amortization)}</span>
                  </div>
                  
                  {hasCarriedFees && (
                    <div className="text-xs text-amber-600 pt-1">
                      * Inclui encargos trazidos de renegociação
                      {safeNumber(receivable.carried_penalty_amount) > 0 && ` (Multa: ${safeCurrency(receivable.carried_penalty_amount)})`}
                      {safeNumber(receivable.carried_interest_amount) > 0 && ` (Juros: ${safeCurrency(receivable.carried_interest_amount)})`}
                    </div>
                  )}
                  
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total devido:</span>
                    <span className={dueResult.isOverdue ? "text-destructive" : ""}>
                      {safeCurrency(fourComponentDue.total)}
                    </span>
                  </div>
                </div>
              )}

              {/* Campos principais */}
              <div className="grid grid-cols-2 gap-4">
                {/* Data de pagamento */}
                <FormField
                  control={form.control}
                  name="paidAt"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data do Pagamento *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Método de pagamento */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="BOLETO">Boleto</SelectItem>
                          <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                          <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                          <SelectItem value="CARTAO">Cartão</SelectItem>
                          <SelectItem value="OUTRO">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Valor recebido */}
              <FormField
                control={form.control}
                name="amountTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Recebido (R$) *</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={safeNumber(field.value)}
                        onValueChange={field.onChange}
                        showPrefix
                        placeholder="0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ========== ALOCAÇÃO DO PAGAMENTO — 4 COMPONENTES ========== */}
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Alocação do Pagamento</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoDistribute}
                    className="h-7 text-xs"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Auto distribuir
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="allocPenalty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Multa</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={safeNumber(field.value)}
                            onValueChange={field.onChange}
                            className="h-8 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allocLateInterest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Mora (atraso)</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={safeNumber(field.value)}
                            onValueChange={field.onChange}
                            className="h-8 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allocContractInterest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Juros operação</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={safeNumber(field.value)}
                            onValueChange={field.onChange}
                            className="h-8 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allocPrincipal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Principal</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={safeNumber(field.value)}
                            onValueChange={field.onChange}
                            className="h-8 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Total alocado:</span>
                  <span className={cn(
                    "font-medium",
                    allocationDifference !== 0 && "text-destructive"
                  )}>
                    {safeCurrency(totalAllocated)}
                    {allocationDifference !== 0 && (
                      <span className="ml-2 text-xs">
                        (dif: {safeCurrency(allocationDifference)})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* ========== ABATIMENTOS (COLAPSÁVEL) — 4 COMPONENTES ========== */}
              <Collapsible open={discountsOpen} onOpenChange={setDiscountsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto border">
                    <span className="text-sm font-medium">
                      Abatimentos/Negociação
                      {totalDiscount > 0 && (
                        <span className="ml-2 text-primary">
                          ({safeCurrency(totalDiscount)})
                        </span>
                      )}
                    </span>
                    {discountsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Valores que serão desconsiderados (isenção negociada)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="discountPenalty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Desc. Multa</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={safeNumber(field.value)}
                                onValueChange={field.onChange}
                                className="h-8 text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="discountLateInterest"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Desc. Mora</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={safeNumber(field.value)}
                                onValueChange={field.onChange}
                                className="h-8 text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="discountContractInterest"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Desc. Juros Op.</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={safeNumber(field.value)}
                                onValueChange={field.onChange}
                                className="h-8 text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="discountPrincipal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Desc. Principal</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={safeNumber(field.value)}
                                onValueChange={field.onChange}
                                className="h-8 text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm pt-2 border-t text-primary">
                        <span>Total abatido:</span>
                        <span className="font-medium">{safeCurrency(totalDiscount)}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ========== SALDO REMANESCENTE (SEMPRE VISÍVEL) — 4 COMPONENTES ========== */}
              <div className={cn(
                "rounded-lg border p-4 space-y-2",
                balanceBreakdown.total > 0.01 ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : "bg-muted/30"
              )}>
                <p className="font-medium text-sm">
                  {balanceBreakdown.total > 0.01 
                    ? "⚠️ Saldo que será postergado (obrigatório):" 
                    : "Saldo remanescente (atualizado):"}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 rounded bg-background border">
                    <p className="text-xs text-muted-foreground">Juros Operação</p>
                    <p className="font-semibold">{safeCurrency(balanceBreakdown.contractInterest)}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-background border">
                    <p className="text-xs text-muted-foreground">Mora (atraso)</p>
                    <p className="font-semibold">{safeCurrency(balanceBreakdown.lateInterest)}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-background border">
                    <p className="text-xs text-muted-foreground">Multa</p>
                    <p className="font-semibold">{safeCurrency(balanceBreakdown.penalty)}</p>
                  </div>
                  <div className="text-center p-2 rounded bg-background border">
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="font-semibold">{safeCurrency(balanceBreakdown.amortization)}</p>
                  </div>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total remanescente:</span>
                  <span className={balanceBreakdown.total > 0 ? "text-warning" : "text-green-600"}>
                    {safeCurrency(balanceBreakdown.total)}
                  </span>
                </div>
              </div>

              {/* Postergação obrigatória quando há saldo */}
              {balanceBreakdown.total > 0.01 && (
                <>
                  {/* ========== INTEREST-ONLY DETECTION ========== */}
                  {isInterestOnlyPayment && scheduleBreakdown ? (
                    <>
                      {/* Special banner for interest-only payment */}
                      <div className="rounded-md border border-blue-400 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-3 text-sm space-y-2">
                        <p className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1">
                          <RefreshCw className="h-4 w-4" />
                          Pagamento somente de juros detectado
                        </p>
                        <p className="text-blue-700 dark:text-blue-400 text-xs">
                          O principal não foi amortizado. O sistema irá encerrar esta parcela como PAGO e criar uma nova parcela <strong>completa e igual</strong> (mesma composição).
                        </p>
                        <div className="mt-2 rounded border border-blue-200 dark:border-blue-800 bg-background p-3 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Nova parcela ({receivable.installment_number + 1}ª) será criada com:</p>
                          <div className="flex justify-between text-xs">
                            <span>Juros contratual:</span>
                            <span className="font-medium">{safeCurrency(scheduleBreakdown.contractInterest)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Principal (amortização):</span>
                            <span className="font-medium">{safeCurrency(scheduleBreakdown.amortization)}</span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex justify-between text-sm font-semibold">
                            <span>Total da nova parcela:</span>
                            <span className="text-primary">{safeCurrency(scheduleBreakdown.installmentTotal)}</span>
                          </div>
                        </div>
                        <p className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                          Parcelas futuras serão renumeradas (+1) e terão vencimento empurrado em 1 mês.
                        </p>
                      </div>

                      {/* DatePicker + Editable final amount for new installment */}
                      <div className="rounded-md border p-4 space-y-4">
                        <p className="text-sm font-medium">Configuração da nova parcela</p>
                        
                        {/* Editable final amount */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm p-2 bg-muted rounded">
                            <span className="text-muted-foreground">Valor base (calculado):</span>
                            <span className="font-medium">{safeCurrency(newInstallmentBaseAmount)}</span>
                          </div>
                          <FormField
                            control={form.control}
                            name="finalNewInstallmentAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Valor final da nova parcela (editável)</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <CurrencyInput
                                      value={safeNumber(field.value)}
                                      onValueChange={field.onChange}
                                      showPrefix
                                      className="flex-1"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-xs whitespace-nowrap"
                                    onClick={() => form.setValue("finalNewInstallmentAmount", newInstallmentBaseAmount)}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Resetar
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />
                          {Math.abs(manualAdjustment) > 0.01 && (
                            <div className={cn(
                              "flex justify-between text-sm p-2 rounded border",
                              manualAdjustment > 0 ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                            )}>
                              <span className="font-medium">
                                {manualAdjustment > 0 ? "Acréscimo aplicado:" : "Desconto aplicado:"}
                              </span>
                              <span className="font-semibold">
                                {manualAdjustment > 0 ? "+" : ""}{safeCurrency(manualAdjustment)}
                              </span>
                            </div>
                          )}
                        </div>

                        <Separator />

                        <FormField
                          control={form.control}
                          name="deferToDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-sm">Vencimento da nova parcela *</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => {
                                      field.onChange(date);
                                      if (date && watchPaidAt) {
                                        const days = differenceInDays(date, watchPaidAt);
                                        if (days > 0 && days <= 365) {
                                          form.setValue("deferDays", days);
                                        }
                                      }
                                    }}
                                    disabled={(date) => date < (watchPaidAt ?? new Date())}
                                    locale={ptBR}
                                    className="pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="deferDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm text-muted-foreground">Atalho: Dias a partir do pagamento</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="365"
                                  className="h-8"
                                  {...field}
                                  onChange={(e) => {
                                    const days = parseInt(e.target.value) || 30;
                                    field.onChange(days);
                                    const paymentDate = watchPaidAt ?? new Date();
                                    form.setValue("deferToDate", addDays(paymentDate, days));
                                  }}
                                />
                              </FormControl>
                              <FormDescription className="flex items-center gap-1 text-xs">
                                <ArrowRight className="h-3 w-3" />
                                Vencimento calculado: {format(watchDeferToDate ?? addDays(watchPaidAt ?? new Date(), watchDeferDays || 30), "dd/MM/yyyy")}
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Standard defer flow */}
                      <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <Info className="h-4 w-4" />
                          Para concluir, postergue o saldo remanescente.
                        </p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
                          Todo pagamento encerra a parcela atual como PAGO. O saldo restante será movido para uma nova parcela.
                        </p>
                      </div>

                      <div className="rounded-md border p-4 space-y-4">
                        <p className="text-sm font-medium">Postergar saldo para nova parcela</p>

                        <div className="space-y-4">
                          {/* Info box */}
                          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
                            <p className="font-medium text-primary flex items-center gap-1">
                              <Info className="h-4 w-4" />
                              Nova parcela será criada como {receivable.installment_number + 1}ª
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Parcelas futuras serão renumeradas (+1) e terão vencimento empurrado em 1 mês.
                            </p>
                          </div>

                          {/* Prioridade de postergação */}
                          <FormField
                            control={form.control}
                            name="deferPriority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Prioridade de postergação</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="principal">Postergar Principal primeiro (recomendado)</SelectItem>
                                    <SelectItem value="interest">Postergar Juros primeiro</SelectItem>
                                    <SelectItem value="penalty">Postergar Multa primeiro</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          {/* Preview da alocação */}
                          {deferAllocationPreview && watchCustomDeferAmount > 0 && (
                            <div className="rounded-md border bg-background p-3 text-sm space-y-2">
                              <div className="space-y-1">
                                <p className="font-medium text-primary text-xs">Composição base da nova parcela ({receivable.installment_number + 1}ª):</p>
                                <div className="flex justify-between text-xs">
                                  <span>Principal: {safeCurrency(deferAllocationPreview.carriedPrincipal)}</span>
                                  <span>Multa: {safeCurrency(deferAllocationPreview.carriedPenalty)}</span>
                                  <span>Juros: {safeCurrency(deferAllocationPreview.carriedInterest)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Editable final amount */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm p-2 bg-muted rounded">
                              <span className="text-muted-foreground">Valor base (calculado):</span>
                              <span className="font-medium">{safeCurrency(newInstallmentBaseAmount)}</span>
                            </div>
                            <FormField
                              control={form.control}
                              name="finalNewInstallmentAmount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm">Valor final da nova parcela (editável)</FormLabel>
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <CurrencyInput
                                        value={safeNumber(field.value)}
                                        onValueChange={field.onChange}
                                        showPrefix
                                        className="flex-1"
                                      />
                                    </FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-10 text-xs whitespace-nowrap"
                                      onClick={() => form.setValue("finalNewInstallmentAmount", newInstallmentBaseAmount)}
                                    >
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      Resetar
                                    </Button>
                                  </div>
                                </FormItem>
                              )}
                            />
                            {Math.abs(manualAdjustment) > 0.01 && (
                              <div className={cn(
                                "flex justify-between text-sm p-2 rounded border",
                                manualAdjustment > 0 ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                              )}>
                                <span className="font-medium">
                                  {manualAdjustment > 0 ? "Acréscimo aplicado:" : "Desconto aplicado:"}
                                </span>
                                <span className="font-semibold">
                                  {manualAdjustment > 0 ? "+" : ""}{safeCurrency(manualAdjustment)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* DatePicker for new installment due date */}
                          <FormField
                            control={form.control}
                            name="deferToDate"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-sm">Vencimento da nova parcela *</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full pl-3 text-left font-normal",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={(date) => {
                                        field.onChange(date);
                                        if (date && watchPaidAt) {
                                          const days = differenceInDays(date, watchPaidAt);
                                          if (days > 0 && days <= 365) {
                                            form.setValue("deferDays", days);
                                          }
                                        }
                                      }}
                                      disabled={(date) => date < (watchPaidAt ?? new Date())}
                                      locale={ptBR}
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Dias como atalho opcional */}
                          <FormField
                            control={form.control}
                            name="deferDays"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm text-muted-foreground">Atalho: Dias a partir do pagamento</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="365"
                                    className="h-8"
                                    {...field}
                                    onChange={(e) => {
                                      const days = parseInt(e.target.value) || 30;
                                      field.onChange(days);
                                      const paymentDate = watchPaidAt ?? new Date();
                                      form.setValue("deferToDate", addDays(paymentDate, days));
                                    }}
                                  />
                                </FormControl>
                                <FormDescription className="flex items-center gap-1 text-xs">
                                  <ArrowRight className="h-3 w-3" />
                                  Vencimento calculado: {format(watchDeferToDate ?? addDays(watchPaidAt ?? new Date(), watchDeferDays || 30), "dd/MM/yyyy")}
                                </FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Observação */}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre o pagamento (opcional)"
                        className="resize-none h-16"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Erros de validação */}
              {validationErrors.length > 0 && (
                <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                  {validationErrors.map((error, i) => (
                    <p key={i} className="text-sm text-destructive">{error}</p>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleOpenChange(false)} 
                  disabled={flexiblePayment.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={flexiblePayment.isPending || !canSubmit}
                >
                  {flexiblePayment.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Registrar Pagamento"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
