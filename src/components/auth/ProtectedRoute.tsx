import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useClientId } from '@/hooks/useClientId';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isClient, isLoading: roleLoading, role } = useUserRole();
  const { clientId, isLoading: clientIdLoading } = useClientId();
  const location = useLocation();

  // Show loading while checking auth and role
  if (authLoading || roleLoading || clientIdLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  // No role found -> show error with clear message
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold text-destructive">Perfil não configurado</h1>
      <p className="text-muted-foreground max-w-md">
        Seu perfil não possui uma role definida na tabela user_roles. 
        Contate o administrador do sistema para adicionar sua permissão.
      </p>
      <p className="text-sm text-muted-foreground">
        User ID: <code className="bg-muted px-2 py-1 rounded">{user.id}</code>
      </p>
    </div>
  );
}
