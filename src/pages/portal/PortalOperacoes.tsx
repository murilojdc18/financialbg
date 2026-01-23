import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function PortalOperacoes() {
  const { clientId } = useProfile();

  // TODO: Fetch operations for clientId
  const operations: any[] = [];

  if (operations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-32 h-32 mb-6 bg-muted rounded-full flex items-center justify-center">
          <FileText className="w-16 h-16 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Nenhuma operação encontrada</h2>
        <p className="text-muted-foreground">
          Você ainda não possui operações ativas.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas Operações</h1>
        <p className="text-muted-foreground">Visualize suas operações de crédito</p>
      </div>

      <div className="grid gap-4">
        {operations.map((op) => (
          <Card key={op.id}>
            <CardHeader>
              <CardTitle>Operação #{op.id}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Operation details will go here */}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
