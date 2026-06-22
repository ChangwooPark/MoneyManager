# Phase 17 — LINE Messaging API 알림 기능 학습 문서

## 개요

Phase 17에서 구현한 기능과 사용한 GCP Bash 명령어를 함께 설명합니다.

**구현 기능:**
1. LINE Messaging API로 거래 등록 시 푸시 알림 발송
2. 더보기 탭 — 알림 ON/OFF 토글 + 테스트 메시지 발송 UI
3. GCP Secret Manager로 API 토큰 안전 관리

---

## 1. LINE Messaging API 개념

LINE Notify(2025년 3월 종료)의 후속 방식입니다.

### 동작 흐름

```
[백엔드 서버]
     │
     │  POST https://api.line.me/v2/bot/message/push
     │  Authorization: Bearer {Channel Access Token}
     │  Body: { "to": "{User ID}", "messages": [...] }
     │
     ▼
[LINE 서버]
     │
     ▼
[사용자 LINE 앱]  ← 봇을 친구 추가해야 수신 가능
```

### 필요한 두 가지 값

| 값 | 설명 | 위치 |
|---|---|---|
| `Channel Access Token` | 봇이 메시지를 보낼 수 있는 인증 토큰 | LINE Developers → Messaging API 탭 |
| `User ID` | 메시지를 받을 사용자 식별자 | LINE Developers → Basic settings 탭 → "Your user ID" |

---

## 2. 백엔드 구조

### 2-1. LINE 서비스 (`src/services/line.ts`)

```typescript
export async function sendLineNotification(message: string): Promise<boolean> {
  const token  = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  // 환경변수 미설정 시 조용히 건너뜀 (로컬 개발 환경 등)
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

  return true; // 발송 성공
}
```

**반환값 설계 의도:**
- `true` — 실제 발송 성공
- `false` — 환경변수 미설정 (에러가 아님, 로컬 개발에서 조용히 스킵)
- `throw` — LINE API 응답 오류 (네트워크 문제, 잘못된 토큰 등)

### 2-2. 거래 저장 후 알림 발송 (fire-and-forget)

```typescript
// src/routes/transactions.ts — POST 핸들러
const created = await createTransaction({ type, amount, category, description, date, memo });
res.status(201).json(created); // ← 클라이언트에 즉시 응답 (알림 발송을 기다리지 않음)

// 알림 발송 — fire-and-forget
getNotificationEnabled()
  .then(enabled => {
    if (!enabled) return;
    return sendLineNotification(buildTransactionMessage(created));
  })
  .catch(err => console.error('[LINE] 알림 발송 실패:', err));
```

**fire-and-forget 패턴이란?**

`await`를 쓰지 않고 Promise를 그냥 흘려보내는 방식입니다.
알림 발송을 기다리지 않고 HTTP 응답을 먼저 보냅니다.

```
await 사용 시:  거래저장 → 알림발송(기다림) → 클라이언트 응답  (느림)
fire-and-forget: 거래저장 → 클라이언트 응답 즉시  (빠름)
                           ↑ 알림발송은 백그라운드에서 계속 진행
```

알림 실패가 거래 저장 자체에 영향을 주지 않도록 `.catch()`로 에러를 별도 처리합니다.

### 2-3. 알림 메시지 포맷

```typescript
export function buildTransactionMessage(tx: { ... }): string {
  const icon      = tx.type === 'income' ? '💰' : '💸';
  const typeLabel = tx.type === 'income' ? '수입' : '지출';
  const sign      = tx.type === 'income' ? '+' : '-';
  const amount    = `¥${tx.amount.toLocaleString('ja-JP')}`;

  let message = `[가계부 알림]\n${icon} ${typeLabel} ${sign}${amount} (${tx.category})\n${tx.date} 등록`;
  if (tx.memo) message += `\n메모: ${tx.memo}`;

  return message;
}
```

실제 LINE 메시지 예시:
```
[가계부 알림]
💸 지출 -¥3,000 (식비)
2026-06-22 등록
메모: 점심 식사
```

### 2-4. 알림 설정 API (`src/routes/notifications.ts`)

| 메서드 | 경로 | 기능 |
|---|---|---|
| GET | `/notifications/settings` | 알림 ON/OFF 상태 조회 |
| PUT | `/notifications/settings` | 알림 ON/OFF 변경 |
| POST | `/notifications/test` | 테스트 메시지 즉시 발송 |

Firestore `settings/notification_settings` 문서에 `{ enabled: boolean }` 저장.
기본값은 `true` (문서가 없으면 true 반환).

---

## 3. 프론트엔드 — ON/OFF 토글 버튼 구현

```tsx
<button
  onClick={handleNotifToggle}
  disabled={notifLoading}
  className="relative w-12 h-6 rounded-full overflow-hidden transition-colors duration-200"
  style={{ backgroundColor: notifEnabled ? 'var(--accent)' : 'var(--border)' }}
  aria-label={notifEnabled ? '알림 끄기' : '알림 켜기'}
>
  <span
    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
    style={{ transform: notifEnabled ? 'translateX(26px)' : 'translateX(2px)' }}
  />
</button>
```

**치수 계산:**
```
버튼: w-12 = 48px,  h-6 = 24px
썸:   w-5  = 20px,  h-5 = 20px

OFF 위치: translateX(2px)  → 왼쪽 끝 (2px 여백)
ON  위치: translateX(26px) → 오른쪽 끝 (48 - 20 - 2 = 26px)

overflow-hidden 이 필수인 이유:
  없으면 썸이 버튼 밖으로 튀어나와 UI가 깨짐
```

---

## 4. GCP Secret Manager — Bash 명령어 정리

### 4-1. Secret Manager API 활성화

```bash
gcloud services enable secretmanager.googleapis.com --project=money-manager-499703
```

GCP 프로젝트에서 Secret Manager 기능을 처음 사용할 때 한 번만 실행합니다.
활성화하지 않으면 `API has not been used` 오류가 발생합니다.

### 4-2. Secret 생성

```bash
printf '%s' '토큰값' | gcloud secrets create 시크릿이름 --data-file=- --project=프로젝트ID
```

**옵션 설명:**
- `printf '%s'` — 값 끝에 줄바꿈(`\n`)이 붙지 않도록 합니다. `echo`는 자동으로 `\n`을 추가하므로 토큰이 변질될 수 있습니다.
- `--data-file=-` — 표준입력(`stdin`)에서 값을 읽습니다. `-`가 stdin을 의미합니다.
- `--project` — 대상 GCP 프로젝트 ID

실제 사용한 명령어:
```bash
printf '%s' '735dqvAf...' | gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN \
  --data-file=- --project=money-manager-499703

printf '%s' 'U162361c...' | gcloud secrets create LINE_USER_ID \
  --data-file=- --project=money-manager-499703
```

성공 시 출력:
```
Created version [1] of the secret [LINE_CHANNEL_ACCESS_TOKEN].
```

### 4-3. Secret 버전 업데이트 (토큰 재발급 시)

```bash
printf '%s' '새토큰값' | gcloud secrets versions add 시크릿이름 \
  --data-file=- --project=프로젝트ID
```

Secret을 삭제하고 재생성하는 것이 아니라 `versions add`로 새 버전을 추가합니다.
기존 버전은 보관되고 `latest`가 새 버전을 가리킵니다.

### 4-4. IAM 권한 부여

```bash
gcloud projects add-iam-policy-binding money-manager-499703 \
  --member="serviceAccount:1094294666571-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Cloud Run이 Secret Manager의 값을 읽으려면 서비스 계정에 `secretAccessor` 권한이 필요합니다.
이 권한이 없으면 배포 시 `Permission denied on secret` 오류가 발생합니다.

**서비스 계정 이름 구조:**
```
{프로젝트번호}-compute@developer.gserviceaccount.com
└── Cloud Run, Compute Engine의 기본 서비스 계정
```

### 4-5. Cloud Run에 Secret 환경변수로 연결

```bash
gcloud run services update money-manager \
  --region asia-northeast3 \
  --project money-manager-499703 \
  --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest,LINE_USER_ID=LINE_USER_ID:latest"
```

**형식:** `환경변수이름=시크릿이름:버전`

- `latest` — 가장 최신 버전을 자동으로 참조합니다.
- 이 명령을 실행하면 새 Cloud Run 리비전이 생성됩니다.
- 컨테이너 내에서 `process.env.LINE_CHANNEL_ACCESS_TOKEN`으로 접근할 수 있습니다.

### 4-6. Secret 목록 확인

```bash
gcloud secrets list --project=money-manager-499703
```

출력 예시:
```
NAME                       CREATED              REPLICATION_POLICY  LOCATIONS
LINE_CHANNEL_ACCESS_TOKEN  2026-06-22T08:05:23  automatic           -
LINE_USER_ID               2026-06-22T08:05:37  automatic           -
```

### 4-7. 배포된 API 직접 테스트 (curl)

```bash
curl -s -X POST https://money-manager-1094294666571.asia-northeast3.run.app/notifications/test \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}"
```

**옵션 설명:**
- `-s` (silent) — 진행 표시줄 없이 결과만 출력
- `-X POST` — HTTP 메서드 지정
- `-H` — 헤더 추가
- `-w "\nHTTP_STATUS:%{http_code}"` — 응답 본문 뒤에 HTTP 상태 코드를 추가로 출력

성공 시 출력:
```
{"sent":true}
HTTP_STATUS:200
```

### 4-8. Cloud Run 서비스 정보 확인

```bash
# 현재 실행 중인 이미지 태그 확인 (배포된 커밋 해시 확인에 유용)
gcloud run services describe money-manager \
  --region asia-northeast3 \
  --project money-manager-499703 \
  --format="value(spec.template.spec.containers[0].image)"

# 최신 리비전 생성 시각 확인
gcloud run revisions describe 리비전이름 \
  --region asia-northeast3 \
  --project money-manager-499703 \
  --format="value(metadata.creationTimestamp)"
```

### 4-9. Cloud Run 로그 조회

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="money-manager"' \
  --project money-manager-499703 \
  --limit 30 \
  --freshness 10m \
  --format="value(timestamp, textPayload)"
```

**옵션 설명:**
- `resource.type` — 로그 소스 필터 (Cloud Run 리비전)
- `--freshness 10m` — 최근 10분 이내 로그만 조회
- `--limit 30` — 최대 30개 항목

---

## 5. Secret Manager vs 환경변수 직접 설정 비교

| 방식 | 장점 | 단점 |
|---|---|---|
| **Secret Manager** | 값이 GCP 콘솔에서 암호화 관리됨, 버전 관리 가능, IAM으로 접근 제어 | 설정이 복잡 |
| **환경변수 직접** | 설정 간단 | Cloud Run 콘솔에서 값이 평문으로 보임 |

API 토큰처럼 유출되면 안 되는 값은 Secret Manager를 사용합니다.

---

## 6. 전체 흐름 정리

```
[사용자가 거래 등록]
     │
     ▼
[프론트엔드] POST /transactions
     │
     ▼
[백엔드 transactions.ts]
     │  createTransaction() → Firestore 저장 완료
     │  res.status(201).json(created)  ← 클라이언트에 즉시 응답
     │
     │  (백그라운드)
     ├── getNotificationEnabled() → Firestore에서 알림 설정 조회
     │        │ enabled: false → 종료
     │        │ enabled: true  ↓
     └── sendLineNotification(message)
              │
              │  POST api.line.me/v2/bot/message/push
              │  Authorization: Bearer {SECRET_MANAGER에서 주입된 토큰}
              │
              ▼
         [LINE 서버] → [사용자 LINE 앱]
```

---

## 정리

| 구현 포인트 | 핵심 |
|---|---|
| LINE API 인증 | Bearer 토큰 방식, `Authorization: Bearer {token}` 헤더 |
| 토큰 보안 관리 | GCP Secret Manager → Cloud Run 환경변수로 자동 주입 |
| fire-and-forget | `await` 없이 `.then().catch()`로 백그라운드 실행 |
| 알림 비활성화 | Firestore `settings/notification_settings.enabled` 플래그 |
| 토글 UI | `overflow-hidden` 필수 — 없으면 썸이 버튼 밖으로 튀어나옴 |
| 봇 친구 추가 | 사용자가 LINE 앱에서 봇을 친구 추가해야 메시지 수신 가능 |
