# Phase 8: 공통 레이아웃 및 네비게이션

## 이 단계에서 한 일

앱 전체의 뼈대가 되는 레이아웃을 구성했습니다.
PIN 인증 통과 후 표시되는 메인 화면의 구조(탭바, 연월 선택기, 탭 컨텐츠)를 완성했습니다.

---

## 전체 화면 구조

```
┌─────────────────────────┐
│      MonthSelector       │  ← 홈·달력·통계 탭에서만 표시
│   ‹  2026년 6월  ›      │    더보기 탭에서는 숨김
├─────────────────────────┤
│                         │
│      탭 컨텐츠 영역      │  ← 스크롤 가능
│   (HomeTab /            │
│    CalendarTab /        │
│    StatsTab /           │
│    MoreTab)             │
│                         │
├─────────────────────────┤
│  🏠    📅    📊    ⋯   │  ← BottomNav (항상 하단 고정)
│  홈   달력  통계  더보기 │
└─────────────────────────┘
```

---

## 생성된 파일

### `src/components/layout/BottomNav.tsx`

화면 최하단에 항상 고정되는 탭 네비게이션 바입니다.

**핵심 구현 포인트:**

```typescript
// 탭 목록을 배열로 관리 — 순서 변경이나 탭 추가가 쉬움
const TABS = [
  { id: 'home',     label: '홈',    icon: '🏠' },
  { id: 'calendar', label: '달력',  icon: '📅' },
  { id: 'stats',    label: '통계',  icon: '📊' },
  { id: 'more',     label: '더보기', icon: '⋯' },
];
```

**탭바가 항상 하단에 고정되는 원리:**

```
MainApp (flex flex-col, h-full)
  ├─ MonthSelector      → 고정 높이
  ├─ main (flex-1)      → 남은 공간 모두 차지 (늘어남)
  └─ BottomNav          → flexShrink:0 (줄어들지 않음)
```

`flex-col` 레이아웃에서 `flex-1`을 가진 중간 영역이 늘어나고,
`flexShrink:0`을 가진 BottomNav는 항상 고정 높이를 유지합니다.
이 구조로 탭바가 자연스럽게 최하단에 위치합니다.

**활성 탭 표시:**

```typescript
const isActive = activeTab === tab.id;

color: isActive ? 'var(--accent)' : 'var(--text-secondary)'
// 활성: 보라색  /  비활성: 회색
```

**터치 타깃 크기:**
- 탭바 전체 높이: `64px`
- 각 탭 버튼: `flex-1 h-full` → 탭바 전체 높이 차지
- 모바일 권장 터치 타깃 최소값(44px)을 초과하여 확보

---

### `src/components/layout/MonthSelector.tsx`

`‹ 2026년 6월 ›` 형태의 연월 전환 컴포넌트입니다.

**월 계산 로직 (연도 넘김 자동 처리):**

```typescript
function addMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number); // "2026-06" → [2026, 6]
  const date = new Date(y, m - 1 + delta, 1);
  // JavaScript Date는 월을 0부터 시작하므로 -1 보정
  // delta를 더하면 자동으로 연도 넘김 처리:
  //   new Date(2026, 11 + 1, 1) → 2027년 1월
  //   new Date(2026,  0 - 1, 1) → 2025년 12월
  ...
}
```

**표시 형식:**

```typescript
const [year, month] = yearMonth.split('-');
// "2026년 6월" — Number(month)로 앞의 0 제거 ("06" → 6)
{year}년 {Number(month)}월
```

**표시 대상 탭 제어:**

```typescript
// MainApp에서 관리 — 더보기 탭에서는 MonthSelector 자체를 렌더링하지 않음
const TABS_WITH_MONTH_SELECTOR: TabType[] = ['home', 'calendar', 'stats'];
const showMonthSelector = TABS_WITH_MONTH_SELECTOR.includes(activeTab);
{showMonthSelector && <MonthSelector ... />}
```

---

### `src/components/MainApp.tsx`

PIN 인증 후 표시되는 메인 화면의 중앙 상태 관리 컴포넌트입니다.

**관리하는 상태(State) 2가지:**

| 상태 | 타입 | 초기값 | 역할 |
|------|------|--------|------|
| `activeTab` | `TabType` | `'home'` | 현재 활성화된 탭 |
| `yearMonth` | `string` | 오늘 연월 | 조회할 연월 |

**상태를 MainApp에서 중앙 관리하는 이유:**

```
MainApp (상태 보유)
  ├─ MonthSelector ← yearMonth, setYearMonth 전달
  ├─ HomeTab       ← yearMonth 전달 (해당 월 데이터 조회용)
  ├─ CalendarTab   ← yearMonth 전달
  ├─ StatsTab      ← yearMonth 전달
  └─ BottomNav     ← activeTab, setActiveTab 전달
```

달력 탭에서 월을 바꾸면 홈 탭도 같은 월을 보여줘야 합니다.
두 컴포넌트가 같은 상태를 공유해야 하므로, 공통 부모인 MainApp에서 상태를 관리합니다.
이를 **상태 끌어올리기(State Lifting)** 라고 합니다.

**탭 컨텐츠 조건부 렌더링:**

```typescript
// 활성화된 탭에 해당하는 컴포넌트만 렌더링
{activeTab === 'home'     && <HomeTab     yearMonth={yearMonth} />}
{activeTab === 'calendar' && <CalendarTab yearMonth={yearMonth} />}
{activeTab === 'stats'    && <StatsTab    yearMonth={yearMonth} />}
{activeTab === 'more'     && <MoreTab />}
```

---

### 탭 플레이스홀더 컴포넌트

각 탭의 실제 UI는 이후 Phase에서 구현됩니다.
지금은 레이아웃이 정상 동작하는지 확인하기 위한 빈 화면을 배치했습니다.

| 컴포넌트 | 파일 | 구현 예정 Phase |
|---------|------|---------------|
| `HomeTab` | `features/home/HomeTab.tsx` | Phase 10 |
| `CalendarTab` | `features/calendar/CalendarTab.tsx` | Phase 11 |
| `StatsTab` | `features/stats/StatsTab.tsx` | Phase 12 |
| `MoreTab` | `features/more/MoreTab.tsx` | Phase 13 |

---

## 모바일 퍼스트 레이아웃

### PC에서 모바일 뷰로 보이는 원리

```typescript
// layout.tsx
<body className="h-full flex flex-col max-w-md mx-auto relative">
```

- `max-w-md`: 최대 너비 448px로 제한
- `mx-auto`: 좌우 중앙 정렬
- PC에서는 폰 화면처럼 중앙에 세로로 긴 영역이 나타남

### 전체 높이를 채우는 원리

```
html (h-full)
  └─ body (h-full, flex flex-col)
       └─ MainApp (h-full, flex flex-col)
            ├─ MonthSelector (고정 높이)
            ├─ main (flex-1 = 남은 공간 전부)
            └─ BottomNav (flexShrink:0 = 고정 높이)
```

`h-full`을 부모에서 자식으로 체인처럼 연결해야 전체 화면을 채울 수 있습니다.
하나라도 빠지면 화면이 내용 높이만큼만 차지하게 됩니다.

---

## React 핵심 개념 정리

### Props (프롭스)

부모 컴포넌트에서 자식 컴포넌트로 데이터를 전달하는 방법입니다.

```typescript
// 부모 (MainApp) — yearMonth 상태를 자식에게 전달
<HomeTab yearMonth={yearMonth} />

// 자식 (HomeTab) — props로 받아서 사용
export default function HomeTab({ yearMonth }: HomeTabProps) {
  // yearMonth를 이용해 해당 월 데이터 조회
}
```

### 상태 끌어올리기 (State Lifting)

여러 컴포넌트가 같은 데이터를 필요로 할 때,
그 상태를 **공통 부모 컴포넌트**로 끌어올려 관리하는 패턴입니다.

```
yearMonth 상태를 각 탭 안에서 따로 관리하면?
  → MonthSelector에서 바꿔도 HomeTab이 모름 (각자 다른 상태)

yearMonth 상태를 MainApp에서 관리하면?
  → MonthSelector가 바꾸면 모든 탭이 같은 값을 받음 ✅
```

### 조건부 렌더링

JavaScript의 `&&` 연산자로 조건에 따라 컴포넌트를 렌더링합니다.

```typescript
{showMonthSelector && <MonthSelector ... />}
// showMonthSelector가 true일 때만 MonthSelector 렌더링
// false이면 아무것도 렌더링하지 않음
```
