// LINE 알림 설정 API
//
// GET  /notifications/settings — 알림 활성화 여부 조회
// PUT  /notifications/settings — 알림 활성화 여부 변경
// POST /notifications/test    — 테스트 메시지 발송

import { Router, Request, Response } from 'express';
import { getNotificationEnabled, setNotificationEnabled } from '../services/firestore';
import { sendLineNotification } from '../services/line';

const router = Router();

router.get('/settings', async (_req: Request, res: Response) => {
  const enabled = await getNotificationEnabled();
  res.json({ enabled });
});

router.put('/settings', async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }
  await setNotificationEnabled(enabled);
  res.json({ enabled });
});

router.post('/test', async (_req: Request, res: Response) => {
  try {
    const sent = await sendLineNotification('[가계부 알림]\n✅ 테스트 메시지입니다.');
    res.json({ sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ sent: false, error: message });
  }
});

export default router;
