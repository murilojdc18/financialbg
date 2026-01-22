import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator } from "lucide-react";

export default function SimuladorEmprestimo() {
  return (
    <PageContainer
      title="Simulador de Empréstimos"
      description="Simule empréstimos informando valores, taxas e prazos para visualizar parcelas e cronograma."
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Simulador em desenvolvimento
          </h3>
          <p className="text-muted-foreground max-w-md">
            Em breve você poderá simular empréstimos com cálculo automático de parcelas, juros e visualização do cronograma completo.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
