export interface Transaction {
  id?: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  memo?: string;
  createdAt?: { _seconds: number; _nanoseconds: number };
}

export interface Budget {
  id?: string;
  yearMonth: string; // YYYY-MM
  amount: number;
}

export interface Category {
  id: string;
  type: 'income' | 'expense';
  name: string;
  order: number;
}

export type TabType = 'home' | 'calendar' | 'stats' | 'more';
