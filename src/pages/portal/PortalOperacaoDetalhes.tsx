import { useParams } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function PortalOperacaoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const { clientId } = useProfile();

  // TODO: Fetch operation details for id + verify belongs to clientId

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Detalhes da Operação</h1>
        <p className="text-muted-foreground">ID: {id}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Carregando...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Carregando...</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Nenhuma parcela encontrada</p>
        </CardContent>
      </Card>
    </div>
  );
}
