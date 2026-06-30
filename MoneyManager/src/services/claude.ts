import Anthropic from '@anthropic-ai/sdk';

// ─── Claude Vision API 응답 타입 ──────────────────────────────
export interface ReceiptScanResult {
  amount: number;  // 합계 금액 (엔화, 파싱 실패 시 0)
  memo:   string;  // 가게명 또는 품목 (파싱 실패 시 빈 문자열)
}

// MIME 타입 검증 — Claude API가 허용하는 이미지 포맷만 통과
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

// ─── 영수증 이미지 분석 함수 ──────────────────────────────────
// 이미지 Buffer를 받아 Claude Vision으로 분석 후 금액·메모를 반환합니다.
export async function scanReceipt(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ReceiptScanResult> {
  if (!isAllowedMimeType(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey });
  const base64Image = imageBuffer.toString('base64');

  const response = await client.messages.create({
    // Haiku: 이미지 OCR + 구조화 추출에 충분하며 Sonnet 대비 저렴
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `この領収書・レシートを読み取り、以下のJSON形式のみで返してください。
説明文や追加テキストは不要です。JSONのみ出力してください。

{"amount": <合計金額(数字のみ)>, "memo": "<店名または品目>"}

合計金額が読み取れない場合は amount に 0、
店名・品目が読み取れない場合は memo に "" を設定してください。`,
          },
        ],
      },
    ],
  });

  // Claude 응답에서 텍스트 추출
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  return parseReceiptResponse(text);
}

// ─── Claude 응답 텍스트에서 amount / memo 파싱 ────────────────
// 1차: JSON.parse 시도
// 2차: 정규식으로 각 필드 추출 (Claude가 JSON 외 설명을 붙인 경우 대응)
function parseReceiptResponse(text: string): ReceiptScanResult {
  // 1차: JSON 블록 추출 시도 (```json ... ``` 또는 순수 JSON)
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { amount?: unknown; memo?: unknown };
      const amount = typeof parsed.amount === 'number' ? Math.floor(parsed.amount) : 0;
      const memo   = typeof parsed.memo   === 'string' ? parsed.memo.trim()        : '';
      return { amount: Math.max(0, amount), memo };
    } catch {
      // JSON 파싱 실패 시 정규식 fallback으로 진행
    }
  }

  // 2차: 정규식 fallback
  const amountMatch = text.match(/"amount"\s*:\s*(\d+)/);
  const memoMatch   = text.match(/"memo"\s*:\s*"([^"]*)"/);

  return {
    amount: amountMatch ? Math.max(0, parseInt(amountMatch[1], 10)) : 0,
    memo:   memoMatch   ? memoMatch[1].trim() : '',
  };
}
