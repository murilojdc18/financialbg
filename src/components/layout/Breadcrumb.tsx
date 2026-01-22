import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const routeNames: Record<string, string> = {
  "simulador-emprestimo": "Simulador de Empréstimos",
  "clientes": "Clientes",
  "operacoes": "Operações",
  "contas-a-receber": "Contas a Receber",
};

export function Breadcrumb() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span>Início</span>
      </Link>
      
      {pathSegments.map((segment, index) => {
        const path = `/${pathSegments.slice(0, index + 1).join("/")}`;
        const isLast = index === pathSegments.length - 1;
        const name = routeNames[segment] || segment;

        return (
          <div key={path} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-foreground font-medium">{name}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors">
                {name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
