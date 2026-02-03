// Enums do banco de dados
export type OperationSystem = 'PRICE' | 'SAC';
export type OperationStatus = 'ATIVA' | 'QUITADA' | 'CANCELADA';
export type ReceivableStatus = 'EM_ABERTO' | 'PAGO' | 'ATRASADO' | 'PARCIAL';
export type PaymentMethod = 'PIX' | 'BOLETO' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO' | 'OUTRO';

// Tipos das tabelas
export interface DbClient {
  id: string;
  owner_id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Tipo para origem do caixa
export type CashSource = 'B&G' | 'PESSOAL';

export interface DbOperation {
  id: string;
  owner_id: string;
  client_id: string;
  principal: number;
  rate_monthly: number;
  term_months: number;
  system: OperationSystem;
  start_date: string;
  fee_fixed: number | null;
  fee_insurance: number | null;
  status: OperationStatus;
  notes: string | null;
  cash_source: CashSource;
  // Campos de cobrança com atraso
  late_grace_days: number;
  late_penalty_percent: number;
  /** @deprecated Use late_interest_daily_percent */
  late_interest_monthly_percent: number;
  late_interest_daily_percent: number;
  created_at: string;
  updated_at: string;
}

export interface DbReceivable {
  id: string;
  owner_id: string;
  operation_id: string;
  client_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: ReceivableStatus;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  // Campos de multa/mora
  penalty_applied: boolean;
  penalty_amount: number;
  interest_accrued: number;
  last_interest_calc_at: string | null;
  // Renegociação
  renegotiated_to_receivable_id: string | null;
  // Novos campos para encargos carregados e congelamento
  carried_penalty_amount: number;
  carried_interest_amount: number;
  renegotiated_from_receivable_id: string | null;
  accrual_frozen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPayment {
  id: string;
  owner_id: string;
  receivable_id: string;
  client_id: string | null;
  operation_id: string | null;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  notes: string | null;
  note: string | null;
  created_at: string;
  // Campos de alocação flexível
  amount_total: number;
  alloc_penalty: number;
  alloc_interest: number;
  alloc_principal: number;
  // Campos de desconto/isenção
  discount_penalty: number;
  discount_interest: number;
  discount_principal: number;
  // Campos de correção (soft-void)
  is_voided: boolean;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  updated_at: string | null;
}

// Tipos para inserção (sem campos auto-gerados)
export type DbClientInsert = Omit<DbClient, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type DbClientUpdate = Partial<DbClientInsert>;

export type DbOperationInsert = Omit<DbOperation, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type DbOperationUpdate = Partial<DbOperationInsert>;

export type DbReceivableInsert = Omit<DbReceivable, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type DbReceivableUpdate = Partial<DbReceivableInsert>;

export type DbPaymentInsert = Omit<DbPayment, 'id' | 'owner_id' | 'created_at'>;

// Tipos com relacionamentos
export interface DbOperationWithClient extends DbOperation {
  clients: DbClient;
}

export interface DbReceivableWithRelations extends DbReceivable {
  clients: DbClient;
  operations: DbOperation & { cash_source: CashSource };
}
