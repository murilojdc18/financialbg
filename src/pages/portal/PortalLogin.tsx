import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, Info } from "lucide-react";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect based on role when already logged in
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
          console.error('[PortalLogin] Profile fetch error:', error);
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
        console.error('[PortalLogin] Error checking profile:', err);
      }
    };

    checkAndRedirect();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (!email || !password) {
      const msg = "Preencha todos os campos";
      setErrorMessage(msg);
      toast({
        title: "Erro",
        description: msg,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        console.error('[PortalLogin] Sign in error:', signInError);
        const msg = signInError.message === "Invalid login credentials" 
          ? "Email ou senha incorretos" 
          : signInError.message;
        setErrorMessage(msg);
        toast({
          title: "Erro ao entrar",
          description: msg,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Get the user after sign in
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      
      if (!signedInUser) {
        setErrorMessage("Erro ao obter dados do usuário.");
        setIsLoading(false);
        return;
      }

      // Fetch profile
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, client_id')
        .eq('id', signedInUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('[PortalLogin] Profile error:', profileError);
      }

      // If no profile exists, try to create a CLIENT profile
      if (!profile) {
        console.log('[PortalLogin] Creating default CLIENT profile');
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: signedInUser.id,
            role: 'CLIENT',
            client_id: null,
          })
          .select('role, client_id')
          .single();

        if (insertError) {
          console.error('[PortalLogin] Profile insert error:', insertError);
          setErrorMessage('Não foi possível criar seu perfil. Contate o administrador.');
          toast({
            title: "Erro",
            description: "Não foi possível criar seu perfil. Contate o administrador.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        profile = newProfile;
      }

      // Check role and redirect
      if (!profile?.role) {
        setErrorMessage('Seu perfil não tem role definido. Contate o administrador.');
        toast({
          title: "Erro",
          description: "Seu perfil não tem role definido. Contate o administrador.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Role-based redirect
      if (profile.role === 'ADMIN') {
        // Admin using portal login - redirect silently to backoffice
        navigate('/operacoes', { replace: true });
      } else if (profile.role === 'CLIENT') {
        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso.",
        });
        if (profile.client_id) {
          navigate('/portal/dashboard', { replace: true });
        } else {
          navigate('/portal/vincular', { replace: true });
        }
      }
    } catch (err) {
      console.error('[PortalLogin] Unexpected error:', err);
      setErrorMessage("Erro inesperado. Tente novamente.");
      toast({
        title: "Erro",
        description: "Erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Portal do Cliente</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Se for seu primeiro acesso, após entrar você será direcionado para vincular seu cadastro.</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
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
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
