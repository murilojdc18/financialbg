import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, isAdmin, isClient, clientId } = useProfile();
  const location = useLocation();

  // Show loading while checking auth and profile
  if (authLoading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // CLIENT -> redirect to portal
  if (isClient) {
    if (clientId) {
      return <Navigate to="/portal/dashboard" replace />;
    } else {
      return <Navigate to="/portal/vincular" replace />;
    }
  }

  // ADMIN -> allow access to backoffice
  if (isAdmin) {
    return <>{children}</>;
  }

  // No profile or unknown role -> show error
  if (!profile || !profile.role) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Perfil não configurado</h1>
        <p className="text-muted-foreground max-w-md">
          Seu perfil não possui uma role definida. Contate o administrador do sistema.
        </p>
      </div>
    );
  }

  // Unknown role -> show error
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive">Acesso negado</h1>
      <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
    </div>
  );
}
