export interface LoanInput {
  principal: number;
  interestRate: number;
  isAnnualRate: boolean;
  termMonths: number;
  amortizationType: "price" | "sac";
  startDate?: Date;
  fixedFee?: number;
  insuranceFee?: number;
}

export interface InstallmentRow {
  number: number;
  dueDate: Date;
  openingBalance: number;
  interest: number;
  amortization: number;
  payment: number;
  closingBalance: number;
}

export interface LoanResult {
  principal: number;
  monthlyRate: number;
  annualRate: number;
  termMonths: number;
  amortizationType: "price" | "sac";
  firstInstallment: number;
  averageInstallment: number;
  totalPaid: number;
  totalInterest: number;
  totalFees: number;
  schedule: InstallmentRow[];
}

/**
 * Converte taxa anual para mensal usando juros compostos
 * Formula: (1 + anual)^(1/12) - 1
 */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

/**
 * Converte taxa mensal para anual usando juros compostos
 * Formula: (1 + mensal)^12 - 1
 */
export function monthlyToAnnualRate(monthlyRate: number): number {
  return (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100;
}

/**
 * Calcula cronograma usando Tabela Price (parcelas fixas)
 */
function calculatePriceSchedule(
  principal: number,
  monthlyRate: number,
  termMonths: number,
  startDate: Date,
  fixedFee: number,
  insuranceFee: number
): InstallmentRow[] {
  const rate = monthlyRate / 100;
  const totalFees = fixedFee + insuranceFee;
  
  // Fórmula Price: PMT = PV * [i * (1+i)^n] / [(1+i)^n - 1]
  const pmt =
    principal * ((rate * Math.pow(1 + rate, termMonths)) / (Math.pow(1 + rate, termMonths) - 1));

  const schedule: InstallmentRow[] = [];
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const interest = balance * rate;
    const amortization = pmt - interest;
    const closingBalance = Math.max(0, balance - amortization);
    const payment = pmt + totalFees;

    schedule.push({
      number: i,
      dueDate,
      openingBalance: balance,
      interest,
      amortization,
      payment,
      closingBalance,
    });

    balance = closingBalance;
  }

  return schedule;
}

/**
 * Calcula cronograma usando SAC (amortização constante)
 */
function calculateSacSchedule(
  principal: number,
  monthlyRate: number,
  termMonths: number,
  startDate: Date,
  fixedFee: number,
  insuranceFee: number
): InstallmentRow[] {
  const rate = monthlyRate / 100;
  const totalFees = fixedFee + insuranceFee;
  const fixedAmortization = principal / termMonths;

  const schedule: InstallmentRow[] = [];
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const interest = balance * rate;
    const amortization = fixedAmortization;
    const closingBalance = Math.max(0, balance - amortization);
    const payment = amortization + interest + totalFees;

    schedule.push({
      number: i,
      dueDate,
      openingBalance: balance,
      interest,
      amortization,
      payment,
      closingBalance,
    });

    balance = closingBalance;
  }

  return schedule;
}

/**
 * Calcula simulação completa do empréstimo
 */
export function calculateLoan(input: LoanInput): LoanResult {
  // Converter taxa para mensal se necessário
  let monthlyRate: number;
  let annualRate: number;

  if (input.isAnnualRate) {
    annualRate = input.interestRate;
    monthlyRate = annualToMonthlyRate(input.interestRate) * 100;
  } else {
    monthlyRate = input.interestRate;
    annualRate = monthlyToAnnualRate(input.interestRate);
  }

  const startDate = input.startDate || new Date();
  const fixedFee = input.fixedFee || 0;
  const insuranceFee = input.insuranceFee || 0;
  const totalFeesPerMonth = fixedFee + insuranceFee;

  // Calcular cronograma baseado no tipo de amortização
  const schedule =
    input.amortizationType === "price"
      ? calculatePriceSchedule(
          input.principal,
          monthlyRate,
          input.termMonths,
          startDate,
          fixedFee,
          insuranceFee
        )
      : calculateSacSchedule(
          input.principal,
          monthlyRate,
          input.termMonths,
          startDate,
          fixedFee,
          insuranceFee
        );

  // Calcular totais
  const totalPaid = schedule.reduce((sum, row) => sum + row.payment, 0);
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalFees = totalFeesPerMonth * input.termMonths;
  const firstInstallment = schedule[0]?.payment || 0;
  const averageInstallment = totalPaid / input.termMonths;

  return {
    principal: input.principal,
    monthlyRate,
    annualRate,
    termMonths: input.termMonths,
    amortizationType: input.amortizationType,
    firstInstallment,
    averageInstallment,
    totalPaid,
    totalInterest,
    totalFees,
    schedule,
  };
}

/**
 * Formata valor em reais
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata percentual
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value / 100);
}

/**
 * Formata data
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(date);
}
