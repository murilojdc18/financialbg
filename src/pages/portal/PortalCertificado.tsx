import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download } from "lucide-react";

export default function PortalCertificado() {
  const { clientId } = useProfile();

  // TODO: Fetch certificate data for clientId

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificado</h1>
        <p className="text-muted-foreground">Acesse seu certificado de participação</p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <Award className="w-10 h-10 text-primary" />
          </div>
          <CardTitle>Certificado de Participação</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Seu certificado estará disponível após a conclusão de uma operação.
          </p>
          <Button disabled className="gap-2">
            <Download className="h-4 w-4" />
            Baixar Certificado
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
