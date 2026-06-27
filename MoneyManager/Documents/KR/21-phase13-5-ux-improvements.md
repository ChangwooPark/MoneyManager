# Phase 13.5 공부 문서 — UX 개선 (FAB 숨김·달력 전체화면·구분선·스크롤 테스트)

## 1. 개요

Phase 13.5는 사용자 요청에 따라 즉시 적용한 4가지 UX 개선입니다.  
별도 백엔드 변경 없이 프론트엔드 코드만 수정했습니다.

| 항목 | 파일 |
|------|------|
| 더보기 탭 FAB 숨김 | `MainApp.tsx` |
| 달력 전체화면 채우기 | `MainApp.tsx`, `CalendarTab.tsx` |
| 달력 날짜 구분선 | `CalendarTab.tsx` |
| 스크롤 E2E 테스트 | `tests/scroll.spec.ts` |

---

## 2. 더보기 탭 FAB 숨김

### 문제
더보기 탭(설정 화면)에서도 거래 추가 FAB(+) 버튼이 보였습니다.  
더보기 탭은 PIN·예산·카테고리 설정 화면이므로 거래 추가 버튼이 불필요합니다.

### 해결 — 조건부 렌더링

```tsx
// MainApp.tsx — 변경 전
<button onClick={() => setShowForm(true)} aria-label="거래 추가">
  +
</button>

// MainApp.tsx — 변경 후
{activeTab !== 'more' && (
  <button onClick={() => setShowForm(true)} aria-label="거래 추가">
    +
  </button>
)}
```

**핵심 패턴**: `{조건 && <컴포넌트 />}` — 조건이 `false`이면 아무것도 렌더링하지 않음

---

## 3. 달력 전체화면 채우기

### 문제
달력이 화면의 절반 정도만 차지하고 아래쪽에 검은 빈 공간이 생겼습니다.  
6월처럼 5~6주짜리 달은 셀 높이가 작아서 달력이 더욱 위쪽으로 몰렸습니다.

### CSS 원인 분석

```
기존 구조:
main (flex-1, overflow-y-auto)         ← 높이 555px
  └── CalendarTab (h-full)             ← 이론상 555px 이어야 하지만...

문제: overflow-y: auto 컨테이너 안에서 h-full(= height: 100%)이
      부모의 flex-1 높이가 아닌 콘텐츠 높이를 기준으로 계산될 수 있음
      → CalendarTab이 실제로 216px (콘텐츠 높이)만 차지
```

이것은 CSS의 알려진 동작입니다.  
`overflow: auto` 컨테이너 내부에서 `height: 100%`는 브라우저에 따라  
"스크롤 영역 전체 높이"가 아닌 "현재 뷰포트 높이"로 해석될 수 있습니다.

### 해결 — flex 컨텍스트 전달

```tsx
// MainApp.tsx — main에 flex flex-col 추가
<main className="flex-1 overflow-y-auto flex flex-col">
  {activeTab === 'calendar' && <CalendarTab ... />}
  {activeTab === 'home'     && <HomeTab ... />}
  ...
</main>
```

```tsx
// CalendarTab.tsx — h-full 대신 flex-1 사용
// 변경 전
<div className="relative h-full flex flex-col">

// 변경 후
<div className="relative flex-1 flex flex-col min-h-0">
```

**왜 이 방법이 동작하나?**

| CSS 속성 | 동작 |
|----------|------|
| `h-full` (= `height: 100%`) | 부모의 높이를 기준으로 % 계산 — overflow 컨테이너 안에서 불안정 |
| `flex-1` (= `flex-grow: 1`) | flex 컨텍스트 안에서 남은 공간을 모두 차지 — 안정적 |

`main`에 `flex flex-col`을 추가하면 자식들이 flex 아이템이 됩니다.  
- CalendarTab: `flex-1` → 남은 높이를 모두 차지 ✓  
- HomeTab, StatsTab: 자연 높이 → 길어지면 `main`의 `overflow-y-auto`가 스크롤 제공 ✓

**`min-h-0`이 필요한 이유**:  
flex 아이템의 기본값은 `min-height: auto`입니다.  
이 경우 콘텐츠보다 작아지지 않으려 하기 때문에  
`min-h-0`(= `min-height: 0`)으로 override해야 올바르게 크기가 줄어듭니다.

---

## 4. 달력 날짜 구분선

### 목표
각 날짜 셀 사이에 옅은 라인을 추가해 날짜를 시각적으로 구분합니다.

### 구조 변경: grid → flex (주 단위 행)

```
변경 전: grid grid-cols-7 (단일 그리드)
변경 후: 각 주(week)를 flex 행으로 분리 + 행 사이 구분선
```

```tsx
// 셀 배열을 주(week) 단위로 분리
const weeks: CalendarCell[][] = [];
for (let i = 0; i < cells.length; i += 7) {
  weeks.push(cells.slice(i, i + 7));
}

// 구분선 상수
const DIVIDER = '1px solid var(--border)';
```

### 수평 구분선 (주 사이)

```tsx
{weeks.map((week, wi) => (
  <Fragment key={wi}>
    {/* 첫 번째 행 제외, 주 사이에 수평 구분선 삽입 */}
    {wi > 0 && (
      <div style={{ height: '1px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
    )}
    <div className="flex flex-1 min-h-0">
      {/* 날짜 셀들... */}
    </div>
  </Fragment>
))}
```

### 수직 구분선 (요일 사이)

```tsx
{week.map((cell, ci) => {
  const isLastCol = ci === 6;
  return (
    <div
      key={...}
      className="flex-1 min-w-0 overflow-hidden"
      style={{
        // 마지막 열(토요일)에는 오른쪽 구분선 없음
        borderRight: isLastCol ? 'none' : DIVIDER,
      }}
    >
      <button className="w-full h-full ...">
        {/* 날짜 숫자, 금액 레이블 */}
      </button>
    </div>
  );
})}
```

### 요일 헤더도 flex로 통일

```tsx
// 변경 전: grid grid-cols-7 (날짜 셀과 폭 불일치 가능)
<div className="grid grid-cols-7 mb-1">

// 변경 후: flex (날짜 셀과 동일한 폭 분배)
<div className="flex" style={{ borderBottom: DIVIDER }}>
  {DAY_LABELS.map((label, i) => (
    <div
      key={label}
      className="flex-1 text-center text-xs py-1.5 font-semibold"
      style={{ borderRight: i < 6 ? DIVIDER : 'none', ... }}
    >
      {label}
    </div>
  ))}
</div>
```

**`Fragment`에 key를 붙이는 방법**:

```tsx
// <> </> 축약형에는 key를 붙일 수 없음
<>...</>  // key 불가

// Fragment를 명시적으로 import해서 사용
import { Fragment } from 'react';
<Fragment key={wi}>...</Fragment>  // key 가능 ✓
```

---

## 5. 스크롤 E2E 테스트

### 목적
홈 탭·통계 탭에서 내역이 화면을 초과할 경우  
스크롤이 정상 동작하는지 자동으로 검증합니다.

### 스크롤 가능 여부 판단 방법

```typescript
// scrollHeight: 콘텐츠 전체 높이 (숨겨진 부분 포함)
// clientHeight: 화면에 실제로 보이는 높이
// scrollHeight > clientHeight → 스크롤 필요 = 스크롤 가능

const { scrollHeight, clientHeight } = await page.locator('main').evaluate(el => ({
  scrollHeight: el.scrollHeight,
  clientHeight: el.clientHeight,
}));

expect(scrollHeight).toBeGreaterThan(clientHeight);
```

### 스크롤 동작 확인 방법

```typescript
// 맨 아래로 스크롤
await page.locator('main').evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

// scrollTop: 현재 스크롤 위치 (0이면 맨 위)
// 스크롤이 일어났다면 scrollTop > 0
const scrollTop = await page.locator('main').evaluate(el => el.scrollTop);
expect(scrollTop).toBeGreaterThan(0);
```

### 하단 끝 도달 확인

```typescript
// scrollTop + clientHeight ≈ scrollHeight → 맨 아래까지 스크롤됨
const isAtBottom = await page.locator('main').evaluate(el =>
  Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) < 5
);
expect(isAtBottom).toBe(true);
```

`Math.abs(...) < 5`: 소수점 반올림 등으로 인한 1~2px 오차를 허용합니다.

### 탭바·연월 선택기 고정 위치 검증

```typescript
// 스크롤 전후 nav(탭바)의 y 좌표가 같아야 함 (= 화면에 고정)
const navBefore = await page.locator('nav').boundingBox();
await page.locator('main').evaluate(el => el.scrollTo({ top: el.scrollHeight }));
const navAfter = await page.locator('nav').boundingBox();

expect(navBefore?.y).toBe(navAfter?.y);  // 위치가 바뀌지 않았음
```

`boundingBox()`: 요소의 `{ x, y, width, height }` 뷰포트 기준 좌표를 반환합니다.

### 테스트용 모의 데이터 설계

```typescript
// 홈 탭: 25개 거래, 25일에 걸쳐 분산 → 날짜 헤더 포함 시 스크롤 발생
const HOME_TRANSACTIONS = Array.from({ length: 25 }, (_, i) => ({
  id: `tx-home-${i}`,
  date: `2026-06-${String((i % 25) + 1).padStart(2, '0')}`,
  ...
}));

// 통계 탭: 20개의 서로 다른 카테고리 → 각 행이 하나의 카테고리 → 스크롤 발생
const EXPENSE_CATEGORIES = [
  '식비', '교통', '쇼핑', '의료', '통신', '여가', '공과금', '생활', '미용', '운동',
  '교육', '카페', '외식', '생필품', '렌탈', '구독', '여행', '뷰티', '반려동물', '기타',
];
const STATS_TRANSACTIONS = EXPENSE_CATEGORIES.map((cat, i) => ({
  category: cat,
  amount: 10000 * (i + 1),  // 금액이 모두 다름 → 통계 탭이 각기 다른 행으로 표시
  ...
}));
```

**주의**: 통계 탭은 금액 내림차순으로 정렬합니다.  
`'기타'`(amount=200,000)가 최상단, `'식비'`(amount=10,000)가 최하단입니다.  
`toBeInViewport`로 특정 항목을 확인할 때는 정렬 순서를 고려해야 합니다.

---

## 6. 요약: Phase 13.5에서 배운 것

| 개념 | 핵심 포인트 |
|------|-------------|
| 조건부 렌더링 | `{조건 && <컴포넌트 />}` — false이면 렌더링 없음 |
| height: 100% 한계 | overflow: auto 안에서 불안정 → `flex-1`로 대체 |
| min-h-0 필요성 | flex 아이템 기본값 `min-height: auto` → `min-h-0`으로 override |
| Fragment key | `<Fragment key={...}>` — 축약형 `<>`에는 key 불가 |
| DIVIDER 상수 | 반복되는 border 스타일을 상수로 추출 → 일관성 유지 |
| scrollHeight vs clientHeight | scrollHeight > clientHeight → 스크롤 필요 |
| 스크롤 하단 확인 | `Math.abs(scrollTop + clientHeight - scrollHeight) < 5` |
| boundingBox() | 요소의 뷰포트 기준 좌표 → 고정 UI 검증에 활용 |
