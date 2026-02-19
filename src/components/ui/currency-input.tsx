import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Parse a pt-BR formatted string to a number.
 * "1.234,56" -> 1234.56
 * "10,5" -> 10.5
 * "10.5" -> 10.5 (also accepts dot as decimal)
 */
export function parseBRL(input: string): number {
  if (!input || input.trim() === "") return 0;
  const trimmed = input.trim();

  // If has both dot and comma, treat dot as thousands separator and comma as decimal
  if (trimmed.includes(",") && trimmed.includes(".")) {
    const cleaned = trimmed.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // If only comma, treat as decimal separator
  if (trimmed.includes(",")) {
    const cleaned = trimmed.replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // Only dots or no separator — standard parseFloat
  const num = parseFloat(trimmed);
  return isNaN(num) ? 0 : num;
}

/**
 * Format a number to pt-BR display string (without R$ prefix).
 * 1234.56 -> "1234,56"
 */
export function formatNumberBRL(value: number): string {
  if (value === 0) return "0,00";
  return value.toFixed(2).replace(".", ",");
}

// Characters allowed while typing
const ALLOWED_PATTERN = /^[\d.,\s]*$/;

interface CurrencyInputProps {
  /** Current numeric value from the form */
  value: number;
  /** Called with parsed number on blur */
  onValueChange: (value: number) => void;
  /** Optional className */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Min value for validation display (not enforced during typing) */
  min?: number;
  /** Max value for validation display */
  max?: number;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Show R$ prefix */
  showPrefix?: boolean;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, placeholder = "0,00", disabled, showPrefix = false, ...rest }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      value ? formatNumberBRL(value) : ""
    );
    const [isFocused, setIsFocused] = React.useState(false);

    // Sync from external value changes (e.g. auto-distribute) when not focused
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(value ? formatNumberBRL(value) : "");
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow empty
      if (raw === "") {
        setDisplayValue("");
        return;
      }
      // Only allow digits, comma, dot, spaces
      if (!ALLOWED_PATTERN.test(raw)) return;
      // Prevent multiple commas
      const commaCount = (raw.match(/,/g) || []).length;
      if (commaCount > 1) return;
      setDisplayValue(raw);
    };

    const handleBlur = () => {
      setIsFocused(false);
      const parsed = parseBRL(displayValue);
      onValueChange(parsed);
      // Re-format display
      setDisplayValue(parsed ? formatNumberBRL(parsed) : "");
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Select all on focus for easy overwrite
      e.target.select();
    };

    return (
      <div className="relative">
        {showPrefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            R$
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            showPrefix && "pl-10",
            className,
          )}
          {...rest}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
