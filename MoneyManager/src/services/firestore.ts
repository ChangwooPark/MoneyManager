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

// ─── Categories ──────────────────────────────────────────────

export interface Category {
  id?: string;
  type: 'income' | 'expense';
  name: string;
  order: number;
}

// 카테고리가 DB에 없을 때 자동으로 채워넣을 기본값
const DEFAULT_CATEGORIES: Record<'income' | 'expense', string[]> = {
  expense: ['식비', '교통', '쇼핑', '의료', '통신', '여가', '공과금', '생활', '기타'],
  income:  ['급여', '부업', '이자', '보너스', '기타'],
};

async function seedCategories(type: 'income' | 'expense'): Promise<void> {
  const batch = db.batch();
  DEFAULT_CATEGORIES[type].forEach((name, order) => {
    const ref = db.collection('categories').doc();
    batch.set(ref, { type, name, order });
  });
  await batch.commit();
}

export async function getCategories(type: 'income' | 'expense'): Promise<Category[]> {
  const snapshot = await db.collection('categories').where('type', '==', type).get();

  // DB가 비어있으면 기본 카테고리를 자동 등록 후 다시 조회
  if (snapshot.empty) {
    await seedCategories(type);
    const seeded = await db.collection('categories').where('type', '==', type).get();
    return seeded.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as Omit<Category, 'id'>) }))
      .sort((a, b) => a.order - b.order);
  }

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...(doc.data() as Omit<Category, 'id'>) }))
    .sort((a, b) => a.order - b.order);
}

export async function addCategory(type: 'income' | 'expense', name: string): Promise<Category> {
  // 기존 카테고리 중 가장 큰 order 값 파악 → 새 항목은 마지막에 추가
  const existing = await getCategories(type);
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) : -1;
  const ref = await db.collection('categories').add({ type, name, order: maxOrder + 1 });
  return { id: ref.id, type, name, order: maxOrder + 1 };
}

export async function deleteCategoryById(id: string): Promise<void> {
  await db.collection('categories').doc(id).delete();
}

// ─────────────────────────────────────────────────────────────

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
  // date만 Firestore에서 정렬 — date + createdAt 복합 인덱스 없이도 동작
  // createdAt 2차 정렬은 fetch 후 JS에서 처리
  let q = db.collection(COLLECTION).orderBy('date', 'desc');
  if (yearMonth) {
    const [year, month] = yearMonth.split('-');
    q = q
      .where('date', '>=', `${year}-${month}-01`)
      .where('date', '<=', `${year}-${month}-31`) as typeof q;
  }
  const snapshot = await q.get();
  const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Transaction, 'id'>) }));

  // 같은 날짜 내에서 최신 등록 순(createdAt DESC) 정렬
  return rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const aTs = (a.createdAt as { _seconds: number } | undefined)?._seconds ?? 0;
    const bTs = (b.createdAt as { _seconds: number } | undefined)?._seconds ?? 0;
    return bTs - aTs;
  });
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
