import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Link2, AlertCircle, ShieldCheck, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useClaimClient } from '@/hooks/useClaimClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Validação do formulário
const vinculacaoSchema = z.object({
  cpf: z.string()
    .min(11, 'CPF deve ter pelo menos 11 dígitos')
    .max(18, 'CPF inválido')
    .refine((val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 11 || digits.length === 14;
    }, 'CPF ou CNPJ inválido'),
  secondFactor: z.string()
    .min(4, 'Código deve ter pelo menos 4 caracteres')
    .max(20, 'Código muito longo'),
});

type VinculacaoFormValues = z.infer<typeof vinculacaoSchema>;

// Formatar CPF enquanto digita
function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function PortalVincular() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { claimClient, isLoading, reset } = useClaimClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<VinculacaoFormValues>({
    resolver: zodResolver(vinculacaoSchema),
    defaultValues: {
      cpf: '',
      secondFactor: '',
    },
  });

  const handleSubmit = async (values: VinculacaoFormValues) => {
    setErrorMessage(null);
    reset();

    try {
      const result = await claimClient({
        cpf: values.cpf,
        secondFactor: values.secondFactor,
      });

      toast({
        title: 'Vinculação realizada!',
        description: `Bem-vindo, ${result.clientName || 'cliente'}!`,
      });

      // Redirect to dashboard after successful claim
      navigate('/portal/dashboard', { replace: true });
    } catch (error) {
      const message = error instanceof Error 
        ? error.message 
        : 'Não foi possível processar a solicitação. Tente novamente.';
      setErrorMessage(message);
    }
  };

  const handleGoBack = () => {
    // Verifica se existe histórico de navegação
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback para login do portal
      navigate('/portal/login');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vincular sua conta</CardTitle>
          <CardDescription>
            Para acessar o portal, precisamos vincular sua conta ao seu cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="000.000.000-00"
                        autoComplete="off"
                        onChange={(e) => {
                          field.onChange(formatCPF(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondFactor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de verificação</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Últimos 4 dígitos do telefone"
                        autoComplete="off"
                        maxLength={20}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Seus dados são protegidos. Não compartilhe o código de verificação com terceiros.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Vincular conta'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4">
          <Button variant="ghost" size="sm" onClick={handleGoBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-destructive hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
