import { Firestore, Timestamp } from '@google-cloud/firestore';

const db = new Firestore();
const COLLECTION = 'transactions';

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

export async function getTransactions(): Promise<Transaction[]> {
  const snapshot = await db.collection(COLLECTION).orderBy('date', 'desc').get();
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
