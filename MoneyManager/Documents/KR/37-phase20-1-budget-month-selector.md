# Phase 20-1 — 예산 연월 선택기 학습 문서

## 개요

더보기 탭의 예산 설정 섹션에 **연월 선택기(‹ ›)**를 추가하여, 이번 달뿐 아니라 다른 달의 예산도 조회·저장할 수 있게 됩니다.

**변경 전:**
```
더보기 → 예산 설정 (이번 달 고정)
  → 금액 입력 → 저장
```

**변경 후:**
```
더보기 → 예산 설정 (2026년 7월)
  → ‹ 이전 달  2026년 7월  다음 달 ›  ← 연월 선택기 추가
  → 금액 입력 → 저장 (선택된 달 기준)
```

---

## 1. 파일 구성

```
프론트엔드만 수정 (백엔드 변경 없음)
  frontend/src/components/features/more/MoreTab.tsx
    ├── prevMonth() / nextMonth() 헬퍼 함수 추가
    ├── yearMonth(상수) → budgetYearMonth(상태) 교체
    ├── useEffect 의존성 배열 수정
    ├── 연월 선택기 UI 추가
    └── 저장 시 선택된 연월 전달

  frontend/tests/more-tab.spec.ts
    └── Phase 20-1 테스트 7개 추가
```

---

## 2. 핵심 개념 1 — 순수 함수(Pure Function)

### 순수 함수란?

- **같은 입력 → 항상 같은 출력**
- **외부 상태를 읽거나 바꾸지 않음**

이전 달/다음 달 계산을 순수 함수로 작성하면, 어디서 호출해도 예상한 결과를 보장합니다.

```typescript
// Date 객체 없이 문자열 연산만으로 처리
// → 타임존 영향을 받지 않음
function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;           // 1월 → 전년 12월
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;          // 12월 → 다음년 1월
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
```

**Date 객체를 쓰지 않는 이유:**
```typescript
// 위험한 방법 — new Date("2026-01-01")은 UTC 기준이라
// 시스템 타임존에 따라 12월 31일이 될 수 있음
const d = new Date("2026-01-01");
d.setMonth(d.getMonth() - 1); // 예상: 2025-12, 실제: 환경마다 다를 수 있음
```

---

## 3. 핵심 개념 2 — useState로 상태 관리

### 기존 코드의 문제

```typescript
// 상수: 컴포넌트가 렌더링될 때 딱 한 번 계산되고, 이후 절대 바뀌지 않음
const yearMonth = getCurrentYearMonth(); // "2026-07" 고정
```

### 변경 후

```typescript
// 상태: 사용자가 ‹ › 버튼을 클릭할 때마다 값이 바뀌고
//       React가 자동으로 화면을 다시 그림
const [budgetYearMonth, setBudgetYearMonth] = useState(getCurrentYearMonth);
//                                                      ↑ 함수 참조 전달
// () => getCurrentYearMonth() 와 동일하지만 더 효율적
// — 초기 렌더링 시에만 한 번 호출되고, 이후 재호출 없음
```

**`useState(getCurrentYearMonth)` vs `useState(getCurrentYearMonth())`:**

| 형태 | 동작 |
|------|------|
| `useState(fn)` | 초기 렌더링 시에만 fn 호출 (지연 초기화) |
| `useState(fn())` | 매 렌더링마다 fn 호출 (불필요한 Date 생성) |

---

## 4. 핵심 개념 3 — useEffect 의존성 배열

### 의존성 배열이란?

`useEffect`의 두 번째 인자. **이 배열 안의 값이 바뀔 때마다 Effect가 다시 실행**됩니다.

```typescript
// 기존: yearMonth는 상수이므로 마운트 시 1회만 실행
useEffect(() => {
  getBudget(yearMonth)
    .then(b => setCurrentBudget(b.amount))
    .catch(() => setCurrentBudget(null));
}, [yearMonth]);

// 변경 후: budgetYearMonth가 바뀔 때마다(‹ › 클릭 시) 자동 재실행
useEffect(() => {
  setCurrentBudget(null); // 이전 달 금액이 잠깐 보이는 현상 방지
  getBudget(budgetYearMonth)
    .then(b => setCurrentBudget(b.amount))
    .catch(() => setCurrentBudget(null));
}, [budgetYearMonth]);
//   ↑ 이 값이 바뀌면 Effect 재실행
```

**`setCurrentBudget(null)` 먼저 호출하는 이유:**
- 6월(¥7,000) → 7월 이동 시, API 응답 전에 잠시 "현재: ¥7,000"이 보임
- `null`로 먼저 초기화하면 로딩 중에 이전 달 금액이 표시되지 않음

---

## 5. 핵심 개념 4 — 이벤트 버블링과 배치 위치

### 이벤트 버블링이란?

버튼 클릭 → 이벤트가 부모 요소로 전파(bubble up)됩니다.

```
[아코디언 헤더 button]       ← 클릭하면 아코디언 열기/닫기
  └── [‹ button]            ← 클릭하면 이전 달 이동
```

만약 `‹` 버튼이 아코디언 헤더 `<button>` 안에 있으면:
- `‹` 클릭 → 이전 달 이동 **+ 아코디언도 닫힘** (버블링 때문)

**해결책 A:** `e.stopPropagation()`으로 버블링 차단  
**해결책 B (채택):** 연월 선택기를 아코디언 **본체(body) 안**에 배치

```tsx
{/* 헤더: 클릭 시 열기/닫기만 */}
<button onClick={() => toggleSection('budget')}>
  예산 설정 (2026년 7월)
</button>

{/* 본체: 헤더 바깥에 있으므로 버블링 문제 없음 */}
{openSection === 'budget' && (
  <div>
    <div className="flex items-center justify-between">
      <button onClick={() => setBudgetYearMonth(prev => prevMonth(prev))}>‹</button>
      <span>2026년 7월</span>
      <button onClick={() => setBudgetYearMonth(prev => nextMonth(prev))}>›</button>
    </div>
    {/* 입력란, 저장 버튼 */}
  </div>
)}
```

---

## 6. 섹션 닫기 시 리셋

```typescript
// 섹션 전환 시 폼 상태 초기화 useEffect
useEffect(() => {
  if (openSection !== 'budget') {
    setBudgetInput('');
    setBudgetError('');
    setBudgetSuccess(false);
    // 닫힐 때 현재 달로 리셋 → 다시 열면 이번 달부터 시작
    setBudgetYearMonth(getCurrentYearMonth());
  }
}, [openSection]);
```

**왜 리셋하는가:**
- 6월로 이동한 상태에서 닫고 다른 작업 후 다시 열면 → 6월이 그대로 표시됨
- UX상 항상 이번 달부터 시작하는 게 자연스러움

---

## 7. UI 레이아웃 최적화

### 문제

아코디언을 펼쳤을 때 저장 버튼이 뷰포트 아래로 잘렸습니다.

### 원인 분석

```
화면 높이 (iPhone 14 기준) ≈ 844px
바텀 내비게이션              ≈  64px
사용 가능 높이               ≈ 780px

MoreTab 콘텐츠 (예산 섹션 펼침 시):
  pt-6(24) + 카드들(336) + gap×5(60) + 예산 바디(192) + pb-8(32) = 644px
  → 이론상 들어가지만 iOS 안전 영역 등으로 실제 잘림 발생
```

### 해결 — 간격·패딩 축소

| 위치 | 변경 전 | 변경 후 | 절약 |
|------|---------|---------|------|
| MoreTab 하단 패딩 | `pb-8` (32px) | `pb-4` (16px) | −16px |
| MoreTab 카드 간격 | `gap-3` (60px) | `gap-2` (40px) | −20px |
| 예산 바디 하단 패딩 | `pb-4` (16px) | `pb-3` (12px) | −4px |
| 예산 바디 내부 간격 | `gap-3` (24px) | `gap-2` (16px) | −8px |
| **총 절약** | | | **−48px** |

---

## 8. E2E 테스트 (Playwright)

`tests/more-tab.spec.ts`에 7개 테스트 추가.

### mock 전략 — 연월별 다른 예산 반환

```typescript
await page.route('**/budgets/**', route => {
  const url = route.request().url();
  if (route.request().method() === 'GET') {
    if (url.includes(PREV_YM))  // 이전 달 → ¥180,000
      return route.fulfill({ status: 200, body: JSON.stringify({ amount: 180000 }) });
    if (url.includes(NEXT_YM))  // 다음 달 → 예산 없음 (404)
      return route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
    // 현재 달 → ¥300,000
    return route.fulfill({ status: 200, body: JSON.stringify({ amount: 300000 }) });
  }
  ...
});
```

**왜 `amount: 0`이 아닌 404를 반환하는가:**
```typescript
// api.ts 의 request 함수
if (!res.ok) throw new Error(...);  // 4xx → throw

// MoreTab.tsx
getBudget(budgetYearMonth)
  .then(b => setCurrentBudget(b.amount))
  .catch(() => setCurrentBudget(null));  // 404 → null → 헤더에 금액 미표시
```
`amount: 0` (200 OK)로 반환하면 `현재: ¥0`이 표시되어 "미설정"과 구분이 안 됩니다.

### 테스트 목록

| 테스트 | 검증 내용 |
|--------|-----------|
| 아코디언 열기 시 ‹ › 표시 | 선택기 버튼 가시성 |
| `‹` → 이전 달 이동 + 예산 로드 | 헤더·placeholder 업데이트 |
| `›` → 다음 달 이동 + 예산 로드 | 404 → placeholder 기본값 |
| 연속 탐색 후 현재 달 복귀 | ‹‹›› 클릭 후 원위치 |
| 미설정 달 → 헤더 금액 없음 | `현재: ¥xxx` 미표시 |
| 섹션 닫기 후 재열기 → 리셋 | 현재 달로 초기화 |
| PUT API 호출 시 선택된 연월 포함 | URL 검증 |

---

## 9. 개발 환경 PIN 관리

PIN은 Firestore `settings/app_settings` 문서의 `pin` 필드에 평문 저장됩니다.

```
컬렉션: settings
문서:   app_settings
필드:   pin (string) — 4자리 숫자
```

- 운영 Firestore: `money-manager-499703` 프로젝트
- 개발 Firestore: `money-manager-dev-001` 프로젝트

개발 환경에 `pin` 필드가 없으면 `getPin()` 함수가 `undefined`를 반환해 로그인 불가 상태가 됩니다. Firestore REST API로 직접 설정할 수 있습니다.

```bash
curl -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token --project=money-manager-dev-001)" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/money-manager-dev-001/databases/(default)/documents/settings/app_settings?updateMask.fieldPaths=pin" \
  -d '{"fields": {"pin": {"stringValue": "0914"}}}'
```
