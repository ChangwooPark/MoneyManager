// LINE Messaging API 푸시 알림 발송 서비스
//
// 환경변수:
//   LINE_CHANNEL_ACCESS_TOKEN — Messaging API 채널 액세스 토큰
//   LINE_USER_ID              — 알림을 받을 LINE 사용자 ID
//
// 반환값:
//   true  — 발송 성공
//   false — 환경변수 미설정 (조용히 스킵, 에러 아님)
//   throw — LINE API 응답 오류

export async function sendLineNotification(message: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  // 환경변수가 없으면 조용히 건너뜀 (로컬 개발 환경 등)
  if (!token || !userId) {
    console.warn('[LINE] 환경변수 미설정 — 알림 발송 스킵');
    return false;
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE API error ${res.status}: ${body}`);
  }

  return true;
}

// 거래 내역 알림 메시지 포맷 생성
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
