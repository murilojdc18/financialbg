import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw } from 'lucide-react';

interface PortalProtectedRouteProps {
  children: React.ReactNode;
  allowUnlinked?: boolean; // Allow access even if client_id is null (for /portal/vincular)
}

export function PortalProtectedRoute({ children, allowUnlinked = false }: PortalProtectedRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, isLoading: profileLoading, isAdmin, isClient, clientId, error } = useProfile();
  const location = useLocation();

  // Show loading while checking auth and profile
  if (authLoading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in -> redirect to portal login
  if (!user) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  // Error loading profile
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Erro ao carregar perfil</h1>
        <p className="text-muted-foreground max-w-md">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
          <Button variant="destructive" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  // ADMIN -> redirect to backoffice
  if (isAdmin) {
    return <Navigate to="/operacoes" replace />;
  }

  // CLIENT without client_id -> redirect to vincular (unless we're already there)
  if (isClient && !clientId && !allowUnlinked) {
    return <Navigate to="/portal/vincular" replace />;
  }

  // CLIENT -> allow access (with or without client_id if allowUnlinked)
  if (isClient) {
    return <>{children}</>;
  }

  // No profile found -> allow access to vincular page for profile creation
  if (!profile && allowUnlinked) {
    return <>{children}</>;
  }

  // No profile and not on vincular -> show error with actions
  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Acesso não configurado</h1>
        <p className="text-muted-foreground max-w-md">
          Seu perfil ainda não foi configurado. Entre em contato com o administrador.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
          <Button variant="destructive" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  // Unknown role -> show error with actions
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive">Acesso negado</h1>
      <p className="text-muted-foreground">Você não tem permissão para acessar o portal.</p>
      <Button variant="destructive" onClick={() => signOut()}>
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}
