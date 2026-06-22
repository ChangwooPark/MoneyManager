// LINE 알림 설정 API
//
// GET  /notifications/settings          — 알림 활성화 여부 조회
// PUT  /notifications/settings          — 알림 활성화 여부 변경
// POST /notifications/test              — 테스트 메시지 발송
//
// GET    /notifications/line-users      — 수신자 User ID 목록 조회
// DELETE /notifications/line-users/:id  — 수신자 삭제
//
// POST /notifications/line-webhook      — LINE Webhook (파트너 User ID 자동 등록)

import { Router, Request, Response } from 'express';
import {
  getNotificationEnabled,
  setNotificationEnabled,
  getNotificationUserIds,
  addNotificationUserId,
  removeNotificationUserId,
} from '../services/firestore';
import { sendLineNotification, verifyLineSignature } from '../services/line';

const router = Router();

// ─── 알림 ON/OFF ──────────────────────────────────────────────

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

// ─── 테스트 발송 ──────────────────────────────────────────────

router.post('/test', async (_req: Request, res: Response) => {
  try {
    const userIds = await getNotificationUserIds();
    const sent = await sendLineNotification('[가계부 알림]\n✅ 테스트 메시지입니다.', userIds);
    res.json({ sent, recipients: userIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ sent: false, error: message });
  }
});

// ─── 수신자 User ID 관리 ──────────────────────────────────────

router.get('/line-users', async (_req: Request, res: Response) => {
  const userIds = await getNotificationUserIds();
  // 앞 8자만 노출하고 나머지 마스킹 (U1234567...)
  const masked = userIds.map(id => ({
    id,
    display: id.length > 8 ? id.slice(0, 8) + '...' : id,
  }));
  res.json({ users: masked });
});

router.delete('/line-users/:id', async (req: Request, res: Response) => {
  const updated = await removeNotificationUserId(req.params.id as string);
  res.json({ users: updated });
});

// ─── LINE Webhook ─────────────────────────────────────────────
// 파트너가 봇에게 메시지를 보내면 source.userId를 자동 등록하고 User ID를 회신합니다.
// LINE Developers 콘솔에서 Webhook URL을 이 엔드포인트로 설정해야 합니다.

router.post('/line-webhook', async (req: Request, res: Response) => {
  // LINE은 Webhook 수신 확인을 위해 200 응답을 즉시 기대함
  res.sendStatus(200);

  const signature = req.headers['x-line-signature'] as string | undefined;

  // Channel Secret이 설정된 경우에만 서명 검증
  if (process.env.LINE_CHANNEL_SECRET) {
    const rawBody = JSON.stringify(req.body);
    const valid = signature ? await verifyLineSignature(rawBody, signature) : false;
    if (!valid) {
      console.warn('[LINE Webhook] 서명 검증 실패 — 무시');
      return;
    }
  }

  const events = (req.body as { events?: LineWebhookEvent[] }).events ?? [];

  for (const event of events) {
    // message 이벤트 + 개인 채팅 (type: 'user') 만 처리
    if (event.type !== 'message' || event.source?.type !== 'user') continue;

    const userId = event.source.userId;
    if (!userId) continue;

    const userIds = await addNotificationUserId(userId);
    console.log(`[LINE Webhook] User ID 등록: ${userId} (총 ${userIds.length}명)`);

    // 등록 완료 안내 메시지 회신
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (token) {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: `✅ 알림 수신자로 등록되었습니다!\nUser ID: ${userId}`,
          }],
        }),
      }).catch(err => console.error('[LINE] Reply 실패:', err));
    }
  }
});

// ─── Webhook 이벤트 타입 ──────────────────────────────────────

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: {
    type: 'user' | 'group' | 'room';
    userId?: string;
  };
}

export default router;
