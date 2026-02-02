import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Info, ArrowRight } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/loan-calculator";
import { 
  calculateReceivableDue, 
  allocatePaymentToComponents,
  allocateDeferToComponents,
  LateFeeConfig,
  ReceivableDueResult 
} from "@/lib/receivable-calculator";
import { PaymentMethod } from "@/types/database";
import { ReceivableForPayment, useFlexiblePayment } from "@/hooks/useFlexiblePayment";

const formSchema = z.object({
  amount: z.number({ required_error: "Valor é obrigatório" }).positive("Valor deve ser positivo"),
  paidAt: z.date({ required_error: "Data de pagamento é obrigatória" }),
  paymentMethod: z.enum(["PIX", "BOLETO", "TRANSFERENCIA", "DINHEIRO", "CARTAO", "OUTRO"], {
    required_error: "Selecione um método de pagamento",
  }),
  note: z.string().max(500).optional(),
  deferBalance: z.boolean().default(false),
  deferDays: z.number().min(1).max(365).optional(),
  deferToDate: z.date().optional(),
  customDeferAmount: z.number().min(0).optional(),
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
  const flexiblePayment = useFlexiblePayment();
  const [dueResult, setDueResult] = useState<ReceivableDueResult | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      paidAt: new Date(),
      paymentMethod: "PIX",
      note: "",
      deferBalance: false,
      deferDays: 30,
      customDeferAmount: 0,
    },
  });

  const watchAmount = form.watch("amount");
  const watchPaidAt = form.watch("paidAt");
  const watchDeferBalance = form.watch("deferBalance");
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

    // DEBUG: Log configuração e dados do receivable
    console.log('[FlexiblePaymentDialog] Dados para cálculo:', {
      dueDate: receivable.due_date,
      paidAt: watchPaidAt,
      paidAtISO: watchPaidAt?.toISOString(),
      config,
      amount: receivable.amount,
      amountPaid: receivable.amount_paid,
      penaltyApplied: receivable.penalty_applied,
      penaltyAmount: receivable.penalty_amount,
      interestAccrued: receivable.interest_accrued,
      carriedPenalty: receivable.carried_penalty_amount,
      carriedInterest: receivable.carried_interest_amount,
    });

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

    // DEBUG: Log resultado do cálculo
    console.log('[FlexiblePaymentDialog] Resultado do cálculo:', {
      daysOverdue: result.daysOverdue,
      isOverdue: result.isOverdue,
      penaltyCurrent: result.penaltyCurrent,
      interestCurrent: result.interestCurrent,
      totalPenalty: result.totalPenalty,
      totalInterest: result.totalInterest,
      breakdown: result.breakdown,
    });

    setDueResult(result);
    
    // Definir valor padrão como saldo total
    if (result.balance > 0) {
      form.setValue("amount", result.breakdown.total);
      form.setValue("customDeferAmount", result.breakdown.total);
    }
  }, [receivable, open, watchPaidAt, form]);

  // Calcular prévia da alocação
  const allocationPreview = useMemo(() => {
    if (!dueResult || !watchAmount) return null;
    
    return allocatePaymentToComponents(
      watchAmount,
      dueResult.breakdown.penalty,
      dueResult.breakdown.interest,
      dueResult.breakdown.principal
    );
  }, [dueResult, watchAmount]);

  // Calcular saldo restante após pagamento
  const balanceAfterPayment = useMemo(() => {
    if (!dueResult || !watchAmount) return dueResult?.breakdown.total ?? 0;
    return Math.max(0, dueResult.breakdown.total - watchAmount);
  }, [dueResult, watchAmount]);

  // Detalhamento do saldo restante para o tooltip
  const balanceBreakdown = useMemo(() => {
    if (!allocationPreview) return null;
    return {
      principal: allocationPreview.newPrincipalRemaining,
      penalty: allocationPreview.newPenaltyRemaining,
      interest: allocationPreview.newInterestRemaining,
    };
  }, [allocationPreview]);

  // Atualizar customDeferAmount quando saldo restante muda
  useEffect(() => {
    if (balanceAfterPayment > 0) {
      const currentDeferAmount = form.getValues("customDeferAmount");
      // Se o valor atual é maior que o saldo ou é 0 (ainda não definido), atualizar
      if (!currentDeferAmount || currentDeferAmount > balanceAfterPayment) {
        form.setValue("customDeferAmount", balanceAfterPayment);
      }
    }
  }, [balanceAfterPayment, form]);

  // Calcular alocação do valor a postergar (juros -> multa -> principal)
  const deferAllocationPreview = useMemo(() => {
    if (!balanceBreakdown || !watchCustomDeferAmount || watchCustomDeferAmount <= 0) return null;
    
    return allocateDeferToComponents(
      watchCustomDeferAmount,
      balanceBreakdown.penalty,
      balanceBreakdown.interest,
      balanceBreakdown.principal
    );
  }, [balanceBreakdown, watchCustomDeferAmount]);

  // Validação do valor a postergar
  const deferAmountError = useMemo(() => {
    if (!watchCustomDeferAmount || watchCustomDeferAmount < 0) return null;
    if (watchCustomDeferAmount > balanceAfterPayment) {
      return "O valor a postergar não pode ser maior que o saldo restante.";
    }
    return null;
  }, [watchCustomDeferAmount, balanceAfterPayment]);

  const handleSubmit = async (values: FormValues) => {
    if (!receivable) return;

    await flexiblePayment.mutateAsync({
      receivableId: receivable.id,
      amount: values.amount,
      paymentDate: values.paidAt,
      paymentMethod: values.paymentMethod as PaymentMethod,
      note: values.note,
      deferBalance: values.deferBalance,
      deferDays: values.deferDays,
      deferToDate: values.deferToDate,
      customDeferAmount: values.customDeferAmount,
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
    }
    onOpenChange(newOpen);
  };

  if (!receivable) return null;

  const hasCarriedFees = (receivable.carried_penalty_amount ?? 0) > 0 || (receivable.carried_interest_amount ?? 0) > 0;

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Parcela {receivable.installment_number}ª - Vencimento: {format(new Date(receivable.due_date), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Resumo do saldo */}
              {dueResult && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Principal em aberto:</span>
                    <span>{formatCurrency(dueResult.breakdown.principal)}</span>
                  </div>
                  
                  {/* Encargos carregados de renegociação */}
                  {hasCarriedFees && (
                    <>
                      {(receivable.carried_penalty_amount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span className="flex items-center gap-1">
                            Multa (renegociação)
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Multa trazida da parcela original</TooltipContent>
                            </Tooltip>
                          </span>
                          <span>{formatCurrency(receivable.carried_penalty_amount)}</span>
                        </div>
                      )}
                      {(receivable.carried_interest_amount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span className="flex items-center gap-1">
                            Juros (renegociação)
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Juros de mora trazidos da parcela original</TooltipContent>
                            </Tooltip>
                          </span>
                          <span>{formatCurrency(receivable.carried_interest_amount)}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Encargos atuais */}
                  {dueResult.breakdown.penalty > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span className="flex items-center gap-1">
                        Multa ({receivable.operations.late_penalty_percent}%)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>Multa única aplicada ao entrar em atraso</TooltipContent>
                        </Tooltip>
                      </span>
                      <span>{formatCurrency(dueResult.breakdown.penalty)}</span>
                    </div>
                  )}
                  {dueResult.breakdown.interest > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span className="flex items-center gap-1">
                        Juros mora ({dueResult.daysOverdue} dias)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {receivable.operations.late_interest_daily_percent}% ao dia sobre o principal
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <span>{formatCurrency(dueResult.breakdown.interest)}</span>
                    </div>
                  )}
                  {dueResult.totalPaid > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Já pago anteriormente:</span>
                      <span>-{formatCurrency(dueResult.totalPaid)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Saldo devido hoje:</span>
                    <span className={dueResult.isOverdue ? "text-destructive" : ""}>
                      {formatCurrency(dueResult.breakdown.total)}
                    </span>
                  </div>
                </div>
              )}

              {/* Valor do pagamento */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Pago (R$) *</FormLabel>
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
                    <FormDescription>
                      Pode ser menor que o saldo total (pagamento parcial)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Prévia da alocação */}
              {allocationPreview && watchAmount > 0 && (
                <div className="rounded-md border p-3 text-sm space-y-1 bg-background">
                  <p className="font-medium text-muted-foreground mb-2">Alocação do pagamento:</p>
                  {allocationPreview.allocatedToPenalty > 0 && (
                    <div className="flex justify-between">
                      <span>→ Multa:</span>
                      <span>{formatCurrency(allocationPreview.allocatedToPenalty)}</span>
                    </div>
                  )}
                  {allocationPreview.allocatedToInterest > 0 && (
                    <div className="flex justify-between">
                      <span>→ Juros:</span>
                      <span>{formatCurrency(allocationPreview.allocatedToInterest)}</span>
                    </div>
                  )}
                  {allocationPreview.allocatedToPrincipal > 0 && (
                    <div className="flex justify-between">
                      <span>→ Principal:</span>
                      <span>{formatCurrency(allocationPreview.allocatedToPrincipal)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Saldo restante:</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "cursor-help flex items-center gap-1",
                          balanceAfterPayment > 0 ? "text-warning" : "text-primary"
                        )}>
                          {formatCurrency(balanceAfterPayment)}
                          {balanceBreakdown && balanceAfterPayment > 0 && <Info className="h-3 w-3" />}
                        </span>
                      </TooltipTrigger>
                      {balanceBreakdown && balanceAfterPayment > 0 && (
                        <TooltipContent side="left" className="text-xs">
                          <p>Principal: {formatCurrency(balanceBreakdown.principal)}</p>
                          <p>Multa: {formatCurrency(balanceBreakdown.penalty)}</p>
                          <p>Juros: {formatCurrency(balanceBreakdown.interest)}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              )}

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
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione a data"}
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
                    <FormLabel>Método de Pagamento *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o método" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="BOLETO">Boleto</SelectItem>
                        <SelectItem value="TRANSFERENCIA">Transferência Bancária</SelectItem>
                        <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                        <SelectItem value="CARTAO">Cartão</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Checkbox postergar saldo - COM VALOR EDITÁVEL */}
              {balanceAfterPayment > 0.01 && (
                <>
                  <Separator />
                  <FormField
                    control={form.control}
                    name="deferBalance"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              // Resetar para saldo total quando ativar
                              if (checked) {
                                form.setValue("customDeferAmount", balanceAfterPayment);
                              }
                            }}
                            disabled={balanceAfterPayment <= 0.01}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none flex-1">
                          <FormLabel className="cursor-pointer">
                            Postergar saldo para nova parcela
                          </FormLabel>
                          <FormDescription>
                            <span className="text-xs text-muted-foreground">
                              Saldo restante total: {formatCurrency(balanceAfterPayment)}
                            </span>
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {watchDeferBalance && (
                    <div className="space-y-4 rounded-md border p-4 bg-muted/30">
                      {/* Valor a postergar (editável) */}
                      <FormField
                        control={form.control}
                        name="customDeferAmount"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Valor a postergar (R$)</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
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
                                {...field}
                                value={field.value ?? 0}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            {deferAmountError && (
                              <p className="text-sm text-destructive">{deferAmountError}</p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Preview da alocação do valor a postergar */}
                      {deferAllocationPreview && watchCustomDeferAmount && watchCustomDeferAmount > 0 && !deferAmountError && (
                        <div className="rounded-md border bg-background p-3 text-sm space-y-2">
                          <p className="font-medium text-muted-foreground">Nova parcela receberá:</p>
                          <div className="space-y-1">
                            {deferAllocationPreview.carriedInterest > 0 && (
                              <div className="flex justify-between">
                                <span>→ Juros:</span>
                                <span>{formatCurrency(deferAllocationPreview.carriedInterest)}</span>
                              </div>
                            )}
                            {deferAllocationPreview.carriedPenalty > 0 && (
                              <div className="flex justify-between">
                                <span>→ Multa:</span>
                                <span>{formatCurrency(deferAllocationPreview.carriedPenalty)}</span>
                              </div>
                            )}
                            {deferAllocationPreview.carriedPrincipal > 0 && (
                              <div className="flex justify-between">
                                <span>→ Principal:</span>
                                <span>{formatCurrency(deferAllocationPreview.carriedPrincipal)}</span>
                              </div>
                            )}
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-medium">
                            <span>Total nova parcela:</span>
                            <span className="text-primary">{formatCurrency(deferAllocationPreview.totalCarried)}</span>
                          </div>
                          
                          {/* Mostrar o que fica na parcela original */}
                          {deferAllocationPreview.totalRemaining > 0.01 && (
                            <>
                              <Separator className="my-2" />
                              <div className="text-muted-foreground">
                                <p className="font-medium mb-1">Ficará nesta parcela:</p>
                                <div className="space-y-1">
                                  {deferAllocationPreview.remainingInterest > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span>Juros:</span>
                                      <span>{formatCurrency(deferAllocationPreview.remainingInterest)}</span>
                                    </div>
                                  )}
                                  {deferAllocationPreview.remainingPenalty > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span>Multa:</span>
                                      <span>{formatCurrency(deferAllocationPreview.remainingPenalty)}</span>
                                    </div>
                                  )}
                                  {deferAllocationPreview.remainingPrincipal > 0 && (
                                    <div className="flex justify-between text-xs">
                                      <span>Principal:</span>
                                      <span>{formatCurrency(deferAllocationPreview.remainingPrincipal)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-between font-medium mt-1 text-warning">
                                  <span>Total em aberto:</span>
                                  <span>{formatCurrency(deferAllocationPreview.totalRemaining)}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Aviso se valor = 0 */}
                      {watchCustomDeferAmount === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Com valor 0, nenhuma nova parcela será criada.
                        </p>
                      )}

                      {/* Dias para nova parcela */}
                      <FormField
                        control={form.control}
                        name="deferDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dias para nova parcela</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="365"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                              />
                            </FormControl>
                            <FormDescription className="flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              Vencimento: {format(addDays(watchPaidAt ?? new Date(), watchDeferDays || 30), "dd/MM/yyyy")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  disabled={flexiblePayment.isPending || !watchAmount || watchAmount <= 0 || (watchDeferBalance && !!deferAmountError)}
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
