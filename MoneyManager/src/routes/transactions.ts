import { Router, Request, Response } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  deleteAllTransactions,
  getNotificationEnabled,
  getNotificationUserIds,
  Transaction,
} from '../services/firestore';
import { sendLineNotification, buildTransactionMessage } from '../services/line';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const yearMonth = req.query.yearMonth as string | undefined;
  const transactions = await getTransactions(yearMonth);
  res.json(transactions);
});

router.get('/:id', async (req: Request, res: Response) => {
  const transaction = await getTransactionById(req.params.id as string);
  if (!transaction) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(transaction);
});

router.post('/', async (req: Request, res: Response) => {
  const { type, amount, category, description, date, memo } = req.body as Transaction;
  if (!type || !amount || !category || !description || !date) {
    res.status(400).json({ error: 'Missing required fields: type, amount, category, description, date' });
    return;
  }
  if (type !== 'income' && type !== 'expense') {
    res.status(400).json({ error: 'type must be "income" or "expense"' });
    return;
  }
  const created = await createTransaction({ type, amount, category, description, date, memo });
  res.status(201).json(created);

  // 알림 발송 — fire-and-forget (실패해도 거래 저장에는 영향 없음)
  Promise.all([getNotificationEnabled(), getNotificationUserIds()])
    .then(([enabled, userIds]) => {
      if (!enabled || userIds.length === 0) return;
      return sendLineNotification(buildTransactionMessage(created), userIds);
    })
    .catch(err => console.error('[LINE] 알림 발송 실패:', err));
});

router.put('/:id', async (req: Request, res: Response) => {
  const updated = await updateTransaction(req.params.id as string, req.body as Partial<Transaction>);
  if (!updated) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(updated);
});

// DELETE /all は /:id より前に配置 — Express が 'all' を :id として解釈しないため
router.delete('/all', async (_req: Request, res: Response) => {
  const count = await deleteAllTransactions();
  res.json({ deleted: count });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await deleteTransaction(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.status(204).send();
});

export default router;
