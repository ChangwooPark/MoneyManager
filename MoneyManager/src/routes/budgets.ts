import { Router, Request, Response } from 'express';
import { getBudget, setBudget } from '../services/firestore';

const router = Router();

router.get('/:yearMonth', async (req: Request, res: Response) => {
  const budget = await getBudget(req.params.yearMonth as string);
  if (!budget) {
    res.status(404).json({ error: 'Budget not found' });
    return;
  }
  res.json(budget);
});

router.put('/:yearMonth', async (req: Request, res: Response) => {
  const { amount } = req.body as { amount: number };
  if (amount === undefined || isNaN(amount)) {
    res.status(400).json({ error: 'amount is required' });
    return;
  }
  const budget = await setBudget(req.params.yearMonth as string, amount);
  res.json(budget);
});

export default router;
