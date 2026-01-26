import { differenceInDays, startOfDay, parseISO } from "date-fns";

export interface LateFeeConfig {
  lateGraceDays: number;
  latePenaltyPercent: number;
  /** @deprecated Use lateInterestDailyPercent */
  lateInterestMonthlyPercent?: number;
  lateInterestDailyPercent?: number;
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
 * Interface para calcular encargos considerando valores já registrados no banco
 */
export interface ReceivableWithFees {
  amount: number;
  amountPaid: number;
  penaltyApplied: boolean;
  penaltyAmount: number;
  interestAccrued: number;
  lastInterestCalcAt: string | null;
  dueDate: string;
}

export interface DetailedLateFeeResult {
  daysOverdue: number;
  principalBase: number;
  principalRemaining: number;
  penaltyRemaining: number;
  interestRemaining: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  // Novos encargos a aplicar
  newPenalty: number;
  newInterest: number;
  hasLateFees: boolean;
  // Detalhamento para exibição
  breakdown: {
    principal: number;
    penalty: number;
    interest: number;
    total: number;
  };
}

/**
 * Calcula multa e juros de mora para uma parcela em atraso.
 * Usa juros diário simples (0.5% ao dia por default).
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

  // Multa: aplicada uma única vez (10% por default)
  const penalty = originalAmount * (config.latePenaltyPercent / 100);

  // Juros de mora: diário simples (0.5% ao dia por default)
  // Prioriza taxa diária, se não existir usa taxa mensal convertida
  const dailyRate = config.lateInterestDailyPercent !== undefined
    ? config.lateInterestDailyPercent / 100
    : (config.lateInterestMonthlyPercent ?? 1) / 100 / 30;
  
  const interest = originalAmount * dailyRate * daysOverdue;

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

/**
 * Calcula encargos detalhados considerando valores já registrados no banco.
 * Usado para pagamentos parciais onde multa e juros já podem ter sido aplicados.
 */
export function calculateDetailedLateFees(
  receivable: ReceivableWithFees,
  config: LateFeeConfig,
  paymentDate: Date = new Date()
): DetailedLateFeeResult {
  const principalBase = receivable.amount;
  const amountPaid = receivable.amountPaid || 0;
  const existingPenalty = receivable.penaltyAmount || 0;
  const existingInterest = receivable.interestAccrued || 0;

  const dueDateParsed = parseISO(receivable.dueDate);
  const paymentDay = startOfDay(paymentDate);
  const due = startOfDay(dueDateParsed);

  // Calcula dias de atraso considerando carência
  const daysLate = differenceInDays(paymentDay, due);
  const daysOverdue = Math.max(0, daysLate - config.lateGraceDays);

  // Alocar pagamentos anteriores na ordem: (1) multa -> (2) juros -> (3) principal
  let remainingPaid = amountPaid;
  
  // Multa paga
  const penaltyPaidFromPrevious = Math.min(remainingPaid, existingPenalty);
  remainingPaid -= penaltyPaidFromPrevious;
  
  // Juros pagos
  const interestPaidFromPrevious = Math.min(remainingPaid, existingInterest);
  remainingPaid -= interestPaidFromPrevious;
  
  // Principal pago
  const principalPaidFromPrevious = Math.min(remainingPaid, principalBase);
  
  // Principal em aberto (para cálculo de novos juros)
  const principalRemaining = Math.max(0, principalBase - principalPaidFromPrevious);

  // Calcular novos encargos se há atraso
  let newPenalty = 0;
  let newInterest = 0;

  if (daysOverdue > 0 && principalRemaining > 0) {
    // Multa: aplicar apenas se ainda não foi aplicada
    if (!receivable.penaltyApplied) {
      newPenalty = principalBase * (config.latePenaltyPercent / 100);
      newPenalty = Math.round(newPenalty * 100) / 100;
    }

    // Juros: calcular sobre o principal em aberto
    // Se já temos juros registrados, calcular apenas os novos desde última atualização
    const dailyRate = config.lateInterestDailyPercent !== undefined
      ? config.lateInterestDailyPercent / 100
      : (config.lateInterestMonthlyPercent ?? 1) / 100 / 30;

    // Calcular juros totais até a data de pagamento
    const totalInterestExpected = principalRemaining * dailyRate * daysOverdue;
    
    // Novos juros = total esperado - juros já registrados
    newInterest = Math.max(0, totalInterestExpected - existingInterest);
    newInterest = Math.round(newInterest * 100) / 100;
  }

  // Totais
  const totalPenalty = existingPenalty + newPenalty;
  const totalInterest = existingInterest + newInterest;
  const penaltyRemaining = Math.max(0, totalPenalty - penaltyPaidFromPrevious);
  const interestRemaining = Math.max(0, totalInterest - interestPaidFromPrevious);

  const totalDue = principalBase + totalPenalty + totalInterest;
  const balance = totalDue - amountPaid;

  return {
    daysOverdue,
    principalBase,
    principalRemaining,
    penaltyRemaining,
    interestRemaining,
    totalDue: Math.round(totalDue * 100) / 100,
    totalPaid: amountPaid,
    balance: Math.round(balance * 100) / 100,
    newPenalty,
    newInterest,
    hasLateFees: daysOverdue > 0,
    breakdown: {
      principal: principalRemaining,
      penalty: penaltyRemaining,
      interest: interestRemaining,
      total: Math.round((principalRemaining + penaltyRemaining + interestRemaining) * 100) / 100,
    },
  };
}

/**
 * Aloca um pagamento nos componentes: (1) multa -> (2) juros -> (3) principal
 */
export function allocatePayment(
  paymentAmount: number,
  penaltyRemaining: number,
  interestRemaining: number,
  principalRemaining: number
): {
  allocatedToPenalty: number;
  allocatedToInterest: number;
  allocatedToPrincipal: number;
  remainder: number;
} {
  let remaining = paymentAmount;

  // 1. Aloca para multa
  const allocatedToPenalty = Math.min(remaining, penaltyRemaining);
  remaining -= allocatedToPenalty;

  // 2. Aloca para juros
  const allocatedToInterest = Math.min(remaining, interestRemaining);
  remaining -= allocatedToInterest;

  // 3. Aloca para principal
  const allocatedToPrincipal = Math.min(remaining, principalRemaining);
  remaining -= allocatedToPrincipal;

  return {
    allocatedToPenalty: Math.round(allocatedToPenalty * 100) / 100,
    allocatedToInterest: Math.round(allocatedToInterest * 100) / 100,
    allocatedToPrincipal: Math.round(allocatedToPrincipal * 100) / 100,
    remainder: Math.round(remaining * 100) / 100,
  };
}

/**
 * Determina o novo status de uma receivable após um pagamento
 */
export function determineReceivableStatus(
  principalRemaining: number,
  penaltyRemaining: number,
  interestRemaining: number,
  amountPaid: number,
  isOverdue: boolean
): 'PAGO' | 'PARCIAL' | 'ATRASADO' | 'EM_ABERTO' {
  const totalRemaining = principalRemaining + penaltyRemaining + interestRemaining;
  
  if (totalRemaining <= 0.01) { // tolerância de centavo
    return 'PAGO';
  }
  
  if (amountPaid > 0) {
    return 'PARCIAL';
  }
  
  if (isOverdue) {
    return 'ATRASADO';
  }
  
  return 'EM_ABERTO';
}
