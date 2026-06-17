import { Firestore, Timestamp } from '@google-cloud/firestore';

const db = new Firestore();
const COLLECTION = 'transactions';

// ─── Settings (PIN) ──────────────────────────────────────────

const SETTINGS_DOC = 'app_settings';

export async function getPin(): Promise<string> {
  const doc = await db.collection('settings').doc(SETTINGS_DOC).get();
  if (!doc.exists) return '8907';
  return (doc.data() as { pin: string }).pin;
}

export async function updatePin(newPin: string): Promise<void> {
  await db.collection('settings').doc(SETTINGS_DOC).set({ pin: newPin }, { merge: true });
}

// ─── Budget ──────────────────────────────────────────────────

export interface Budget {
  id?: string;
  yearMonth: string;
  amount: number;
}

export async function getBudget(yearMonth: string): Promise<Budget | null> {
  const snapshot = await db.collection('budgets').where('yearMonth', '==', yearMonth).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<Budget, 'id'>) };
}

export async function setBudget(yearMonth: string, amount: number): Promise<Budget> {
  const existing = await getBudget(yearMonth);
  if (existing?.id) {
    await db.collection('budgets').doc(existing.id).update({ amount });
    return { ...existing, amount };
  }
  const ref = await db.collection('budgets').add({ yearMonth, amount });
  return { id: ref.id, yearMonth, amount };
}

export interface Transaction {
  id?: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string; // ISO 8601 date string
  createdAt?: Timestamp;
}

export async function createTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  const ref = await db.collection(COLLECTION).add({
    ...data,
    createdAt: Timestamp.now(),
  });
  return { id: ref.id, ...data };
}

export async function getTransactions(yearMonth?: string): Promise<Transaction[]> {
  let q = db.collection(COLLECTION).orderBy('date', 'desc').orderBy('createdAt', 'desc');
  if (yearMonth) {
    const [year, month] = yearMonth.split('-');
    q = q
      .where('date', '>=', `${year}-${month}-01`)
      .where('date', '<=', `${year}-${month}-31`) as typeof q;
  }
  const snapshot = await q.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Transaction, 'id'>) }));
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<Transaction, 'id'>) };
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Promise<Transaction | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return null;
  await ref.update(data);
  const updated = await ref.get();
  return { id: updated.id, ...(updated.data() as Omit<Transaction, 'id'>) };
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}
