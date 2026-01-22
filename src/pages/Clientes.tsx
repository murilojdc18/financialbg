import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function Clientes() {
  return (
    <PageContainer
      title="Clientes"
      description="Gerencie sua base de clientes, visualize histórico e informações de contato."
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Gestão de Clientes em desenvolvimento
          </h3>
          <p className="text-muted-foreground max-w-md">
            Em breve você poderá cadastrar clientes, visualizar histórico de operações e gerenciar informações de contato.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
