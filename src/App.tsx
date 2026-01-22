import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import SimuladorEmprestimo from "./pages/SimuladorEmprestimo";
import Clientes from "./pages/Clientes";
import Operacoes from "./pages/Operacoes";
import ContasAReceber from "./pages/ContasAReceber";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/simulador-emprestimo" replace />} />
            <Route path="/simulador-emprestimo" element={<SimuladorEmprestimo />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/operacoes" element={<Operacoes />} />
            <Route path="/contas-a-receber" element={<ContasAReceber />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
