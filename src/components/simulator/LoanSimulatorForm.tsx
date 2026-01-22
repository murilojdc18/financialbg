import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Calculator, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoanInput } from "@/lib/loan-calculator";

const formSchema = z.object({
  principal: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((val) => {
      const num = parseFloat(val.replace(/\./g, "").replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
  interestRate: z
    .string()
    .min(1, "Taxa obrigatória")
    .refine((val) => {
      const num = parseFloat(val.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Taxa deve ser maior que zero"),
  rateType: z.enum(["monthly", "annual"]),
  termMonths: z
    .string()
    .min(1, "Prazo obrigatório")
    .refine((val) => {
      const num = parseInt(val);
      return !isNaN(num) && num >= 1;
    }, "Prazo mínimo de 1 mês"),
  amortizationType: z.enum(["price", "sac"]),
  startDate: z.date().optional(),
  fixedFee: z.string().optional(),
  insuranceFee: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LoanSimulatorFormProps {
  onSimulate: (input: LoanInput) => void;
}

export function LoanSimulatorForm({ onSimulate }: LoanSimulatorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      principal: "",
      interestRate: "",
      rateType: "monthly",
      termMonths: "",
      amortizationType: "price",
      startDate: undefined,
      fixedFee: "",
      insuranceFee: "",
    },
  });

  const parseNumber = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  const onSubmit = (values: FormValues) => {
    setIsSubmitting(true);

    const input: LoanInput = {
      principal: parseNumber(values.principal),
      interestRate: parseNumber(values.interestRate),
      isAnnualRate: values.rateType === "annual",
      termMonths: parseInt(values.termMonths),
      amortizationType: values.amortizationType,
      startDate: values.startDate,
      fixedFee: parseNumber(values.fixedFee || "0"),
      insuranceFee: parseNumber(values.insuranceFee || "0"),
    };

    // Simular delay para feedback visual
    setTimeout(() => {
      onSimulate(input);
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Dados da Simulação
        </CardTitle>
        <CardDescription>
          Preencha os dados do empréstimo para calcular as parcelas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Valor Principal */}
            <FormField
              control={form.control}
              name="principal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Principal (R$) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        R$
                      </span>
                      <Input
                        {...field}
                        placeholder="10.000,00"
                        className="pl-10"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Taxa de Juros */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Taxa de Juros (%) *
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            Se informar taxa anual, ela será convertida para mensal
                            usando juros compostos: (1 + taxa)^(1/12) - 1
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} placeholder="1,5" className="pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          %
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Taxa</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Prazo e Amortização */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo (meses) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" placeholder="12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amortizationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Sistema de Amortização
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium mb-1">Price:</p>
                          <p className="mb-2">Parcelas fixas. Juros decrescem e amortização cresce.</p>
                          <p className="font-medium mb-1">SAC:</p>
                          <p>Amortização fixa. Parcelas decrescem ao longo do tempo.</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="price">Tabela Price</SelectItem>
                        <SelectItem value="sac">SAC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Data de Início */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Início (opcional)</FormLabel>
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
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className="pointer-events-auto"
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Se não informada, será usada a data atual
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Taxas Adicionais */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Taxas Adicionais (opcional)
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fixedFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tarifa Fixa (R$/mês)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            R$
                          </span>
                          <Input {...field} placeholder="0,00" className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insuranceFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seguro (R$/mês)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            R$
                          </span>
                          <Input {...field} placeholder="0,00" className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Calculando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Simular Empréstimo
                </span>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
