import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

/**
 * Check user role via has_role RPC function
 */
async function getUserRole(userId: string): Promise<'ADMIN' | 'CLIENT' | null> {
  // Check admin first (lowercase for enum)
  const { data: isAdmin, error: adminError } = await supabase
    .rpc('has_role', { _user_id: userId, _role: 'admin' });

  if (!adminError && isAdmin === true) {
    return 'ADMIN';
  }

  // Check client (lowercase for enum)
  const { data: isClient, error: clientError } = await supabase
    .rpc('has_role', { _user_id: userId, _role: 'client' });

  if (!clientError && isClient === true) {
    return 'CLIENT';
  }

  return null;
}

/**
 * Get client_id from profiles table
 */
async function getClientId(userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', userId)
    .maybeSingle();

  return profile?.client_id ?? null;
}

export default function Login() {
  const { user, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if already logged in and redirect based on role
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!user) return;

      try {
        const role = await getUserRole(user.id);
        const clientId = await getClientId(user.id);

        if (role === 'ADMIN') {
          navigate('/operacoes', { replace: true });
        } else if (role === 'CLIENT') {
          if (clientId) {
            navigate('/portal/dashboard', { replace: true });
          } else {
            navigate('/portal/vincular', { replace: true });
          }
        }
      } catch (err) {
        console.error('[Login] Error checking role:', err);
      }
    };

    checkAndRedirect();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const msg = validation.error.errors[0].message;
      setErrorMessage(msg);
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: msg,
      });
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        console.error('[Login] Sign in error:', signInError.message);
        const msg = signInError.message === 'Invalid login credentials' 
          ? 'E-mail ou senha incorretos' 
          : signInError.message;
        setErrorMessage(msg);
        toast({
          variant: 'destructive',
          title: 'Erro ao entrar',
          description: msg,
        });
        setLoading(false);
        return;
      }

      // Get the user after sign in
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      
      if (!signedInUser) {
        setErrorMessage('Erro ao obter dados do usuário.');
        setLoading(false);
        return;
      }

      // Check role via user_roles
      const role = await getUserRole(signedInUser.id);
      const clientId = await getClientId(signedInUser.id);

      // Role-based redirect
      if (role === 'ADMIN') {
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso.',
        });
        navigate('/operacoes', { replace: true });
      } else if (role === 'CLIENT') {
        toast({
          title: 'Redirecionando...',
          description: 'Você será direcionado ao Portal do Cliente.',
        });
        if (clientId) {
          navigate('/portal/dashboard', { replace: true });
        } else {
          navigate('/portal/vincular', { replace: true });
        }
      } else {
        // No role found
        setErrorMessage('Seu perfil não tem role definido. Contate o administrador para adicionar sua permissão na tabela user_roles.');
        toast({
          variant: 'destructive',
          title: 'Role não definido',
          description: 'Contate o administrador para configurar sua permissão.',
        });
      }
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      setErrorMessage('Erro inesperado. Tente novamente.');
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro inesperado. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Acesso ao Sistema</CardTitle>
          <CardDescription>Entre com suas credenciais</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                data-testid="login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                data-testid="login-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Não tem conta?{' '}
              <Link to="/signup" className="text-primary hover:underline">
                Criar conta
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
