import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users } from "lucide-react";
import { ClientSummary } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientPaymentsTableProps {
  clientSummaries: ClientSummary[];
  onClientClick: (clientId: string) => void;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ClientPaymentsTable({
  clientSummaries,
  onClientClick,
  isLoading,
}: ClientPaymentsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recebimentos por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (clientSummaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recebimentos por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum pagamento encontrado para os filtros selecionados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Recebimentos por Cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Juros</TableHead>
              <TableHead className="text-right">Multa</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Pagamentos</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientSummaries.map((client) => (
              <TableRow
                key={client.client_id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onClientClick(client.client_id)}
              >
                <TableCell className="font-medium">{client.client_name}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(client.total_principal)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(client.total_interest)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(client.total_penalty)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(client.total_amount)}
                </TableCell>
                <TableCell className="text-center">{client.payment_count}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
