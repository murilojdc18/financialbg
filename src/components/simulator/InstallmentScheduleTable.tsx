import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableIcon } from "lucide-react";
import { LoanResult, formatCurrency, formatDate } from "@/lib/loan-calculator";

interface InstallmentScheduleTableProps {
  result: LoanResult;
}

export function InstallmentScheduleTable({ result }: InstallmentScheduleTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TableIcon className="h-5 w-5 text-primary" />
          Cronograma de Parcelas
        </CardTitle>
        <CardDescription>
          {result.amortizationType === "price"
            ? "Tabela Price - Parcelas fixas com juros decrescentes"
            : "SAC - Amortização constante com parcelas decrescentes"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-16 text-center">Nº</TableHead>
                <TableHead className="w-28">Vencimento</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Juros</TableHead>
                <TableHead className="text-right">Amortização</TableHead>
                <TableHead className="text-right">Parcela</TableHead>
                <TableHead className="text-right">Saldo Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.schedule.map((row) => (
                <TableRow key={row.number}>
                  <TableCell className="text-center font-medium">
                    {row.number}
                  </TableCell>
                  <TableCell>{formatDate(row.dueDate)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(row.openingBalance)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">
                    {formatCurrency(row.interest)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-success">
                    {formatCurrency(row.amortization)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {formatCurrency(row.payment)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(row.closingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
