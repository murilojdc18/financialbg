import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, X } from "lucide-react";
import {
  DashboardFilters as FiltersType,
  useClientsForFilter,
  useOperationsForFilter,
} from "@/hooks/useDashboardData";

interface DashboardFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
}

const OPERATION_STATUSES = [
  { value: "ATIVA", label: "Ativa" },
  { value: "QUITADA", label: "Quitada" },
  { value: "CANCELADA", label: "Cancelada" },
];

const CASH_SOURCES = [
  { value: "B&G", label: "B&G" },
  { value: "PESSOAL", label: "Pessoal" },
];

export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data: clients } = useClientsForFilter();
  const { data: operations } = useOperationsForFilter(filters.clientId);

  const hasActiveFilters =
    filters.startDate ||
    filters.endDate ||
    filters.clientId ||
    filters.operationId ||
    filters.operationStatus ||
    filters.cashSource;

  const clearFilters = () => {
    onFiltersChange({
      startDate: null,
      endDate: null,
      clientId: null,
      operationId: null,
      operationStatus: null,
      cashSource: null,
    });
  };

  const updateFilter = <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => {
    const newFilters = { ...filters, [key]: value };
    // Clear operation when client changes
    if (key === "clientId") {
      newFilters.operationId = null;
    }
    onFiltersChange(newFilters);
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Filtros</span>
            {hasActiveFilters && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Ativos
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Recolher" : "Expandir"}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {/* Data Inicial */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => updateFilter("startDate", e.target.value || null)}
              />
            </div>

            {/* Data Final */}
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => updateFilter("endDate", e.target.value || null)}
              />
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={filters.clientId || "all"}
                onValueChange={(v) => updateFilter("clientId", v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Operação */}
            <div className="space-y-2">
              <Label>Operação</Label>
              <Select
                value={filters.operationId || "all"}
                onValueChange={(v) => updateFilter("operationId", v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as operações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as operações</SelectItem>
                  {operations?.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status da Operação */}
            <div className="space-y-2">
              <Label>Status Operação</Label>
              <Select
                value={filters.operationStatus || "all"}
                onValueChange={(v) =>
                  updateFilter("operationStatus", v === "all" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {OPERATION_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Caixa */}
            <div className="space-y-2">
              <Label>Caixa</Label>
              <Select
                value={filters.cashSource || "all"}
                onValueChange={(v) => updateFilter("cashSource", v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os caixas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os caixas</SelectItem>
                  {CASH_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
