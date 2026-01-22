export interface Client {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientFormData = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
