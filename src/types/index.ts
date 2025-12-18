// Tipos compartidos en toda la aplicación

export interface User {
  id: number;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  isLead: boolean;
  createdAt: Date;
}

export interface Conversation {
  id: number;
  userId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface Lead {
  id: number;
  userId: number;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInquiry {
  id: number;
  userId: number;
  productName: string;
  query: string;
  response?: string;
  createdAt: Date;
}
