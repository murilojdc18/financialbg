import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Star, Clock, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function PortalDashboard() {
  const { profile } = useProfile();

  // TODO: Fetch real data based on profile.client_id
  const hasOperations = false; // Placeholder - will be connected to real data

  if (!hasOperations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-full max-w-md">
          <div className="mb-6">
            {/* Placeholder map/illustration */}
            <div className="w-32 h-32 mx-auto bg-muted rounded-full flex items-center justify-center">
              <FileText className="w-16 h-16 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Portal</h2>
          <p className="text-muted-foreground mb-6">
            Você ainda não possui operações ativas. Quando houver, elas aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas operações</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Operações Ativas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parcelas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parcelas Pagas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo de Pontos</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Nenhuma parcela pendente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link 
              to="/portal/operacoes" 
              className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              Ver minhas operações
            </Link>
            <Link 
              to="/portal/pontos" 
              className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              Consultar pontos
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
