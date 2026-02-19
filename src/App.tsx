import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalProtectedRoute } from "@/components/portal/PortalProtectedRoute";
import SimuladorEmprestimo from "./pages/SimuladorEmprestimo";
import Clientes from "./pages/Clientes";
import Operacoes from "./pages/Operacoes";
import OperacaoDetalhes from "./pages/OperacaoDetalhes";
import OperacaoPrint from "./pages/OperacaoPrint";
import ContasAReceber from "./pages/ContasAReceber";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
// Portal pages
import PortalLogin from "./pages/portal/PortalLogin";
import PortalVincular from "./pages/portal/PortalVincular";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalOperacoes from "./pages/portal/PortalOperacoes";
import PortalOperacaoDetalhes from "./pages/portal/PortalOperacaoDetalhes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/simulador-emprestimo"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SimuladorEmprestimo />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Clientes />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operacoes"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Operacoes />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operacoes/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OperacaoDetalhes />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operacoes/:id/print"
              element={
                <ProtectedRoute>
                  <OperacaoPrint />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-a-receber"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ContasAReceber />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Portal do Cliente routes */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route
              path="/portal/vincular"
              element={
                <PortalProtectedRoute allowUnlinked>
                  <PortalVincular />
                </PortalProtectedRoute>
              }
            />
            <Route
              path="/portal/dashboard"
              element={
                <PortalProtectedRoute>
                  <PortalLayout>
                    <PortalDashboard />
                  </PortalLayout>
                </PortalProtectedRoute>
              }
            />
            <Route
              path="/portal/operacoes"
              element={
                <PortalProtectedRoute>
                  <PortalLayout>
                    <PortalOperacoes />
                  </PortalLayout>
                </PortalProtectedRoute>
              }
            />
            <Route
              path="/portal/operacoes/:id"
              element={
                <PortalProtectedRoute>
                  <PortalLayout>
                    <PortalOperacaoDetalhes />
                  </PortalLayout>
                </PortalProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
