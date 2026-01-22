// Enums do banco de dados
export type OperationSystem = 'PRICE' | 'SAC';
export type OperationStatus = 'ATIVA' | 'QUITADA' | 'CANCELADA';
export type ReceivableStatus = 'EM_ABERTO' | 'PAGO' | 'ATRASADO';
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
  status: ReceivableStatus;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPayment {
  id: string;
  owner_id: string;
  receivable_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  notes: string | null;
  created_at: string;
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
  operations: DbOperation;
}
