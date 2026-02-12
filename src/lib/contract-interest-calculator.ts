import { calculateLoan } from "@/lib/loan-calculator";

export interface ContractInterestBreakdown {
  contractInterest: number;
  amortization: number;
  installmentTotal: number;
}

/**
 * Calcula os juros contratuais e amortização para uma parcela específica
 * a partir do cronograma Price/SAC da operação.
 * 
 * @param operation Dados da operação (principal, taxa, prazo, sistema, data início, taxas)
 * @param installmentNumber Número da parcela (1-indexed)
 * @returns Breakdown de juros contratuais e amortização, ou fallback se não encontrar
 */
export function getContractInterestForInstallment(
  operation: {
    principal: number;
    rate_monthly: number;
    term_months: number;
    system: string;
    start_date: string;
    fee_fixed?: number | null;
    fee_insurance?: number | null;
  },
  installmentNumber: number
): ContractInterestBreakdown {
  try {
    const loanResult = calculateLoan({
      principal: Number(operation.principal),
      interestRate: Number(operation.rate_monthly) * 100, // decimal -> percentage
      isAnnualRate: false,
      termMonths: operation.term_months,
      amortizationType: operation.system.toLowerCase() as "price" | "sac",
      startDate: new Date(operation.start_date),
      fixedFee: Number(operation.fee_fixed ?? 0),
      insuranceFee: Number(operation.fee_insurance ?? 0),
    });

    const row = loanResult.schedule.find(r => r.number === installmentNumber);
    if (!row) {
      // Fallback for renegotiated/extra installments not in the original schedule
      return { contractInterest: 0, amortization: 0, installmentTotal: 0 };
    }

    return {
      contractInterest: Math.round(row.interest * 100) / 100,
      amortization: Math.round(row.amortization * 100) / 100,
      installmentTotal: Math.round(row.payment * 100) / 100,
    };
  } catch {
    // Fallback on any calculation error
    return { contractInterest: 0, amortization: 0, installmentTotal: 0 };
  }
}

/**
 * Dado o "principal remaining" do receivable-calculator (que inclui juros contratuais + amortização),
 * separa em juros contratuais e amortização proporcionalmente ao cronograma.
 * 
 * Se a parcela não está no cronograma, tudo é tratado como amortização (fallback).
 */
export function splitPrincipalIntoComponents(
  principalRemaining: number,
  scheduleBreakdown: ContractInterestBreakdown
): { contractInterestRemaining: number; amortizationRemaining: number } {
  const { contractInterest, amortization } = scheduleBreakdown;
  const total = contractInterest + amortization;

  if (total <= 0 || contractInterest <= 0) {
    // No schedule data or no contract interest — everything is amortization
    return {
      contractInterestRemaining: 0,
      amortizationRemaining: principalRemaining,
    };
  }

  const ratio = contractInterest / total;
  const contractInterestRemaining = Math.round(principalRemaining * ratio * 100) / 100;
  const amortizationRemaining = Math.round((principalRemaining - contractInterestRemaining) * 100) / 100;

  return { contractInterestRemaining, amortizationRemaining };
}
