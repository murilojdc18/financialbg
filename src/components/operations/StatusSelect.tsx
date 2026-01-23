import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationStatus } from "@/types/database";
import { useUpdateOperation } from "@/hooks/useOperations";

interface StatusSelectProps {
  operationId: string;
  currentStatus: OperationStatus;
  variant?: "table" | "detail";
}

const statusOptions: { value: OperationStatus; label: string }[] = [
  { value: "ATIVA", label: "Ativa" },
  { value: "QUITADA", label: "Quitada" },
  { value: "CANCELADA", label: "Cancelada" },
];

export function StatusSelect({ operationId, currentStatus, variant = "table" }: StatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateOperation = useUpdateOperation();

  const handleStatusChange = async (newStatus: OperationStatus) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      await updateOperation.mutateAsync({ id: operationId, status: newStatus });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      <Select
        value={currentStatus}
        onValueChange={(value) => handleStatusChange(value as OperationStatus)}
        disabled={isUpdating}
      >
        <SelectTrigger 
          className={variant === "table" ? "w-[130px] h-8" : "w-[160px]"}
        >
          <SelectValue placeholder="Selecionar status" />
        </SelectTrigger>
        <SelectContent className="bg-background">
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isUpdating && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
