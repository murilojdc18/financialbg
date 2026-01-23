import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
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
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[Login] Profile fetch error:', error);
          return;
        }

        if (profile?.role === 'ADMIN') {
          navigate('/operacoes', { replace: true });
        } else if (profile?.role === 'CLIENT') {
          if (profile.client_id) {
            navigate('/portal/dashboard', { replace: true });
          } else {
            navigate('/portal/vincular', { replace: true });
          }
        }
      } catch (err) {
        console.error('[Login] Error checking profile:', err);
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
        console.error('[Login] Sign in error:', signInError);
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

      // Fetch or check profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, client_id')
        .eq('id', signedInUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('[Login] Profile error:', profileError);
        setErrorMessage('Erro ao carregar perfil.');
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Erro ao carregar seu perfil.',
        });
        setLoading(false);
        return;
      }

      // If no profile exists, this is the admin login page - show error
      if (!profile) {
        setErrorMessage('Seu perfil não está configurado. Contate o administrador.');
        toast({
          variant: 'destructive',
          title: 'Perfil não encontrado',
          description: 'Seu perfil não está configurado. Contate o administrador.',
        });
        setLoading(false);
        return;
      }

      // Check role and redirect
      if (!profile.role) {
        setErrorMessage('Seu perfil não tem role definido. Contate o administrador.');
        toast({
          variant: 'destructive',
          title: 'Role não definido',
          description: 'Seu perfil não tem role definido. Contate o administrador.',
        });
        setLoading(false);
        return;
      }

      // Role-based redirect
      if (profile.role === 'ADMIN') {
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso.',
        });
        navigate('/operacoes', { replace: true });
      } else if (profile.role === 'CLIENT') {
        // Client trying to use admin login - redirect to portal
        toast({
          title: 'Redirecionando...',
          description: 'Você será direcionado ao Portal do Cliente.',
        });
        if (profile.client_id) {
          navigate('/portal/dashboard', { replace: true });
        } else {
          navigate('/portal/vincular', { replace: true });
        }
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
          <CardTitle className="text-2xl">Acesso Administrativo</CardTitle>
          <CardDescription>Entre com sua conta de administrador</CardDescription>
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
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
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
