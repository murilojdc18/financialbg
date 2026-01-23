import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

/**
 * Check user role via has_role RPC function
 */
async function getUserRole(userId: string): Promise<'ADMIN' | 'CLIENT' | null> {
  const { data: isAdmin, error: adminError } = await supabase
    .rpc('has_role', { _user_id: userId, _role: 'ADMIN' });

  if (!adminError && isAdmin === true) {
    return 'ADMIN';
  }

  const { data: isClient, error: clientError } = await supabase
    .rpc('has_role', { _user_id: userId, _role: 'CLIENT' });

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

export default function Signup() {
  const { user, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if already logged in
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
        console.error('[Signup] Error checking role:', err);
      }
    };

    checkAndRedirect();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    const validation = signupSchema.safeParse({ email, password, confirmPassword });
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
      const { error } = await signUp(email, password);

      if (error) {
        console.error('[Signup] Error:', error);
        let message = error.message;
        if (error.message.includes('already registered')) {
          message = 'Este e-mail já está cadastrado';
        } else if (error.message.includes('valid email')) {
          message = 'E-mail inválido';
        }
        setErrorMessage(message);
        toast({
          variant: 'destructive',
          title: 'Erro ao criar conta',
          description: message,
        });
        setLoading(false);
        return;
      }

      // Check if we got a session back (email confirmation disabled)
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is logged in immediately, check role and redirect
        const role = await getUserRole(session.user.id);
        const clientId = await getClientId(session.user.id);

        toast({
          title: 'Conta criada!',
          description: 'Sua conta foi criada com sucesso.',
        });

        if (role === 'ADMIN') {
          navigate('/operacoes', { replace: true });
        } else {
          // Default to portal for new users (they'll need role assigned)
          navigate('/portal/vincular', { replace: true });
        }
      } else {
        // Email confirmation required
        setSuccessMessage('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
        toast({
          title: 'Conta criada!',
          description: 'Verifique seu e-mail para confirmar o cadastro.',
        });
        
        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('[Signup] Unexpected error:', err);
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
          <CardTitle className="text-2xl">Criar Conta</CardTitle>
          <CardDescription>Preencha os dados para criar sua conta</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 p-3 text-sm text-primary">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{successMessage}</span>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {loading ? 'Criando...' : 'Criar Conta'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
