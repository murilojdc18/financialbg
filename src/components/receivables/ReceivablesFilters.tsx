import { useState, useMemo } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DbClient, ReceivableStatus, CashSource } from "@/types/database";

interface ReceivablesFiltersProps {
  clients: DbClient[];
  selectedClientId: string;
  selectedStatus: ReceivableStatus | "all";
  selectedCashSource: CashSource | "all";
  startDate: Date | undefined;
  endDate: Date | undefined;
  onClientChange: (clientId: string) => void;
  onStatusChange: (status: string) => void;
  onCashSourceChange: (cashSource: CashSource | "all") => void;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
}

const cashSourceOptions: { value: CashSource | "all"; label: string }[] = [
  { value: "all", label: "Todos os caixas" },
  { value: "B&G", label: "B&G" },
  { value: "PESSOAL", label: "Pessoal" },
];

export function ReceivablesFilters({
  clients,
  selectedClientId,
  selectedStatus,
  selectedCashSource,
  startDate,
  endDate,
  onClientChange,
  onStatusChange,
  onCashSourceChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
}: ReceivablesFiltersProps) {
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  const hasActiveFilters =
    selectedClientId !== "all" ||
    selectedStatus !== "all" ||
    selectedCashSource !== "all" ||
    startDate !== undefined ||
    endDate !== undefined;

  const selectedClientName = useMemo(() => {
    if (selectedClientId === "all") return "Todos os clientes";
    return clients.find((c) => c.id === selectedClientId)?.name ?? "Todos os clientes";
  }, [selectedClientId, clients]);

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
      {/* Searchable client combobox */}
      <div className="flex-1 min-w-[200px]">
        <Label className="text-sm font-medium">Cliente</Label>
        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={clientPopoverOpen}
              className="w-full justify-between mt-1.5 font-normal"
            >
              <span className="truncate">{selectedClientName}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar por nome ou CPF..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onClientChange("all");
                      setClientPopoverOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedClientId === "all" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Todos os clientes
                  </CommandItem>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`${client.name} ${client.document ?? ""}`}
                      onSelect={() => {
                        onClientChange(client.id);
                        setClientPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedClientId === client.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                        {client.document && (
                          <span className="text-xs text-muted-foreground">{client.document}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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

      <div className="min-w-[140px]">
        <Label htmlFor="cash-source-filter" className="text-sm font-medium">
          Caixa
        </Label>
        <Select value={selectedCashSource} onValueChange={(v) => onCashSourceChange(v as CashSource | "all")}>
          <SelectTrigger id="cash-source-filter" className="mt-1.5">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            {cashSourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
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