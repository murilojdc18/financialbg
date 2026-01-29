import { differenceInDays, startOfDay, parseISO, min } from "date-fns";

/**
 * Configuração de encargos por atraso
 */
export interface LateFeeConfig {
  lateGraceDays: number;
  latePenaltyPercent: number;
  lateInterestDailyPercent: number;
}

/**
 * Dados da receivable para cálculo
 */
export interface ReceivableForCalc {
  amount: number;
  amountPaid: number;
  penaltyApplied: boolean;
  penaltyAmount: number;
  interestAccrued: number;
  carriedPenaltyAmount: number;
  carriedInterestAmount: number;
  accrualFrozenAt: string | null;
  dueDate: string;
}

/**
 * Resultado detalhado do cálculo de encargos
 */
export interface ReceivableDueResult {
  // Base
  principalBase: number;
  principalRemaining: number;
  
  // Encargos trazidos de renegociação
  carriedPenalty: number;
  carriedInterest: number;
  
  // Encargos atuais (calculados)
  penaltyCurrent: number;
  interestCurrent: number;
  
  // Totais
  totalPenalty: number;
  totalInterest: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  
  // Metadados
  daysOverdue: number;
  isOverdue: boolean;
  isFrozen: boolean;
  
  // Breakdown para alocação
  breakdown: {
    principal: number;
    penalty: number;
    interest: number;
    total: number;
  };
}

/**
 * Calcula o total devido de uma receivable em uma data de referência.
 * Considera encargos carregados de renegociação e congelamento.
 * 
 * - Multa (penalty): 10% única, aplicada somente sobre o principal_base
 * - Mora (interest): 0.5% ao dia, sobre o principal em aberto
 * - Encargos carregados (carried_*) são adicionados ao total
 */
export function calculateReceivableDue(
  receivable: ReceivableForCalc,
  config: LateFeeConfig,
  referenceDate: Date = new Date()
): ReceivableDueResult {
  const principalBase = receivable.amount;
  const amountPaid = receivable.amountPaid || 0;
  const carriedPenalty = receivable.carriedPenaltyAmount || 0;
  const carriedInterest = receivable.carriedInterestAmount || 0;
  
  // Parse dates
  const dueDate = startOfDay(parseISO(receivable.dueDate));
  let calcDate = startOfDay(referenceDate);
  
  // Se há freeze, limitar cálculo até a data de freeze
  const isFrozen = !!receivable.accrualFrozenAt;
  if (isFrozen) {
    const frozenDate = startOfDay(parseISO(receivable.accrualFrozenAt!));
    calcDate = min([calcDate, frozenDate]);
  }
  
  // Calcular dias de atraso
  const daysLate = differenceInDays(calcDate, dueDate);
  const daysOverdue = Math.max(0, daysLate - config.lateGraceDays);
  const isOverdue = daysOverdue > 0;
  
  // Alocar pagamentos anteriores: penalty -> interest -> principal
  let remainingPaid = amountPaid;
  
  // Já temos multa/juros registrados no receivable
  const existingPenalty = receivable.penaltyAmount || 0;
  const existingInterest = receivable.interestAccrued || 0;
  
  // Total de encargos existentes (registered + carried)
  const totalExistingPenalty = existingPenalty + carriedPenalty;
  const totalExistingInterest = existingInterest + carriedInterest;
  
  // Alocar pagamentos anteriores
  const penaltyPaid = Math.min(remainingPaid, totalExistingPenalty);
  remainingPaid -= penaltyPaid;
  
  const interestPaid = Math.min(remainingPaid, totalExistingInterest);
  remainingPaid -= interestPaid;
  
  const principalPaid = Math.min(remainingPaid, principalBase);
  
  // Principal em aberto
  const principalRemaining = Math.max(0, principalBase - principalPaid);
  
  // Calcular novos encargos
  let penaltyCurrent = 0;
  let interestCurrent = 0;
  
  if (isOverdue && principalRemaining > 0) {
    // Multa: aplicar SOMENTE se ainda não foi aplicada
    // Base da multa: somente principal_base (não carried_*)
    if (!receivable.penaltyApplied && existingPenalty === 0) {
      penaltyCurrent = principalBase * (config.latePenaltyPercent / 100);
      penaltyCurrent = Math.round(penaltyCurrent * 100) / 100;
    }
    
    // Juros de mora: diário simples sobre principal em aberto
    // Não cobrar juros sobre carried_*
    const dailyRate = config.lateInterestDailyPercent / 100;
    const totalInterestExpected = principalRemaining * dailyRate * daysOverdue;
    
    // Novos juros = esperado - já registrado
    interestCurrent = Math.max(0, totalInterestExpected - existingInterest);
    interestCurrent = Math.round(interestCurrent * 100) / 100;
  }
  
  // Totais
  const totalPenalty = totalExistingPenalty + penaltyCurrent;
  const totalInterest = totalExistingInterest + interestCurrent;
  
  // Saldos restantes (após considerar pagamentos)
  const penaltyRemaining = Math.max(0, totalPenalty - penaltyPaid);
  const interestRemaining = Math.max(0, totalInterest - interestPaid);
  
  const totalDue = principalBase + totalPenalty + totalInterest;
  const balance = principalRemaining + penaltyRemaining + interestRemaining;
  
  return {
    principalBase,
    principalRemaining,
    carriedPenalty,
    carriedInterest,
    penaltyCurrent,
    interestCurrent,
    totalPenalty,
    totalInterest,
    totalDue: Math.round(totalDue * 100) / 100,
    totalPaid: amountPaid,
    balance: Math.round(balance * 100) / 100,
    daysOverdue,
    isOverdue,
    isFrozen,
    breakdown: {
      principal: Math.round(principalRemaining * 100) / 100,
      penalty: Math.round(penaltyRemaining * 100) / 100,
      interest: Math.round(interestRemaining * 100) / 100,
      total: Math.round(balance * 100) / 100,
    },
  };
}

/**
 * Aloca um pagamento nos componentes: (1) multa -> (2) juros -> (3) principal
 */
export function allocatePaymentToComponents(
  paymentAmount: number,
  penaltyRemaining: number,
  interestRemaining: number,
  principalRemaining: number
): {
  allocatedToPenalty: number;
  allocatedToInterest: number;
  allocatedToPrincipal: number;
  remainder: number;
  newPenaltyRemaining: number;
  newInterestRemaining: number;
  newPrincipalRemaining: number;
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
    newPenaltyRemaining: Math.round((penaltyRemaining - allocatedToPenalty) * 100) / 100,
    newInterestRemaining: Math.round((interestRemaining - allocatedToInterest) * 100) / 100,
    newPrincipalRemaining: Math.round((principalRemaining - allocatedToPrincipal) * 100) / 100,
  };
}

/**
 * Determina o status de uma receivable após um pagamento
 */
export function determineStatus(
  principalRemaining: number,
  penaltyRemaining: number,
  interestRemaining: number,
  amountPaid: number,
  isOverdue: boolean
): 'PAGO' | 'PARCIAL' | 'ATRASADO' | 'EM_ABERTO' {
  const totalRemaining = principalRemaining + penaltyRemaining + interestRemaining;
  
  if (totalRemaining <= 0.01) {
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
