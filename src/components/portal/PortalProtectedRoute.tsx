import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useClientId } from '@/hooks/useClientId';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, Loader2 } from 'lucide-react';

interface PortalProtectedRouteProps {
  children: React.ReactNode;
  allowUnlinked?: boolean;
}

export function PortalProtectedRoute({ children, allowUnlinked = false }: PortalProtectedRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, isClient, isLoading: roleLoading, error: roleError, role } = useUserRole();
  const { clientId, isLoading: clientIdLoading, error: clientIdError } = useClientId();
  const location = useLocation();

  // Show loading while checking auth and role
  if (authLoading || roleLoading || clientIdLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in -> redirect to portal login
  if (!user) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  // Error loading role
  if (roleError || clientIdError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Erro ao carregar perfil</h1>
        <p className="text-muted-foreground max-w-md">{roleError || clientIdError}</p>
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

  // CLIENT without client_id -> redirect to vincular (unless allowUnlinked)
  if (isClient && !clientId && !allowUnlinked) {
    return <Navigate to="/portal/vincular" replace />;
  }

  // CLIENT -> allow access
  if (isClient) {
    return <>{children}</>;
  }

  // No role found -> allow access to vincular page for linking
  if (!role && allowUnlinked) {
    return <>{children}</>;
  }

  // No role and not on vincular -> show error with actions
  if (!role) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Acesso não configurado</h1>
        <p className="text-muted-foreground max-w-md">
          Sua conta não tem uma role definida. Entre em contato com o administrador.
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
