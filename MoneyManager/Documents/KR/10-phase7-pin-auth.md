# Phase 7: PIN 인증 시스템

## 이 단계에서 한 일

앱 최초 진입 시 4자리 PIN 번호를 입력해야만 메인 화면에 접근할 수 있는
인증 시스템을 구현했습니다.

---

## 전체 인증 흐름

```
앱 접속
  ↓
AppShell: sessionStorage 확인
  ├─ 인증 기록 없음 → PinScreen 표시
  │     ↓
  │   숫자 패드로 4자리 입력
  │     ↓
  │   백엔드 POST /settings/pin/verify 호출
  │     ├─ 성공 → sessionStorage 저장 → 메인 화면
  │     └─ 실패 → 빨간색 표시 → 초기화 → 재입력
  │
  └─ 인증 기록 있음 → 바로 메인 화면
```

---

## 생성된 파일

### `src/components/features/auth/PinScreen.tsx`

사용자가 PIN을 입력하는 화면 컴포넌트입니다.

**주요 구성 요소:**

```
┌─────────────────────┐
│       가계부         │  ← 앱 제목
│  PIN 번호를 입력하세요  │  ← 안내 문구
│                     │
│   ● ● ○ ○          │  ← 입력 진행 점 (채워짐/비어있음)
│                     │
│  1   2   3          │
│  4   5   6          │  ← 숫자 패드
│  7   8   9          │
│      0   ⌫          │
└─────────────────────┘
```

**4자리 입력 즉시 자동 검증:**

```typescript
if (next.length === 4) {
  const { success } = await verifyPin(next);
  if (success) {
    onSuccess();  // 부모(AppShell)에게 성공 알림
  } else {
    setError(true);
    setTimeout(() => { setPin(''); setError(false); }, 600); // 0.6초 후 초기화
  }
}
```

별도의 확인 버튼 없이, 4번째 숫자를 누르는 즉시 검증이 시작됩니다.
UX적으로 더 빠르고 자연스러운 방식입니다.

**오류 피드백:**

| 상태 | 점 색상 | 테두리 색상 |
|------|---------|-----------|
| 기본 | 보라 (accent) | 보라 |
| 입력 중 | 보라 (채워짐) | 보라 |
| 오류 | 빨강 (expense) | 빨강 |

---

### `src/components/AppShell.tsx`

앱 전체를 감싸는 인증 상태 관리 컴포넌트입니다.

**역할:**
- 앱이 처음 로드될 때 `sessionStorage`를 확인
- 인증 여부에 따라 `PinScreen` 또는 메인 화면을 렌더링

```typescript
const SESSION_KEY = 'mm_verified';

useEffect(() => {
  const stored = sessionStorage.getItem(SESSION_KEY);
  setVerified(stored === 'true');
}, []);

const handleSuccess = () => {
  sessionStorage.setItem(SESSION_KEY, 'true');  // 세션에 저장
  setVerified(true);
};
```

**로딩 스피너의 이유:**

`verified` 초기값이 `null`인 이유가 있습니다.
`sessionStorage`는 브라우저에서만 접근 가능하므로,
서버에서 렌더링될 때는 항상 `null`입니다.
`useEffect`가 실행된 후(클라이언트 로드 완료 후)에야 실제 값을 알 수 있습니다.

```
서버 렌더링: verified = null → 스피너 표시
    ↓
클라이언트 로드: useEffect 실행 → sessionStorage 확인
    ↓
verified = true  → 메인 화면
verified = false → PIN 화면
```

이 처리가 없으면 화면이 잠깐 깜빡이는 현상(Flash of Unauthenticated Content)이 발생합니다.

---

## sessionStorage란?

브라우저에 데이터를 임시 저장하는 공간입니다.

| 저장소 | 유지 기간 | 특징 |
|--------|---------|------|
| `sessionStorage` | 탭이 열려있는 동안 | 탭 닫으면 삭제 |
| `localStorage` | 영구 | 직접 삭제하지 않으면 유지 |
| 쿠키 | 설정한 만료일까지 | 서버로도 전송됨 |

이 프로젝트에서 `sessionStorage`를 선택한 이유:
- 탭을 닫으면 자동으로 인증이 해제됨 (보안)
- 같은 탭 내에서는 페이지를 새로고침해도 유지됨 (편의성)
- 커플 전용 앱이므로 복잡한 JWT 토큰 방식이 불필요

---

## 'use client' 지시어란?

```typescript
'use client';  // 파일 최상단에 선언
```

Next.js App Router에서는 기본적으로 모든 컴포넌트가 **서버 컴포넌트**입니다.
서버에서 렌더링되므로 브라우저 API(`sessionStorage`, `useState`, `useEffect` 등)를 사용할 수 없습니다.

`'use client'`를 선언하면 해당 컴포넌트는 **클라이언트 컴포넌트**가 되어
브라우저에서 실행되며 모든 브라우저 API를 사용할 수 있습니다.

| 구분 | 서버 컴포넌트 | 클라이언트 컴포넌트 |
|------|-------------|------------------|
| 선언 | 기본값 (선언 불필요) | `'use client'` 필요 |
| 실행 위치 | 서버 | 브라우저 |
| useState 사용 | 불가 | 가능 |
| sessionStorage 사용 | 불가 | 가능 |
| SEO | 유리 | 불리 |

`PinScreen`과 `AppShell` 모두 `useState`, `useEffect`, 브라우저 API를 사용하므로
`'use client'`가 필요합니다.

---

## PIN 변경 기능 현황

| 구분 | 상태 |
|------|------|
| 백엔드 API (`PUT /settings/pin`) | ✅ Phase 6에서 구현 완료 |
| 프론트엔드 UI | ⏳ Phase 13 (더보기 탭)에서 구현 예정 |

백엔드는 이미 준비되어 있고, UI만 남은 상태입니다.
