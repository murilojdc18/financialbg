export type InstallmentStatus = "em_aberto" | "pago" | "atrasado";

export interface Installment {
  id: string;
  operationId: string;
  clientId: string;
  installmentNumber: number;
  dueDate: Date;
  amount: number;
  status: InstallmentStatus;
  paidAt?: Date;
  paymentMethod?: string;
  notes?: string;
}

export interface InstallmentFormData {
  paidAt: Date;
  paymentMethod: string;
  notes?: string;
}
