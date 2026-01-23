import { useState, useRef } from "react";
import { useClientCertificates, useUploadCertificate, useDownloadCertificate } from "@/hooks/useCertificates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Award, 
  Upload, 
  Loader2, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  Download,
  AlertCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'APROVADO':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
          Aprovado
        </Badge>
      );
    case 'REJEITADO':
      return (
        <Badge variant="destructive" className="gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          Rejeitado
        </Badge>
      );
    case 'PENDENTE':
    default:
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Pendente
        </Badge>
      );
  }
}

export default function PortalCertificado() {
  const { data: certificates, isLoading, error } = useClientCertificates();
  const uploadMutation = useUploadCertificate();
  const downloadMutation = useDownloadCertificate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Tipo de arquivo inválido",
          description: "Envie um arquivo PDF, JPG, PNG ou WebP.",
        });
        return;
      }
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB.",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadMutation.mutateAsync(selectedFile);
      toast({
        title: "Certificado enviado!",
        description: "Seu certificado foi enviado e está aguardando aprovação.",
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar",
        description: err.message || "Não foi possível enviar o certificado.",
      });
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const blob = await downloadMutation.mutateAsync(filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao baixar",
        description: err.message || "Não foi possível baixar o arquivo.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <p className="text-destructive">Erro ao carregar certificados</p>
      </div>
    );
  }

  const latestCertificate = certificates?.[0];
  const hasPendingOrApproved = latestCertificate && 
    (latestCertificate.status === 'PENDENTE' || latestCertificate.status === 'APROVADO');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificado</h1>
        <p className="text-muted-foreground">Envie e acompanhe seu certificado de participação</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <Award className="w-10 h-10 text-primary" />
          </div>
          <CardTitle>Status do Certificado</CardTitle>
          <CardDescription>
            {!latestCertificate 
              ? "Você ainda não enviou nenhum certificado"
              : "Acompanhe o status do seu envio mais recente"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {latestCertificate ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                {getStatusBadge(latestCertificate.status)}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Arquivo: <span className="font-medium text-foreground">{latestCertificate.file_name}</span></p>
                <p>Enviado em: {formatDate(latestCertificate.created_at)}</p>
              </div>
              {latestCertificate.notes && (
                <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">Observação:</p>
                  <p className="text-muted-foreground">{latestCertificate.notes}</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleDownload(latestCertificate.file_path, latestCertificate.file_name)}
                disabled={downloadMutation.isPending}
              >
                {downloadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Baixar arquivo
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum certificado enviado ainda.</p>
          )}
        </CardContent>
      </Card>

      {/* Upload Card */}
      {!hasPendingOrApproved && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Enviar Certificado
            </CardTitle>
            <CardDescription>
              Envie um arquivo PDF ou imagem (JPG, PNG, WebP) com até 10MB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Arquivo</Label>
              <Input
                id="certificate-file"
                type="file"
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={uploadMutation.isPending}
              />
            </div>

            {selectedFile && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Enviar Certificado
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {certificates && certificates.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {certificates.slice(1).map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{cert.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(cert.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(cert.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(cert.file_path, cert.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
