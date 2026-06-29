import { Transaction, Budget, Category } from '@/types';

// ?? 대신 || 사용: 빈 문자열("")도 폴백으로 처리하기 위함
// Vercel의 암호화 환경변수는 vercel pull 시 빈 문자열로 내려오므로 || 로 방어
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? 'API error');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Transactions ────────────────────────────────────────────

export function getTransactions(yearMonth?: string): Promise<Transaction[]> {
  const query = yearMonth ? `?yearMonth=${yearMonth}` : '';
  return request<Transaction[]>(`/transactions${query}`);
}

export function createTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  return request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) });
}

export function updateTransaction(id: string, data: Partial<Omit<Transaction, 'id'>>): Promise<Transaction> {
  return request<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteTransaction(id: string): Promise<void> {
  return request<void>(`/transactions/${id}`, { method: 'DELETE' });
}

export function deleteAllTransactions(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>('/transactions/all', { method: 'DELETE' });
}

// ─── Settings (PIN) ──────────────────────────────────────────

export function verifyPin(pin: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/settings/pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export function changePin(currentPin: string, newPin: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/settings/pin', {
    method: 'PUT',
    body: JSON.stringify({ currentPin, newPin }),
  });
}

// ─── Budget ──────────────────────────────────────────────────

export function getBudget(yearMonth: string): Promise<Budget> {
  return request<Budget>(`/budgets/${yearMonth}`);
}

export function setBudget(yearMonth: string, amount: number): Promise<Budget> {
  return request<Budget>(`/budgets/${yearMonth}`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  });
}

// ─── Categories ──────────────────────────────────────────────

export function getCategories(type: 'income' | 'expense'): Promise<Category[]> {
  return request<Category[]>(`/categories?type=${type}`);
}

export function addCategory(type: 'income' | 'expense', name: string): Promise<Category> {
  return request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ type, name }),
  });
}

export function deleteCategory(id: string): Promise<void> {
  return request<void>(`/categories/${id}`, { method: 'DELETE' });
}

// ─── Language ────────────────────────────────────────────────

export function getLanguageSetting(): Promise<{ language: string }> {
  return request<{ language: string }>('/settings/language');
}

export function setLanguageSetting(language: string): Promise<{ language: string }> {
  return request<{ language: string }>('/settings/language', {
    method: 'PUT',
    body: JSON.stringify({ language }),
  });
}

// ─── Notifications ───────────────────────────────────────────

export function getNotificationSettings(): Promise<{ enabled: boolean }> {
  return request<{ enabled: boolean }>('/notifications/settings');
}

export function updateNotificationSettings(enabled: boolean): Promise<{ enabled: boolean }> {
  return request<{ enabled: boolean }>('/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function sendTestNotification(): Promise<{ sent: boolean; recipients?: number }> {
  return request<{ sent: boolean; recipients?: number }>('/notifications/test', { method: 'POST' });
}

export function getLineUsers(): Promise<{ users: { id: string; display: string }[] }> {
  return request<{ users: { id: string; display: string }[] }>('/notifications/line-users');
}

export function deleteLineUser(id: string): Promise<{ users: string[] }> {
  return request<{ users: string[] }>(`/notifications/line-users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
