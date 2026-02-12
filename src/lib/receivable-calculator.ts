import { differenceInDays, startOfDay, parseISO, min, isValid } from "date-fns";

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
 * Parse seguro de data ISO (YYYY-MM-DD ou timestamp)
 * Evita problemas de fuso horário ao criar Date a partir de strings
 */
function parseDate(dateStr: string): Date {
  // Se é formato YYYY-MM-DD, parse manualmente para evitar UTC issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Para outros formatos (ISO com T ou timestamp), usar parseISO
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? parsed : new Date(dateStr);
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
  
  // Parse dates usando função segura (evita problemas UTC)
  const dueDate = startOfDay(parseDate(receivable.dueDate));
  let calcDate = startOfDay(referenceDate);
  
  // Se há freeze, limitar cálculo até a data de freeze
  const isFrozen = !!receivable.accrualFrozenAt;
  if (isFrozen) {
    const frozenDate = startOfDay(parseDate(receivable.accrualFrozenAt!));
    calcDate = min([calcDate, frozenDate]);
  }
  
  // Calcular dias de atraso (calcDate - dueDate)
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
    // Multa: aplicar se em atraso e ainda não aplicada
    // CORREÇÃO: Verificar APENAS penaltyApplied, não existingPenalty
    // O existingPenalty pode ser 0 antes de salvar no banco
    if (!receivable.penaltyApplied) {
      penaltyCurrent = principalBase * (config.latePenaltyPercent / 100);
      penaltyCurrent = Math.round(penaltyCurrent * 100) / 100;
    }
    
    // Juros de mora: diário simples sobre principal em aberto
    // Calcular sempre o total esperado e subtrair o que já está registrado
    const dailyRate = config.lateInterestDailyPercent / 100;
    
    // CORREÇÃO: Calcular juros sobre principalBase (não principalRemaining)
    // para ser consistente com a multa. O principalRemaining considera 
    // pagamentos anteriores, mas juros devem ser calculados sobre o saldo 
    // devedor no momento (antes dos pagamentos deste ciclo)
    const totalInterestExpected = principalRemaining * dailyRate * daysOverdue;
    
    // Novos juros = esperado - já registrado (se houver)
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
 * Prioridade de alocação para postergação
 */
export type DeferPriority = 'principal' | 'interest' | 'penalty';

/**
 * Aloca um valor de postergação nos componentes com prioridade configurável.
 * A prioridade define qual componente é postergado primeiro.
 * 
 * Padrão: 'interest' (juros -> multa -> principal) - comportamento legado
 */
export function allocateDeferToComponents(
  deferAmount: number,
  penaltyRemaining: number,
  interestRemaining: number,
  principalRemaining: number,
  priority: DeferPriority = 'interest'
): {
  carriedInterest: number;
  carriedPenalty: number;
  carriedPrincipal: number;
  totalCarried: number;
  remainingInterest: number;
  remainingPenalty: number;
  remainingPrincipal: number;
  totalRemaining: number;
} {
  let remaining = deferAmount;

  // Build ordered buckets based on priority
  const buckets: { key: 'interest' | 'penalty' | 'principal'; available: number }[] = [];
  
  if (priority === 'principal') {
    buckets.push(
      { key: 'principal', available: principalRemaining },
      { key: 'interest', available: interestRemaining },
      { key: 'penalty', available: penaltyRemaining },
    );
  } else if (priority === 'penalty') {
    buckets.push(
      { key: 'penalty', available: penaltyRemaining },
      { key: 'interest', available: interestRemaining },
      { key: 'principal', available: principalRemaining },
    );
  } else {
    // Default: interest first (legacy)
    buckets.push(
      { key: 'interest', available: interestRemaining },
      { key: 'penalty', available: penaltyRemaining },
      { key: 'principal', available: principalRemaining },
    );
  }

  const carried: Record<string, number> = { interest: 0, penalty: 0, principal: 0 };

  for (const bucket of buckets) {
    const take = Math.min(remaining, bucket.available);
    carried[bucket.key] = take;
    remaining -= take;
  }

  const rInterest = Math.max(0, interestRemaining - carried.interest);
  const rPenalty = Math.max(0, penaltyRemaining - carried.penalty);
  const rPrincipal = Math.max(0, principalRemaining - carried.principal);

  return {
    carriedInterest: Math.round(carried.interest * 100) / 100,
    carriedPenalty: Math.round(carried.penalty * 100) / 100,
    carriedPrincipal: Math.round(carried.principal * 100) / 100,
    totalCarried: Math.round((carried.interest + carried.penalty + carried.principal) * 100) / 100,
    remainingInterest: Math.round(rInterest * 100) / 100,
    remainingPenalty: Math.round(rPenalty * 100) / 100,
    remainingPrincipal: Math.round(rPrincipal * 100) / 100,
    totalRemaining: Math.round((rInterest + rPenalty + rPrincipal) * 100) / 100,
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
