import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

interface PortalProtectedRouteProps {
  children: React.ReactNode;
}

export function PortalProtectedRoute({ children }: PortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, isAdmin, isClient } = useProfile();
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

  // No profile found -> show error or redirect
  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Acesso não configurado</h1>
        <p className="text-muted-foreground max-w-md">
          Seu perfil ainda não foi configurado. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  // ADMIN -> redirect to backoffice
  if (isAdmin) {
    return <Navigate to="/operacoes" replace />;
  }

  // CLIENT -> allow access
  if (isClient) {
    return <>{children}</>;
  }

  // Unknown role -> show error
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive">Acesso negado</h1>
      <p className="text-muted-foreground">Você não tem permissão para acessar o portal.</p>
    </div>
  );
}
