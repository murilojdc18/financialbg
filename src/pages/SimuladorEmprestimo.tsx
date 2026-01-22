import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoanSimulatorForm } from "@/components/simulator/LoanSimulatorForm";
import { SimulationResultCards } from "@/components/simulator/SimulationResultCards";
import { InstallmentScheduleTable } from "@/components/simulator/InstallmentScheduleTable";
import { LoanInput, LoanResult, calculateLoan } from "@/lib/loan-calculator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, ArrowDown, Save, Loader2, CheckCircle } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useCreateOperationWithReceivables } from "@/hooks/useCreateOperationWithReceivables";
import { format } from "date-fns";

export default function SimuladorEmprestimo() {
  const navigate = useNavigate();
  const [result, setResult] = useState<LoanResult | null>(null);
  const [loanInput, setLoanInput] = useState<LoanInput | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const createOperation = useCreateOperationWithReceivables();

  const handleSimulate = (input: LoanInput) => {
    const loanResult = calculateLoan(input);
    setResult(loanResult);
    setLoanInput(input);
    setSelectedClientId("");
  };

  const handleCreateOperation = async () => {
    if (!result || !loanInput || !selectedClientId) return;

    const startDate = loanInput.startDate || new Date();
    
    // Preparar receivables a partir do cronograma
    const receivables = result.schedule.map((item) => ({
      installment_number: item.number,
      due_date: format(item.dueDate, "yyyy-MM-dd"),
      amount: item.payment,
    }));

    const operationId = await createOperation.mutateAsync({
      client_id: selectedClientId,
      principal: loanInput.principal,
      rate_monthly: loanInput.isAnnualRate 
        ? result.monthlyRate / 100 // Já convertida
        : loanInput.interestRate / 100, // Converter de % para decimal
      term_months: loanInput.termMonths,
      system: loanInput.amortizationType.toUpperCase() as "PRICE" | "SAC",
      start_date: format(startDate, "yyyy-MM-dd"),
      fee_fixed: loanInput.fixedFee || 0,
      fee_insurance: loanInput.insuranceFee || 0,
      receivables,
    });

    // Redirecionar para a página de detalhes
    navigate(`/operacoes/${operationId}`);
  };

  return (
    <PageContainer
      title="Simulador de Empréstimos"
      description="Simule empréstimos informando valores, taxas e prazos para visualizar parcelas e cronograma."
    >
      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        {/* Formulário */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <LoanSimulatorForm onSimulate={handleSimulate} />
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          {result ? (
            <>
              <SimulationResultCards result={result} />
              
              {/* Card para criar operação */}
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-primary" />
                    Criar Operação
                  </CardTitle>
                  <CardDescription>
                    Selecione um cliente para transformar esta simulação em uma operação real
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Select 
                        value={selectedClientId} 
                        onValueChange={setSelectedClientId}
                        disabled={loadingClients}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            loadingClients ? "Carregando clientes..." : "Selecione o cliente"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.length === 0 ? (
                            <SelectItem value="_empty" disabled>
                              Nenhum cliente cadastrado
                            </SelectItem>
                          ) : (
                            clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name} {client.document ? `(${client.document})` : ""}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleCreateOperation}
                      disabled={!selectedClientId || createOperation.isPending}
                      className="gap-2"
                    >
                      {createOperation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Criar Operação
                        </>
                      )}
                    </Button>
                  </div>
                  {clients.length === 0 && !loadingClients && (
                    <p className="text-sm text-muted-foreground">
                      Você precisa{" "}
                      <Button 
                        variant="link" 
                        className="p-0 h-auto" 
                        onClick={() => navigate("/clientes")}
                      >
                        cadastrar um cliente
                      </Button>{" "}
                      antes de criar uma operação.
                    </p>
                  )}
                </CardContent>
              </Card>

              <InstallmentScheduleTable result={result} />
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Calculator className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Preencha os dados e clique em Simular
                </h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  Os resultados aparecerão aqui com o resumo financeiro e cronograma
                  completo de parcelas.
                </p>
                <ArrowDown className="h-6 w-6 text-muted-foreground/50 animate-bounce lg:hidden" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
