import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertCircle, Percent, Gift } from "lucide-react";
import { DashboardSummary } from "@/hooks/useDashboardData";

interface DashboardCardsProps {
  summary: DashboardSummary;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function DashboardCards({ summary, isLoading }: DashboardCardsProps) {
  const cards = [
    {
      title: "Total Recebido",
      value: summary.total_received,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Principal Recebido",
      value: summary.total_principal,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Juros Recebidos",
      value: summary.total_interest,
      icon: Percent,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Multa Recebida",
      value: summary.total_penalty,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Abatimentos",
      value: summary.total_discounts,
      icon: Gift,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      subtitle: `P: ${formatCurrency(summary.total_discount_principal)} | J: ${formatCurrency(summary.total_discount_interest)} | M: ${formatCurrency(summary.total_discount_penalty)}`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(card.value)}</div>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
