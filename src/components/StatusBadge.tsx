import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Clock, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusType = "EM_ABERTO" | "PAGO" | "ATRASADO" | "PARCIAL";

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
  className?: string;
}

function normalizeStatus(status: string): StatusType {
  const normalized = status
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace("EM_ABERTO", "EM_ABERTO")
    .replace("EMABERTO", "EM_ABERTO");

  if (normalized === "PAGO") return "PAGO";
  if (normalized === "ATRASADO") return "ATRASADO";
  if (normalized === "PARCIAL") return "PARCIAL";
  if (normalized === "EM_ABERTO" || normalized === "EMABERTO") return "EM_ABERTO";
  
  // Fallback
  return "EM_ABERTO";
}

const statusStyles: Record<StatusType, {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  EM_ABERTO: {
    label: "Em aberto",
    className: "bg-muted/50 text-muted-foreground border-border hover:bg-muted/50",
    icon: <Clock className="h-3 w-3" />,
  },
  PAGO: {
    label: "Pago",
    className: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 hover:bg-[hsl(var(--success))]/10",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  ATRASADO: {
    label: "Atrasado",
    className: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/10",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  PARCIAL: {
    label: "Parcial",
    className: "bg-warning/10 text-warning border-warning/30 hover:bg-warning/10",
    icon: <CircleDot className="h-3 w-3" />,
  },
};

export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const style = statusStyles[normalizedStatus];

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium gap-1",
        style.className,
        className
      )}
    >
      {showIcon && style.icon}
      {style.label}
    </Badge>
  );
}
