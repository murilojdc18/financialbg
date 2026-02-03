import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Info, ArrowRight, Wand2, ChevronDown, ChevronUp } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/loan-calculator";
import { 
  calculateReceivableDue, 
  allocateDeferToComponents,
  LateFeeConfig,
  ReceivableDueResult 
} from "@/lib/receivable-calculator";
import { PaymentMethod } from "@/types/database";
import { ReceivableForPayment, useFlexiblePaymentV2 } from "@/hooks/useFlexiblePaymentV2";

// Schema com validação
const formSchema = z.object({
  amountTotal: z.number({ required_error: "Valor é obrigatório" }).positive("Valor deve ser positivo"),
  paidAt: z.date({ required_error: "Data de pagamento é obrigatória" }),
  paymentMethod: z.enum(["PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CARTAO", "OUTRO"], {
    required_error: "Selecione um método de pagamento",
  }),
  note: z.string().max(500).optional(),
  // Alocação
  allocPenalty: z.number().min(0).default(0),
  allocInterest: z.number().min(0).default(0),
  allocPrincipal: z.number().min(0).default(0),
  // Descontos
  discountPenalty: z.number().min(0).default(0),
  discountInterest: z.number().min(0).default(0),
  discountPrincipal: z.number().min(0).default(0),
  // Postergar
  deferOption: z.enum(["keep", "defer"]).default("keep"),
  deferDays: z.number().min(1).max(365).default(30),
  deferToDate: z.date().optional(),
  customDeferAmount: z.number().min(0).default(0),
});

type FormValues = z.infer<typeof formSchema>;

interface FlexiblePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: ReceivableForPayment | null;
  onSuccess?: () => void;
}

export function FlexiblePaymentDialog({
  open,
  onOpenChange,
  receivable,
  onSuccess,
}: FlexiblePaymentDialogProps) {
  const flexiblePayment = useFlexiblePaymentV2();
  const [dueResult, setDueResult] = useState<ReceivableDueResult | null>(null);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountTotal: 0,
      paidAt: new Date(),
      paymentMethod: "PIX",
      note: "",
      allocPenalty: 0,
      allocInterest: 0,
      allocPrincipal: 0,
      discountPenalty: 0,
      discountInterest: 0,
      discountPrincipal: 0,
      deferOption: "keep",
      deferDays: 30,
      customDeferAmount: 0,
    },
  });

  const watchAmountTotal = form.watch("amountTotal");
  const watchPaidAt = form.watch("paidAt");
  const watchAllocPenalty = form.watch("allocPenalty");
  const watchAllocInterest = form.watch("allocInterest");
  const watchAllocPrincipal = form.watch("allocPrincipal");
  const watchDiscountPenalty = form.watch("discountPenalty");
  const watchDiscountInterest = form.watch("discountInterest");
  const watchDiscountPrincipal = form.watch("discountPrincipal");
  const watchDeferOption = form.watch("deferOption");
  const watchDeferDays = form.watch("deferDays");
  const watchCustomDeferAmount = form.watch("customDeferAmount");

  // Calcular encargos quando o dialog abre ou data muda
  useEffect(() => {
    if (!receivable || !open) return;

    const config: LateFeeConfig = {
      lateGraceDays: receivable.operations.late_grace_days ?? 0,
      latePenaltyPercent: Number(receivable.operations.late_penalty_percent) ?? 10,
      lateInterestDailyPercent: Number(receivable.operations.late_interest_daily_percent) ?? 0.5,
    };

    const result = calculateReceivableDue(
      {
        amount: receivable.amount,
        amountPaid: receivable.amount_paid ?? 0,
        penaltyApplied: receivable.penalty_applied ?? false,
        penaltyAmount: receivable.penalty_amount ?? 0,
        interestAccrued: receivable.interest_accrued ?? 0,
        carriedPenaltyAmount: receivable.carried_penalty_amount ?? 0,
        carriedInterestAmount: receivable.carried_interest_amount ?? 0,
        accrualFrozenAt: receivable.accrual_frozen_at,
        dueDate: receivable.due_date,
      },
      config,
      watchPaidAt
    );

    setDueResult(result);
  }, [receivable, open, watchPaidAt]);

  // Auto distribuir alocação
  const handleAutoDistribute = useCallback(() => {
    if (!dueResult) return;
    
    const amount = watchAmountTotal || 0;
    let remaining = amount;
    
    // Ordem: multa -> juros -> principal
    const penalty = Math.min(remaining, dueResult.breakdown.penalty);
    remaining -= penalty;
    
    const interest = Math.min(remaining, dueResult.breakdown.interest);
    remaining -= interest;
    
    const principal = Math.min(remaining, dueResult.breakdown.principal);
    
    form.setValue("allocPenalty", Math.round(penalty * 100) / 100);
    form.setValue("allocInterest", Math.round(interest * 100) / 100);
    form.setValue("allocPrincipal", Math.round(principal * 100) / 100);
  }, [dueResult, watchAmountTotal, form]);

  // Totais calculados
  const totalAllocated = useMemo(() => {
    return (watchAllocPenalty || 0) + (watchAllocInterest || 0) + (watchAllocPrincipal || 0);
  }, [watchAllocPenalty, watchAllocInterest, watchAllocPrincipal]);

  const allocationDifference = useMemo(() => {
    return Math.round(((watchAmountTotal || 0) - totalAllocated) * 100) / 100;
  }, [watchAmountTotal, totalAllocated]);

  const totalDiscount = useMemo(() => {
    return (watchDiscountPenalty || 0) + (watchDiscountInterest || 0) + (watchDiscountPrincipal || 0);
  }, [watchDiscountPenalty, watchDiscountInterest, watchDiscountPrincipal]);

  // Saldo restante após pagamento + descontos
  const balanceAfterPayment = useMemo(() => {
    if (!dueResult) return 0;
    
    const penaltyRemaining = Math.max(0, dueResult.breakdown.penalty - (watchAllocPenalty || 0) - (watchDiscountPenalty || 0));
    const interestRemaining = Math.max(0, dueResult.breakdown.interest - (watchAllocInterest || 0) - (watchDiscountInterest || 0));
    const principalRemaining = Math.max(0, dueResult.breakdown.principal - (watchAllocPrincipal || 0) - (watchDiscountPrincipal || 0));
    
    return Math.round((penaltyRemaining + interestRemaining + principalRemaining) * 100) / 100;
  }, [dueResult, watchAllocPenalty, watchAllocInterest, watchAllocPrincipal, watchDiscountPenalty, watchDiscountInterest, watchDiscountPrincipal]);

  // Breakdown do saldo restante
  const balanceBreakdown = useMemo(() => {
    if (!dueResult) return null;
    return {
      penalty: Math.max(0, dueResult.breakdown.penalty - (watchAllocPenalty || 0) - (watchDiscountPenalty || 0)),
      interest: Math.max(0, dueResult.breakdown.interest - (watchAllocInterest || 0) - (watchDiscountInterest || 0)),
      principal: Math.max(0, dueResult.breakdown.principal - (watchAllocPrincipal || 0) - (watchDiscountPrincipal || 0)),
    };
  }, [dueResult, watchAllocPenalty, watchAllocInterest, watchAllocPrincipal, watchDiscountPenalty, watchDiscountInterest, watchDiscountPrincipal]);

  // Atualizar customDeferAmount quando saldo muda
  useEffect(() => {
    if (balanceAfterPayment >= 0) {
      const currentDefer = form.getValues("customDeferAmount");
      if (!currentDefer || currentDefer > balanceAfterPayment) {
        form.setValue("customDeferAmount", balanceAfterPayment);
      }
    }
  }, [balanceAfterPayment, form]);

  // Alocação do valor a postergar
  const deferAllocationPreview = useMemo(() => {
    if (!balanceBreakdown || watchDeferOption !== "defer") return null;
    const deferAmount = watchCustomDeferAmount || 0;
    if (deferAmount <= 0) return null;
    
    return allocateDeferToComponents(
      deferAmount,
      balanceBreakdown.penalty,
      balanceBreakdown.interest,
      balanceBreakdown.principal
    );
  }, [balanceBreakdown, watchDeferOption, watchCustomDeferAmount]);

  // Validações
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (allocationDifference !== 0) {
      errors.push(`Soma da alocação (${formatCurrency(totalAllocated)}) deve ser igual ao valor recebido (${formatCurrency(watchAmountTotal || 0)})`);
    }
    
    if (watchDeferOption === "defer" && (watchCustomDeferAmount || 0) > balanceAfterPayment) {
      errors.push("Valor a postergar não pode ser maior que o saldo restante");
    }
    
    return errors;
  }, [allocationDifference, totalAllocated, watchAmountTotal, watchDeferOption, watchCustomDeferAmount, balanceAfterPayment]);

  const canSubmit = validationErrors.length === 0 && (watchAmountTotal || 0) > 0;

  const handleSubmit = async (values: FormValues) => {
    if (!receivable || !canSubmit) return;

    await flexiblePayment.mutateAsync({
      receivableId: receivable.id,
      amountTotal: values.amountTotal,
      paymentDate: values.paidAt,
      paymentMethod: values.paymentMethod as PaymentMethod,
      note: values.note,
      allocation: {
        penalty: values.allocPenalty,
        interest: values.allocInterest,
        principal: values.allocPrincipal,
      },
      discounts: {
        penalty: values.discountPenalty,
        interest: values.discountInterest,
        principal: values.discountPrincipal,
      },
      defer: values.deferOption === "defer" ? {
        amount: values.customDeferAmount,
        days: values.deferDays,
        toDate: values.deferToDate,
      } : undefined,
      receivable,
    });

    onSuccess?.();
    onOpenChange(false);
    form.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setDueResult(null);
      setDiscountsOpen(false);
    }
    onOpenChange(newOpen);
  };

  if (!receivable) return null;

  const hasCarriedFees = (receivable.carried_penalty_amount ?? 0) > 0 || (receivable.carried_interest_amount ?? 0) > 0;

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
              {/* Resumo do saldo devido */}
              {dueResult && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="font-medium text-sm mb-2">Saldo devido na data do pagamento:</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Principal:</span>
                    <span>{formatCurrency(dueResult.breakdown.principal)}</span>
                  </div>
                  
                  {hasCarriedFees && (
                    <>
                      {(receivable.carried_penalty_amount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Multa (renegociação):</span>
                          <span>{formatCurrency(receivable.carried_penalty_amount)}</span>
                        </div>
                      )}
                      {(receivable.carried_interest_amount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Juros (renegociação):</span>
                          <span>{formatCurrency(receivable.carried_interest_amount)}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {dueResult.breakdown.penalty > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Multa ({receivable.operations.late_penalty_percent}%):</span>
                      <span>{formatCurrency(dueResult.breakdown.penalty)}</span>
                    </div>
                  )}
                  {dueResult.breakdown.interest > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Juros mora ({dueResult.daysOverdue} dias):</span>
                      <span>{formatCurrency(dueResult.breakdown.interest)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total devido:</span>
                    <span className={dueResult.isOverdue ? "text-destructive" : ""}>
                      {formatCurrency(dueResult.breakdown.total)}
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
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bloco de Alocação */}
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
                
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="allocPenalty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Multa</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-sm"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allocInterest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Juros</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-sm"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-sm"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                    {formatCurrency(totalAllocated)}
                    {allocationDifference !== 0 && (
                      <span className="ml-2 text-xs">
                        (dif: {formatCurrency(allocationDifference)})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Bloco de Abatimentos (colapsável) */}
              <Collapsible open={discountsOpen} onOpenChange={setDiscountsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto border">
                    <span className="text-sm font-medium">
                      Abatimentos/Negociação
                      {totalDiscount > 0 && (
                        <span className="ml-2 text-primary">
                          ({formatCurrency(totalDiscount)})
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
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={form.control}
                        name="discountPenalty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Desc. Multa</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={dueResult?.breakdown.penalty || 0}
                                className="h-8 text-sm"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="discountInterest"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Desc. Juros</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={dueResult?.breakdown.interest || 0}
                                className="h-8 text-sm"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={dueResult?.breakdown.principal || 0}
                                className="h-8 text-sm"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm pt-2 border-t text-primary">
                        <span>Total abatido:</span>
                        <span className="font-medium">{formatCurrency(totalDiscount)}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Saldo restante e opções */}
              {balanceAfterPayment > 0.01 && (
                <>
                  <Separator />
                  <div className="rounded-md border p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">Saldo remanescente:</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-semibold text-warning cursor-help flex items-center gap-1">
                            {formatCurrency(balanceAfterPayment)}
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {balanceBreakdown && (
                            <>
                              <p>Principal: {formatCurrency(balanceBreakdown.principal)}</p>
                              <p>Multa: {formatCurrency(balanceBreakdown.penalty)}</p>
                              <p>Juros: {formatCurrency(balanceBreakdown.interest)}</p>
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="deferOption"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">O que fazer com o saldo?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="keep" id="keep" />
                                <Label htmlFor="keep" className="text-sm font-normal cursor-pointer">
                                  Manter nesta parcela (fica em aberto)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="defer" id="defer" />
                                <Label htmlFor="defer" className="text-sm font-normal cursor-pointer">
                                  Jogar para nova parcela (acrescentar parcela)
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {watchDeferOption === "defer" && (
                      <div className="space-y-4 pt-3 border-t">
                        {/* Valor a postergar */}
                        <FormField
                          control={form.control}
                          name="customDeferAmount"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-sm">Valor a postergar (R$)</FormLabel>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => form.setValue("customDeferAmount", balanceAfterPayment)}
                                >
                                  Usar saldo total
                                </Button>
                              </div>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={balanceAfterPayment}
                                  className="h-8"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Preview da alocação */}
                        {deferAllocationPreview && (watchCustomDeferAmount || 0) > 0 && (
                          <div className="rounded-md border bg-background p-3 text-sm space-y-2">
                            <p className="font-medium text-muted-foreground">Nova parcela receberá:</p>
                            <div className="space-y-1">
                              {deferAllocationPreview.carriedPrincipal > 0 && (
                                <div className="flex justify-between">
                                  <span>→ Principal:</span>
                                  <span>{formatCurrency(deferAllocationPreview.carriedPrincipal)}</span>
                                </div>
                              )}
                              {deferAllocationPreview.carriedPenalty > 0 && (
                                <div className="flex justify-between">
                                  <span>→ Multa:</span>
                                  <span>{formatCurrency(deferAllocationPreview.carriedPenalty)}</span>
                                </div>
                              )}
                              {deferAllocationPreview.carriedInterest > 0 && (
                                <div className="flex justify-between">
                                  <span>→ Juros:</span>
                                  <span>{formatCurrency(deferAllocationPreview.carriedInterest)}</span>
                                </div>
                              )}
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>Total nova parcela:</span>
                              <span className="text-primary">{formatCurrency(deferAllocationPreview.totalCarried)}</span>
                            </div>
                            
                            {deferAllocationPreview.totalRemaining > 0.01 && (
                              <>
                                <Separator className="my-2" />
                                <div className="text-muted-foreground text-xs">
                                  <p>Ficará nesta parcela: {formatCurrency(deferAllocationPreview.totalRemaining)}</p>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Dias para nova parcela */}
                        <FormField
                          control={form.control}
                          name="deferDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Dias para nova parcela</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="365"
                                  className="h-8"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                                />
                              </FormControl>
                              <FormDescription className="flex items-center gap-1 text-xs">
                                <ArrowRight className="h-3 w-3" />
                                Vencimento: {format(addDays(watchPaidAt ?? new Date(), watchDeferDays || 30), "dd/MM/yyyy")}
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
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
