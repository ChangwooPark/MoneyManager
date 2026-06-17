import { Router, Request, Response } from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  Transaction,
} from '../services/firestore';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const transactions = await getTransactions();
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
  const { type, amount, category, description, date } = req.body as Transaction;
  if (!type || !amount || !category || !description || !date) {
    res.status(400).json({ error: 'Missing required fields: type, amount, category, description, date' });
    return;
  }
  if (type !== 'income' && type !== 'expense') {
    res.status(400).json({ error: 'type must be "income" or "expense"' });
    return;
  }
  const created = await createTransaction({ type, amount, category, description, date });
  res.status(201).json(created);
});

router.put('/:id', async (req: Request, res: Response) => {
  const updated = await updateTransaction(req.params.id as string, req.body as Partial<Transaction>);
  if (!updated) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(updated);
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
