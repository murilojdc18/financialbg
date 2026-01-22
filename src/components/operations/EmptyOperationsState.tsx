import { FileText, SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyOperationsStateProps {
  isFiltered?: boolean;
}

export function EmptyOperationsState({ isFiltered = false }: EmptyOperationsStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          {isFiltered ? (
            <SearchX className="h-8 w-8 text-primary" />
          ) : (
            <FileText className="h-8 w-8 text-primary" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isFiltered
            ? "Nenhuma operação encontrada"
            : "Nenhuma operação cadastrada"}
        </h3>
        <p className="text-muted-foreground max-w-md">
          {isFiltered
            ? "Tente ajustar os filtros para encontrar as operações desejadas."
            : "As operações aparecerão aqui quando forem criadas a partir de simulações."}
        </p>
      </CardContent>
    </Card>
  );
}
