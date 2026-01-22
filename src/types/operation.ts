export type OperationStatus = "ativa" | "quitada" | "cancelada";
export type AmortizationType = "price" | "sac";

export interface Operation {
  id: string;
  clientId: string;
  type: "Empréstimo";
  principal: number;
  interestRate: number; // monthly %
  termMonths: number;
  amortizationType: AmortizationType;
  status: OperationStatus;
  createdAt: Date;
}
