import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyClientsStateProps {
  onAddClient: () => void;
  hasSearch: boolean;
}

export function EmptyClientsState({ onAddClient, hasSearch }: EmptyClientsStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Users className="h-8 w-8 text-primary" />
        </div>
        {hasSearch ? (
          <>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum cliente encontrado
            </h3>
            <p className="text-muted-foreground max-w-md">
              Não encontramos clientes com os termos de busca informados.
              Tente buscar por outro nome ou documento.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum cliente cadastrado
            </h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Comece cadastrando seu primeiro cliente para gerenciar operações e
              contas a receber.
            </p>
            <Button onClick={onAddClient}>Cadastrar primeiro cliente</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
