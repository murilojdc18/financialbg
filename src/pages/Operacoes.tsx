import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Operacoes() {
  return (
    <PageContainer
      title="Operações"
      description="Visualize e gerencie todas as operações de crédito ativas e encerradas."
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Gestão de Operações em desenvolvimento
          </h3>
          <p className="text-muted-foreground max-w-md">
            Em breve você poderá criar operações a partir de simulações, acompanhar status e visualizar detalhes completos.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
