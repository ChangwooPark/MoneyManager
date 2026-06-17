# Phase 6: Next.js 프론트엔드 초기 설정

## 이 단계에서 한 일

프론트엔드(화면)와 백엔드(데이터 처리)의 역할을 명확히 분리하고,
Next.js 프로젝트를 생성하여 기반을 구축했습니다.

---

## 아키텍처 결정: 역할 분리

### 처음 시도했던 방향 (잘못된 방향)

```
Next.js → Firebase SDK → Firestore (직접 연결)
```

Next.js에서 Firebase SDK를 설치해 Firestore에 직접 접근하려 했습니다.
이 방식은 다음 문제가 있었습니다:

- Firebase 인증 키가 브라우저에 노출됨 (보안 위험)
- 프론트엔드가 DB 로직을 포함하게 되어 역할이 혼재
- 원래 설계 의도(백엔드/프론트 분리)에 위배

### 최종 결정 방향 (올바른 방향)

```
Next.js (화면) → HTTP 요청 → Express API (Cloud Run) → Firestore
```

| 구분 | 역할 | 기술 |
|------|------|------|
| 프론트엔드 | 화면 구성, 사용자 입력, API 호출 | Next.js, TypeScript, Tailwind CSS |
| 백엔드 | 데이터 처리, DB 연동, 비즈니스 로직 | Express, TypeScript, Firestore |

---

## 백엔드 변경 사항

### 1. 신규 API 엔드포인트 추가

프론트엔드에서 필요한 기능을 위해 3가지 엔드포인트를 추가했습니다.

#### PIN 관련 (`/settings`)

| Method | 경로 | 기능 |
|--------|------|------|
| POST | `/settings/pin/verify` | 입력한 PIN이 맞는지 확인 |
| PUT | `/settings/pin` | PIN 변경 |

```typescript
// PIN 검증 예시
POST /settings/pin/verify
Body: { "pin": "8907" }
Response: { "success": true }
```

PIN은 Firestore의 `settings/app_settings` 도큐먼트에 저장됩니다.
초기값은 `8907`이며, 도큐먼트가 없으면 기본값을 반환합니다.

#### 예산 관련 (`/budgets`)

| Method | 경로 | 기능 |
|--------|------|------|
| GET | `/budgets/:yearMonth` | 해당 월 예산 조회 |
| PUT | `/budgets/:yearMonth` | 해당 월 예산 설정/수정 |

```typescript
// 예산 설정 예시
PUT /budgets/2026-06
Body: { "amount": 100000 }
Response: { "id": "xxx", "yearMonth": "2026-06", "amount": 100000 }
```

### 2. 거래 내역 연월 필터 추가

기존 `GET /transactions`에 `yearMonth` 쿼리 파라미터를 추가했습니다.

```typescript
// 2026년 6월 거래 내역만 조회
GET /transactions?yearMonth=2026-06
```

이전에는 전체 데이터를 한꺼번에 가져왔지만,
이제 특정 월의 데이터만 가져올 수 있어 성능이 향상됩니다.

### 3. CORS 설정 추가

CORS(Cross-Origin Resource Sharing)란, 다른 도메인 간의 HTTP 요청을 허용/차단하는 브라우저 보안 정책입니다.

예를 들어 `localhost:3000`(Next.js)에서 `localhost:8080`(Express)으로 요청하면,
브라우저가 "다른 출처(Origin)에서 온 요청"으로 판단해 차단합니다.
이를 허용하기 위해 CORS 설정이 필요합니다.

```typescript
// 허용할 출처 목록
const allowedOrigins = [
  process.env.FRONTEND_URL,   // 프로덕션 Next.js URL (환경 변수)
  'http://localhost:3000',    // 로컬 개발 환경
];
```

`FRONTEND_URL` 환경 변수로 프로덕션 URL을 주입하면,
나중에 Next.js를 배포했을 때도 자동으로 허용됩니다.

---

## 프론트엔드 구조

### 생성 명령어

```bash
npx create-next-app@latest frontend \
  --typescript \     # TypeScript 사용
  --tailwind \       # Tailwind CSS 포함
  --eslint \         # ESLint 코드 검사 포함
  --app \            # App Router 사용 (최신 방식)
  --src-dir \        # src/ 폴더 구조
  --import-alias "@/*"  # @/로 시작하는 절대 경로 import
```

### 디렉토리 구조

```
frontend/
  src/
    app/
      globals.css       # 전역 CSS (다크 테마 변수 정의)
      layout.tsx        # 루트 레이아웃 (모든 페이지 공통)
      page.tsx          # 메인 페이지 (추후 구현)
    types/
      index.ts          # 공통 TypeScript 타입 정의
    lib/
      api.ts            # 백엔드 API 호출 함수 모음
    components/         # UI 컴포넌트 (추후 구현)
  .env.local            # 환경 변수 (API URL 등)
```

### 주요 파일 설명

#### `src/types/index.ts` — 공통 타입 정의

TypeScript에서 데이터의 형태를 미리 정의해두는 파일입니다.
백엔드와 프론트엔드가 동일한 데이터 구조를 공유합니다.

```typescript
export interface Transaction {
  id?: string;
  type: 'income' | 'expense';   // 수입 또는 지출만 허용
  amount: number;
  category: string;
  description: string;
  date: string;                  // YYYY-MM-DD 형식
  memo?: string;                 // ?는 선택 항목(없어도 됨)
}

export interface Budget {
  id?: string;
  yearMonth: string;             // YYYY-MM 형식
  amount: number;
}

export type TabType = 'home' | 'calendar' | 'stats' | 'more';
```

#### `src/lib/api.ts` — API 클라이언트

백엔드 API를 호출하는 함수들을 모아둔 파일입니다.
컴포넌트에서 직접 `fetch`를 쓰는 대신, 이 파일의 함수를 호출합니다.

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// 사용 예시 (컴포넌트에서)
import { getTransactions, createTransaction } from '@/lib/api';

const data = await getTransactions('2026-06');
await createTransaction({ type: 'expense', amount: 5000, ... });
```

**`NEXT_PUBLIC_` 접두사의 의미:**
Next.js에서 환경 변수를 브라우저(클라이언트)에서도 접근하려면
`NEXT_PUBLIC_` 접두사가 필수입니다. 없으면 서버에서만 읽을 수 있습니다.

#### `src/app/globals.css` — 다크 테마

CSS 변수로 색상을 정의하여 일관된 다크 테마를 유지합니다.

```css
:root {
  --bg-primary: #0f0f0f;    /* 가장 어두운 배경 */
  --bg-secondary: #1a1a1a;  /* 카드 배경 */
  --income: #34d399;        /* 수입 색상 (초록) */
  --expense: #f87171;       /* 지출 색상 (빨강) */
  --accent: #6366f1;        /* 강조색 (보라) */
}
```

#### `.env.local` — 환경 변수

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

로컬 개발 시에는 로컬 Express 서버(8080)에 연결합니다.
배포 시에는 이 값을 Cloud Run URL로 변경합니다.
`.env.local`은 `.gitignore`에 포함되어 있어 GitHub에 올라가지 않습니다.

---

## Next.js App Router란?

Next.js 13부터 도입된 새로운 라우팅 방식입니다.
`src/app/` 폴더의 구조가 그대로 URL 경로가 됩니다.

```
src/app/
  page.tsx          → /        (메인 페이지)
  layout.tsx        → 모든 페이지에 공통 적용되는 레이아웃
```

`layout.tsx`는 모든 페이지를 감싸는 껍데기 역할을 합니다.
메타데이터(탭 제목, 뷰포트 설정 등)를 여기서 설정합니다.

```typescript
// 모바일 최적화 뷰포트 설정
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,   // 핀치 줌 비활성화 (앱처럼)
};
```

---

## 환경 변수 관리 전략

| 파일 | 용도 | Git 포함 여부 |
|------|------|--------------|
| `.env.local` | 로컬 개발용 (API URL 등) | 제외 |
| GitHub Secrets | 배포 시 환경 변수 주입 | 제외 (암호화 저장) |

프로덕션 배포 시에는 `NEXT_PUBLIC_API_URL`을 Cloud Run URL로 설정해야 합니다:
```
NEXT_PUBLIC_API_URL=https://money-manager-1094294666571.asia-northeast3.run.app
```
