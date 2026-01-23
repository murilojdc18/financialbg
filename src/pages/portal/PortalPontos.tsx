import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown } from "lucide-react";

export default function PortalPontos() {
  const { clientId } = useProfile();

  // TODO: Fetch point balance and ledger for clientId
  const balance = 0;
  const ledger: any[] = [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Pontos</h1>
        <p className="text-muted-foreground">Gerencie seu saldo e histórico de pontos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Star className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{balance.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground mt-1">pontos disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" variant="outline" disabled={balance === 0}>
              Solicitar Venda de Pontos
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Extrato de Pontos</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma movimentação de pontos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ledger.map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {entry.amount > 0 ? (
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">{entry.date}</p>
                    </div>
                  </div>
                  <span className={entry.amount > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
