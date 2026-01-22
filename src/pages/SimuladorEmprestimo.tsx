import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoanSimulatorForm } from "@/components/simulator/LoanSimulatorForm";
import { SimulationResultCards } from "@/components/simulator/SimulationResultCards";
import { InstallmentScheduleTable } from "@/components/simulator/InstallmentScheduleTable";
import { LoanInput, LoanResult, calculateLoan } from "@/lib/loan-calculator";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, ArrowDown } from "lucide-react";

export default function SimuladorEmprestimo() {
  const [result, setResult] = useState<LoanResult | null>(null);

  const handleSimulate = (input: LoanInput) => {
    const loanResult = calculateLoan(input);
    setResult(loanResult);
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
