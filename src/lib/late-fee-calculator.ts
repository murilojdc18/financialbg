import { differenceInDays, startOfDay, parseISO } from "date-fns";

export interface LateFeeConfig {
  lateGraceDays: number;
  latePenaltyPercent: number;
  lateInterestMonthlyPercent: number;
}

export interface LateFeeResult {
  daysOverdue: number;
  originalAmount: number;
  penalty: number;
  interest: number;
  updatedAmount: number;
  hasLateFees: boolean;
}

/**
 * Calcula multa e juros de mora para uma parcela em atraso.
 * 
 * @param dueDate - Data de vencimento da parcela (string ISO ou Date)
 * @param originalAmount - Valor original da parcela
 * @param config - Configuração de multa/juros da operação
 * @param referenceDate - Data de referência para cálculo (default: hoje)
 * @returns Objeto com detalhes do cálculo
 */
export function calculateLateFees(
  dueDate: string | Date,
  originalAmount: number,
  config: LateFeeConfig,
  referenceDate: Date = new Date()
): LateFeeResult {
  const dueDateParsed = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  const today = startOfDay(referenceDate);
  const due = startOfDay(dueDateParsed);

  // Calcula dias de atraso considerando carência
  const daysLate = differenceInDays(today, due);
  const daysOverdue = Math.max(0, daysLate - config.lateGraceDays);

  if (daysOverdue === 0) {
    return {
      daysOverdue: 0,
      originalAmount,
      penalty: 0,
      interest: 0,
      updatedAmount: originalAmount,
      hasLateFees: false,
    };
  }

  // Multa: aplicada uma única vez
  const penalty = originalAmount * (config.latePenaltyPercent / 100);

  // Juros de mora: pro-rata diário
  const dailyInterestRate = (config.lateInterestMonthlyPercent / 100) / 30;
  const interest = originalAmount * dailyInterestRate * daysOverdue;

  // Valor atualizado
  const updatedAmount = originalAmount + penalty + interest;

  return {
    daysOverdue,
    originalAmount,
    penalty: Math.round(penalty * 100) / 100,
    interest: Math.round(interest * 100) / 100,
    updatedAmount: Math.round(updatedAmount * 100) / 100,
    hasLateFees: true,
  };
}
