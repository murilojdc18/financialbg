import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Star, Award, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

interface PortalLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { title: "Dashboard", url: "/portal/dashboard", icon: LayoutDashboard },
  { title: "Operações", url: "/portal/operacoes", icon: FileText },
  { title: "Pontos", url: "/portal/pontos", icon: Star },
  { title: "Certificado", url: "/portal/certificado", icon: Award },
];

function NavItem({ item, isActive, onClick }: { 
  item: typeof menuItems[0]; 
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.url}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className="h-5 w-5" />
      <span className="font-medium">{item.title}</span>
    </Link>
  );
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      <nav className="flex-1 py-4 space-y-1">
        {menuItems.map((item) => (
          <NavItem 
            key={item.url} 
            item={item} 
            isActive={isActive(item.url)}
            onClick={onItemClick}
          />
        ))}
      </nav>
      <div className="py-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b bg-card flex items-center px-4 lg:px-6">
        {/* Mobile menu trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="mr-3">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-primary">Portal do Cliente</h2>
            </div>
            <NavContent onItemClick={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <h1 className="text-xl font-bold text-primary">Portal do Cliente</h1>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 border-r bg-card flex-col px-3">
          <NavContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
