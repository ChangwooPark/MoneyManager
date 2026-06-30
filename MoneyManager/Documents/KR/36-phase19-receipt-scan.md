# Phase 19 — 영수증 카메라 스캔 학습 문서

## 개요

거래 입력 폼에서 영수증을 카메라로 촬영하면, Claude Vision AI가 이미지를 분석해 **금액과 품목 리스트를 자동으로 입력**하는 기능입니다.

**사용 흐름:**
```
FAB(+) 탭 → 거래 입력 폼
  → [영수증 스캔] 버튼 탭
  → 카메라 / 갤러리에서 영수증 선택
  → 백엔드 POST /receipts/scan
  → Claude Haiku Vision 분석
  → 금액 · 품목 리스트 자동 입력
  → 사용자 확인 후 저장
```

---

## 1. 파일 구성

```
백엔드
  src/services/claude.ts       ← Claude Vision API 호출 + 응답 파싱
  src/routes/receipts.ts       ← POST /receipts/scan 라우트 (multer)
  src/index.ts                 ← /receipts 라우트 등록

프론트엔드
  frontend/src/lib/api.ts      ← scanReceiptImage() 함수 추가
  frontend/src/components/features/transaction/
    TransactionForm.tsx        ← 스캔 버튼 + 파일 input + 자동 채움
    TransactionDetailSheet.tsx ← 메모 white-space: pre-wrap 적용
  frontend/src/i18n/translations.ts ← receiptScanBtn 등 번역 키 추가
```

---

## 2. 백엔드 — multer로 이미지 수신

### multer란?

Express에서 `multipart/form-data` (파일 업로드) 요청을 파싱해 주는 미들웨어입니다.

```typescript
// src/routes/receipts.ts
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),       // 파일을 메모리(Buffer)에 저장
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);  // 허용
    } else {
      cb(new Error('허용되지 않는 이미지 형식'));
    }
  },
});
```

**왜 `memoryStorage()`인가?**

Cloud Run은 **무상태(Stateless)** 컨테이너입니다. 요청이 끝나면 컨테이너가 언제든 교체될 수 있으므로 디스크에 파일을 저장해도 다음 요청에서 찾을 수 없습니다. 메모리 버퍼에서 바로 처리하면 이 문제를 피할 수 있습니다.

### 라우트 등록

```typescript
// upload.single('image'): 'image' 필드명으로 파일 1개 수신
router.post('/scan', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    return;
  }
  const result = await scanReceipt(req.file.buffer, req.file.mimetype);
  res.json(result);
});
```

---

## 3. 백엔드 — Claude Vision API 호출

### Claude API 메시지 구조

Claude Vision API는 텍스트와 이미지를 함께 담은 메시지를 받습니다.

```typescript
// src/services/claude.ts
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',  // Haiku: 빠르고 저렴, OCR에 충분
  max_tokens: 1024,                     // 품목 리스트가 길어질 수 있으므로 여유 확보
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',           // 이미지를 base64 문자열로 인코딩
            media_type: 'image/jpeg', // MIME 타입 명시
            data: base64Image,        // Buffer.toString('base64')
          },
        },
        {
          type: 'text',
          text: `このレシートを読み取り...`,
        },
      ],
    },
  ],
});
```

**왜 Haiku 모델인가?**

| 항목 | Claude Haiku | Claude Sonnet |
|------|-------------|---------------|
| 영수증 OCR 능력 | 충분 | 과분 |
| 속도 | 빠름 | 보통 |
| 비용 | 저렴 (~$0.001/장) | 5배 비쌈 |

### 프롬프트 설계

```
このレシートを読み取り、以下のJSON形式のみで返してください。
{"amount": <합계금액>, "memo": "<품목리스트>"}

品目リストの形式:
- 「商品名×数量: 金額円」の形式で列挙
- 複数商品は改行(\n)で区切る
- 例: "卵×1: 500円\nラーメン×1: 300円"
```

**설계 포인트:**
- `JSONのみ출력` — 불필요한 설명 문장을 방지
- 품목 구분자로 쉼표 대신 `\n` 사용 → 메모 입력란에서 줄바꿈으로 보임
- 읽을 수 없을 때 `amount: 0`, `memo: ""` — fallback 명시

---

## 4. 백엔드 — 응답 파싱 (2단계 안전망)

Claude가 항상 정확한 JSON만 반환한다는 보장이 없으므로 2단계 파싱을 적용합니다.

```typescript
function parseReceiptResponse(text: string): ReceiptScanResult {
  // 1단계: JSON 추출 후 JSON.parse
  const jsonMatch = text.match(/\{[\s\S]*\}/);  // 탐욕적 매칭
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        amount: Math.max(0, Math.floor(parsed.amount ?? 0)),
        memo:   (parsed.memo ?? '').trim(),
      };
    } catch { /* 파싱 실패 시 2단계로 */ }
  }

  // 2단계: 정규식으로 각 필드 직접 추출
  const amountMatch = text.match(/"amount"\s*:\s*(\d+)/);
  const memoMatch   = text.match(/"memo"\s*:\s*"([^"]*)"/);
  return {
    amount: amountMatch ? parseInt(amountMatch[1], 10) : 0,
    memo:   memoMatch   ? memoMatch[1].trim() : '',
  };
}
```

**왜 탐욕적 매칭(`*`)?**

메모 안에 `{`, `}` 문자가 있을 수 있습니다. 비탐욕적(`*?`)이면 첫 `}` 에서 끊겨 파싱이 실패합니다. 탐욕적(`*`)은 마지막 `}`까지 포함하므로 전체 JSON을 올바르게 캡처합니다.

---

## 5. Secret Manager — API 키 관리

`ANTHROPIC_API_KEY`는 소스 코드나 환경변수에 직접 넣지 않고 **GCP Secret Manager**에 저장합니다.

```bash
# 1. 시크릿 생성
echo -n "sk-ant-..." | gcloud secrets create ANTHROPIC_API_KEY --data-file=- --project=<PROJECT_ID>

# 2. Cloud Run SA에 접근 권한 부여
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. Cloud Run 배포 시 시크릿을 환경변수로 마운트
gcloud run deploy money-manager \
  --set-secrets=ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest \
  ...
```

**흐름:**
```
Secret Manager (암호화 저장)
  ↓ IAM 권한 확인
Cloud Run 시작 시 환경변수로 주입
  ↓
process.env.ANTHROPIC_API_KEY 로 참조
```

---

## 6. 프론트엔드 — 카메라 연동

### 숨겨진 파일 input

`<input type="file" capture="environment">` 가 핵심입니다.

```tsx
// TransactionForm.tsx
const fileInputRef = useRef<HTMLInputElement>(null);

// 숨겨진 파일 input — 버튼 클릭 시 ref.click()으로 열기
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  capture="environment"   // 후면 카메라 우선 (갤러리 선택도 가능)
  className="hidden"
  onChange={handleReceiptScan}
/>

// 사용자에게 보이는 버튼
<button onClick={() => fileInputRef.current?.click()}>
  📷 영수증 스캔
</button>
```

**`capture="environment"` 의미:**
- `"environment"` = 후면(외부) 카메라 우선
- `"user"` = 전면 카메라 우선
- 생략 = 갤러리 열기

**`accept="image/*"` 의미:**
- 갤러리에서 이미지 파일만 선택 가능
- iOS에서 HEIC로 촬영해도 업로드 시 **브라우저가 자동으로 JPEG로 변환**

### FormData 전송

```typescript
// frontend/src/lib/api.ts
export async function scanReceiptImage(file: File): Promise<ReceiptScanResult> {
  const formData = new FormData();
  formData.append('image', file);  // 필드명 'image' = multer upload.single('image')와 일치

  const res = await fetch(`${BASE_URL}/receipts/scan`, {
    method: 'POST',
    body: formData,
    // Content-Type 헤더 미지정 — 브라우저가 multipart/form-data + boundary를 자동 설정
  });
  ...
}
```

**주의: Content-Type 헤더를 직접 지정하면 안 됩니다.**

`multipart/form-data`는 헤더에 `boundary=xxx` 값이 포함되어야 합니다. 브라우저가 FormData를 감지하면 자동으로 올바른 헤더를 생성합니다. 직접 `'Content-Type': 'multipart/form-data'`를 지정하면 boundary가 빠져 서버가 파일을 파싱하지 못합니다.

### 자동 채움 처리

```typescript
const handleReceiptScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  e.target.value = '';  // 같은 파일 재선택 시 onChange 재발동을 위해 초기화

  setScanning(true);
  try {
    const result = await scanReceiptImage(file);
    if (result.amount > 0) setAmount(String(result.amount));  // 금액 자동 채움
    if (result.memo)       setMemo(result.memo);              // 품목 리스트 자동 채움
    setScanMsg(t('receiptScanFilled'));
  } catch {
    setScanMsg(t('receiptScanError'));  // 실패해도 수동 입력 계속 가능
  } finally {
    setScanning(false);
  }
};
```

---

## 7. 메모 입력란 textarea 전환

품목 리스트는 여러 줄이므로 `<input>`을 `<textarea>`로 교체했습니다.

```tsx
// 변경 전
<input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />

// 변경 후
<textarea
  value={memo}
  onChange={(e) => setMemo(e.target.value)}
  rows={4}
  className="... resize-none"  // 사용자가 크기 조절 못 하도록
/>
```

거래 상세 시트에서도 줄바꿈이 표시되도록 `white-space: pre-wrap` 추가:

```tsx
// TransactionDetailSheet.tsx
<span style={{ color, whiteSpace: preWrap ? 'pre-wrap' : undefined }}>
  {value}
</span>
```

- `pre-wrap`: 문자열 내 `\n`을 실제 줄바꿈으로 렌더링
- `wrap`: 너무 길면 자동 줄바꿈 (normal과 달리 공백 보존)

---

## 8. CORS 트러블슈팅

개발 환경에서 PIN 인증이 실패한 원인은 CORS 차단이었습니다.

**원인:**

```
개발 Cloud Run FRONTEND_URL = "https://placeholder-dev.vercel.app"  (잘못된 값)
실제 개발 프론트엔드     = "https://frontend-dev-changwoo-park.vercel.app"
```

백엔드 CORS 미들웨어:
```typescript
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);

if (origin && allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

`frontend-dev-changwoo-park.vercel.app`이 허용 목록에 없으므로 브라우저가 API 응답을 차단 → PIN 입력이 항상 실패처럼 보임.

**해결:**
```bash
gcloud run services update money-manager-dev \
  --update-env-vars="FRONTEND_URL=https://frontend-dev-changwoo-park.vercel.app"
```

---

## 9. HEIC 포맷과 iOS 브라우저

iPhone 카메라는 기본적으로 **HEIC** 포맷으로 촬영합니다. HEIC는 Claude API가 지원하지 않는 포맷이지만, **iOS Safari/Chrome에서 `<input type="file">`로 이미지를 업로드할 때 브라우저가 자동으로 JPEG로 변환**하여 전송합니다.

따라서 실기기에서는 문제가 없지만, Mac에서 HEIC 파일을 직접 선택하면 `허용되지 않는 이미지 형식` 오류가 발생합니다. Mac 테스트 시에는 `sips`로 변환:

```bash
sips -s format jpeg 영수증.HEIC --out 영수증.jpg
```

---

## 10. 전체 데이터 흐름 정리

```
[사용자] 카메라로 영수증 촬영
     │
     │ File (JPEG, iOS에서 자동 변환)
     ▼
[프론트] FormData 생성 → POST /receipts/scan
     │
     │ multipart/form-data (Buffer in memory)
     ▼
[백엔드 multer] 파일 파싱 → req.file.buffer
     │
     │ Buffer + MIME 타입
     ▼
[Claude Haiku] base64 이미지 + 프롬프트
     │
     │ {"amount": 5370, "memo": "商品A×1: 500円\n商品B×1: 300円"}
     ▼
[백엔드] JSON 파싱 → res.json(result)
     │
     │ { amount: 5370, memo: "..." }
     ▼
[프론트] setAmount("5370") + setMemo("商品A×1: 500円\n商品B×1: 300円")
     │
     ▼
[UI] 금액 필드 자동 채움 + 메모 textarea에 줄바꿈으로 표시
```
