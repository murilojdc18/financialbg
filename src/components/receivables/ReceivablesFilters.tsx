import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DbClient, ReceivableStatus } from "@/types/database";

interface ReceivablesFiltersProps {
  clients: DbClient[];
  selectedClientId: string;
  selectedStatus: ReceivableStatus | "all";
  startDate: Date | undefined;
  endDate: Date | undefined;
  onClientChange: (clientId: string) => void;
  onStatusChange: (status: string) => void;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
}

export function ReceivablesFilters({
  clients,
  selectedClientId,
  selectedStatus,
  startDate,
  endDate,
  onClientChange,
  onStatusChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
}: ReceivablesFiltersProps) {
  const hasActiveFilters =
    selectedClientId !== "all" ||
    selectedStatus !== "all" ||
    startDate !== undefined ||
    endDate !== undefined;

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="client-filter" className="text-sm font-medium">
          Cliente
        </Label>
        <Select value={selectedClientId} onValueChange={onClientChange}>
          <SelectTrigger id="client-filter" className="mt-1.5">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[160px]">
        <Label htmlFor="status-filter" className="text-sm font-medium">
          Status
        </Label>
        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger id="status-filter" className="mt-1.5">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="EM_ABERTO">Em aberto</SelectItem>
            <SelectItem value="PARCIAL">Parcial</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="ATRASADO">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[160px]">
        <Label className="text-sm font-medium">Vencimento de</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal mt-1.5",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartDateChange}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-w-[160px]">
        <Label className="text-sm font-medium">Vencimento até</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal mt-1.5",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndDateChange}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={onClearFilters} className="gap-2">
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
