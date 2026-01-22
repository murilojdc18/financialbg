import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export default function ContasAReceber() {
  return (
    <PageContainer
      title="Contas a Receber"
      description="Acompanhe parcelas, duplicatas, vencimentos e registre pagamentos."
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Receipt className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Contas a Receber em desenvolvimento
          </h3>
          <p className="text-muted-foreground max-w-md">
            Em breve você poderá visualizar parcelas pendentes, atrasadas e pagas, além de registrar baixas e pagamentos.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
