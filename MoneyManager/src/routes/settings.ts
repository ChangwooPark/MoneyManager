import { Router, Request, Response } from 'express';
import { getPin, updatePin, getLanguage, setLanguage } from '../services/firestore';

const router = Router();

router.post('/pin/verify', async (req: Request, res: Response) => {
  const { pin } = req.body as { pin: string };
  if (!pin) {
    res.status(400).json({ error: 'PIN is required' });
    return;
  }
  const stored = await getPin();
  res.json({ success: pin === stored });
});

router.put('/pin', async (req: Request, res: Response) => {
  const { currentPin, newPin } = req.body as { currentPin: string; newPin: string };
  if (!currentPin || !newPin) {
    res.status(400).json({ error: 'currentPin and newPin are required' });
    return;
  }
  if (!/^\d{4}$/.test(newPin)) {
    res.status(400).json({ error: 'PIN must be 4 digits' });
    return;
  }
  const stored = await getPin();
  if (currentPin !== stored) {
    res.status(401).json({ error: 'Current PIN is incorrect' });
    return;
  }
  await updatePin(newPin);
  res.json({ success: true });
});

// ─── Language ────────────────────────────────────────────────

router.get('/language', async (_req: Request, res: Response) => {
  const language = await getLanguage();
  res.json({ language });
});

router.put('/language', async (req: Request, res: Response) => {
  const { language } = req.body as { language: string };
  if (!language || !['ko', 'ja'].includes(language)) {
    res.status(400).json({ error: 'language must be "ko" or "ja"' });
    return;
  }
  await setLanguage(language);
  res.json({ language });
});

export default router;
