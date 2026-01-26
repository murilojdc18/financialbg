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
  calculateDetailedLateFees, 
  allocatePayment,
  LateFeeConfig,
  DetailedLateFeeResult 
} from "@/lib/late-fee-calculator";
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
  const [feeResult, setFeeResult] = useState<DetailedLateFeeResult | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      paidAt: new Date(),
      paymentMethod: "PIX",
      note: "",
      deferBalance: false,
      deferDays: 30,
    },
  });

  const watchAmount = form.watch("amount");
  const watchPaidAt = form.watch("paidAt");
  const watchDeferBalance = form.watch("deferBalance");
  const watchDeferDays = form.watch("deferDays");

  // Calcular encargos quando o dialog abre ou data muda
  useEffect(() => {
    if (!receivable || !open) return;

    const config: LateFeeConfig = {
      lateGraceDays: receivable.operations.late_grace_days ?? 0,
      latePenaltyPercent: Number(receivable.operations.late_penalty_percent) ?? 10,
      lateInterestDailyPercent: Number(receivable.operations.late_interest_daily_percent) ?? 0.5,
      lateInterestMonthlyPercent: Number(receivable.operations.late_interest_monthly_percent) ?? 1,
    };

    const result = calculateDetailedLateFees(
      {
        amount: receivable.amount,
        amountPaid: receivable.amount_paid ?? 0,
        penaltyApplied: receivable.penalty_applied ?? false,
        penaltyAmount: receivable.penalty_amount ?? 0,
        interestAccrued: receivable.interest_accrued ?? 0,
        lastInterestCalcAt: receivable.last_interest_calc_at,
        dueDate: receivable.due_date,
      },
      config,
      watchPaidAt
    );

    setFeeResult(result);
    
    // Definir valor padrão como saldo total
    if (result.balance > 0) {
      form.setValue("amount", result.breakdown.total);
    }
  }, [receivable, open, watchPaidAt, form]);

  // Calcular prévia da alocação
  const allocationPreview = useMemo(() => {
    if (!feeResult || !watchAmount) return null;
    
    return allocatePayment(
      watchAmount,
      feeResult.breakdown.penalty,
      feeResult.breakdown.interest,
      feeResult.breakdown.principal
    );
  }, [feeResult, watchAmount]);

  // Calcular saldo restante após pagamento
  const balanceAfterPayment = useMemo(() => {
    if (!feeResult || !watchAmount) return feeResult?.breakdown.total ?? 0;
    return Math.max(0, feeResult.breakdown.total - watchAmount);
  }, [feeResult, watchAmount]);

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
      receivable,
    });

    onSuccess?.();
    onOpenChange(false);
    form.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setFeeResult(null);
    }
    onOpenChange(newOpen);
  };

  if (!receivable) return null;

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
              {feeResult && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Principal em aberto:</span>
                    <span>{formatCurrency(feeResult.breakdown.principal)}</span>
                  </div>
                  {feeResult.breakdown.penalty > 0 && (
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
                      <span>{formatCurrency(feeResult.breakdown.penalty)}</span>
                    </div>
                  )}
                  {feeResult.breakdown.interest > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span className="flex items-center gap-1">
                        Juros mora ({feeResult.daysOverdue} dias)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {receivable.operations.late_interest_daily_percent}% ao dia sobre o principal
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <span>{formatCurrency(feeResult.breakdown.interest)}</span>
                    </div>
                  )}
                  {feeResult.totalPaid > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Já pago anteriormente:</span>
                      <span>-{formatCurrency(feeResult.totalPaid)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Saldo devido hoje:</span>
                    <span className={feeResult.hasLateFees ? "text-destructive" : ""}>
                      {formatCurrency(feeResult.breakdown.total)}
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
                    <span className={balanceAfterPayment > 0 ? "text-warning" : "text-primary"}>
                      {formatCurrency(balanceAfterPayment)}
                    </span>
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

              {/* Checkbox postergar saldo */}
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
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Postergar saldo restante para nova parcela
                          </FormLabel>
                          <FormDescription>
                            Cria uma nova parcela com o saldo de {formatCurrency(balanceAfterPayment)}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {watchDeferBalance && (
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
                            Vencimento: {format(addDays(new Date(), watchDeferDays || 30), "dd/MM/yyyy")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                <Button type="submit" disabled={flexiblePayment.isPending}>
                  {flexiblePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Pagamento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
