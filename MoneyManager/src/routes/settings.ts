import { Router, Request, Response } from 'express';
import { getPin, updatePin } from '../services/firestore';

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

export default router;
