// LINE Messaging API 푸시/멀티캐스트 알림 발송 서비스
//
// 환경변수:
//   LINE_CHANNEL_ACCESS_TOKEN — Messaging API 채널 액세스 토큰 (필수)
//   LINE_CHANNEL_SECRET       — Webhook 서명 검증용 시크릿 (Webhook 사용 시 필수)
//   LINE_USER_ID              — 초기 시드용 (Firestore 마이그레이션 후 불필요)
//
// 수신자 User ID는 Firestore settings/notification_settings.userIds 배열로 관리

// ─── 알림 발송 ────────────────────────────────────────────────

// 단일 userId → /push, 복수 → /multicast 자동 선택
// 반환: true=발송 성공, false=토큰 미설정(스킵), throw=API 오류
export async function sendLineNotification(message: string, userIds: string[]): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN 미설정 — 알림 발송 스킵');
    return false;
  }
  if (userIds.length === 0) {
    console.warn('[LINE] 수신자 없음 — 알림 발송 스킵');
    return false;
  }

  // 1명이면 /push, 2명 이상이면 /multicast (최대 500명)
  const endpoint = userIds.length === 1
    ? 'https://api.line.me/v2/bot/message/push'
    : 'https://api.line.me/v2/bot/message/multicast';

  const body = userIds.length === 1
    ? { to: userIds[0], messages: [{ type: 'text', text: message }] }
    : { to: userIds,    messages: [{ type: 'text', text: message }] };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`LINE API error ${res.status}: ${responseBody}`);
  }

  return true;
}

// ─── Webhook 서명 검증 ────────────────────────────────────────

// LINE이 Webhook 요청에 포함하는 X-Line-Signature 헤더 검증
// Channel Secret으로 HMAC-SHA256 해시를 계산해 일치 여부 확인
export async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed  = Buffer.from(sigBuffer).toString('base64');

  return computed === signature;
}

// ─── 메시지 포맷 ──────────────────────────────────────────────

// 예: "[가계부 알림]\n💸 지출 -¥3,000 (식비)\n2026-06-22 등록\n메모: 점심 식사"
export function buildTransactionMessage(tx: {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  memo?: string;
}): string {
  const icon      = tx.type === 'income' ? '💰' : '💸';
  const typeLabel = tx.type === 'income' ? '수입' : '지출';
  const sign      = tx.type === 'income' ? '+' : '-';
  const amount    = `¥${tx.amount.toLocaleString('ja-JP')}`;

  let message = `[가계부 알림]\n${icon} ${typeLabel} ${sign}${amount} (${tx.category})\n${tx.date} 등록`;
  if (tx.memo) message += `\n메모: ${tx.memo}`;

  return message;
}
