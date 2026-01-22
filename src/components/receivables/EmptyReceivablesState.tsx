import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";

interface EmptyReceivablesStateProps {
  hasFilters: boolean;
}

export function EmptyReceivablesState({ hasFilters }: EmptyReceivablesStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {hasFilters ? "Nenhuma parcela encontrada" : "Nenhuma parcela cadastrada"}
        </h3>
        <p className="text-muted-foreground max-w-sm">
          {hasFilters
            ? "Tente ajustar os filtros para encontrar as parcelas desejadas."
            : "As parcelas serão exibidas aqui quando operações forem cadastradas."}
        </p>
      </CardContent>
    </Card>
  );
}
