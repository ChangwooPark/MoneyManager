import { Router, Request, Response } from 'express';
import { getCategories, addCategory, deleteCategoryById } from '../services/firestore';

const router = Router();

// GET /categories?type=expense  또는  ?type=income
router.get('/', async (req: Request, res: Response) => {
  const { type } = req.query as { type?: string };
  if (type !== 'income' && type !== 'expense') {
    res.status(400).json({ error: 'type must be "income" or "expense"' });
    return;
  }
  try {
    const list = await getCategories(type as 'income' | 'expense');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /categories   body: { type, name }
router.post('/', async (req: Request, res: Response) => {
  const { type, name } = req.body as { type?: string; name?: string };
  if (type !== 'income' && type !== 'expense') {
    res.status(400).json({ error: 'type must be "income" or "expense"' });
    return;
  }
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const category = await addCategory(type as 'income' | 'expense', name.trim());
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add category' });
  }
});

// DELETE /categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await deleteCategoryById(id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
