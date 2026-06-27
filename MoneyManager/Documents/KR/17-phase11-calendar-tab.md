# Phase 11 — 달력 탭 (CalendarTab)

## 개요

Phase 11에서 구현한 달력 탭의 핵심 개념들을 정리합니다.

---

## 1. 달력 그리드 생성 로직 (`buildCalendarCells`)

### 달력 그리드란?

월간 달력은 7열(일~토) 그리드입니다. 1일이 무슨 요일인지에 따라 앞쪽에 빈 셀을 채워넣고, 말일 이후에도 빈 셀을 추가해서 7의 배수가 되도록 맞춥니다.

```
일  월  화  수  목  금  토
              1   2   3   4   5   6
 7   8   9  10  11  12  13
...
```

### 핵심 코드

```typescript
function buildCalendarCells(yearMonth: string, today: string): CalendarCell[] {
  const [y, m] = yearMonth.split('-').map(Number);

  // 1일의 요일: 0=일요일, 1=월요일, ..., 6=토요일
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();

  // 말일: new Date(y, m, 0)은 "다음 달 0일" = "이번 달 마지막 날"
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells: CalendarCell[] = [];

  // 1일 이전 빈 셀 채우기 (일요일부터 시작하므로)
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, dateStr: null, isToday: false });
  }

  // 날짜 셀 추가
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isToday: dateStr === today });
  }

  // 말일 이후 빈 셀 채우기 (7의 배수 맞추기)
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ day: null, dateStr: null, isToday: false });
    }
  }

  return cells;
}
```

### 왜 `new Date(y, m, 0)` 인가?

`new Date(y, m, 0)` 는 JavaScript의 특수한 패턴입니다.
- `new Date(2026, 6, 0)` → 7월(인덱스 6)의 0일 → **6월 30일**
- 즉, 다음 달의 0일 = 이번 달의 마지막 날

---

## 2. 금액 단축 표기 (`formatYenShort`)

달력 셀의 가로 폭이 좁으므로(화면 1/7) 금액을 만/천 단위로 축약합니다.

```typescript
function formatYenShort(amount: number): string {
  if (amount >= 10000) {
    const man = amount / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  if (amount >= 1000) {
    const sen = amount / 1000;
    return `${Number.isInteger(sen) ? sen : sen.toFixed(1)}千`;
  }
  return `¥${amount}`;
}
```

| 금액 | 표시 | 설명 |
|---|---|---|
| ¥250,000 | `25万` | 25 × 10,000 |
| ¥15,000 | `1.5万` | 1.5 × 10,000 |
| ¥5,000 | `5千` | 5 × 1,000 |
| ¥1,500 | `1.5千` | 1.5 × 1,000 |
| ¥800 | `¥800` | 1,000 미만은 그대로 |

---

## 3. 날짜별 요약 Map 생성

API에서 받은 거래 목록을 날짜별로 집계합니다.
`Map<날짜문자열, { totalIncome, totalExpense, transactions[] }>`

```typescript
const summaryMap = new Map<string, DaySummary>();

for (const tx of transactions) {
  if (!summaryMap.has(tx.date)) {
    summaryMap.set(tx.date, { totalIncome: 0, totalExpense: 0, transactions: [] });
  }
  const s = summaryMap.get(tx.date)!;
  s.transactions.push(tx);

  if (tx.type === 'income') s.totalIncome += tx.amount;
  else                      s.totalExpense += tx.amount;
}
```

- **Map**은 `{key: value}` 형태의 자료구조입니다.
- `has()` → 키가 있는지 확인, `get()` → 값 읽기, `set()` → 값 쓰기
- 달력 셀 렌더링 시 `summaryMap.get(cell.dateStr)` 로 해당 날짜의 요약을 가져옵니다.

---

## 4. 날짜 클릭 → 바텀시트 (Bottom Sheet)

### 상태 관리

```typescript
const [selectedDate, setSelectedDate] = useState<string | null>(null);
// null 이면 바텀시트 닫힘
// "2026-06-18" 이면 해당 날짜의 바텀시트 열림
```

### 날짜 버튼 클릭 시

```typescript
onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
```

- `isSelected = (selectedDate === cell.dateStr)` — 현재 선택된 날짜인지 여부
- 이미 선택된 날짜를 다시 클릭하면 `null`로 닫힘 (토글)
- **단, 실제 UI에서는 바텀시트 오버레이가 달력 위를 덮기 때문에** 동일 날짜 재클릭으로 닫는 것은 불가능합니다. ✕ 버튼 또는 오버레이 클릭으로 닫습니다.

### 바텀시트 구조

```
┌────────────────────────────────────┐
│         ────  (핸들 바)             │
│  6월 18일 (목)              ✕      │
│────────────────────────────────────│
│  [ 급여 ]              +¥250,000   │
│────────────────────────────────────│
│  [ 기타 ]  주유비 결제   -¥1,500   │
└────────────────────────────────────┘
```

### 오버레이 레이어 구조

```
화면
├── 달력 그리드 (기본 레이어)
├── 오버레이 (fixed inset-0 z-40, 반투명 검정)  ← 클릭 시 닫힘
└── 바텀시트 (fixed bottom-0 z-50)              ← 항상 최상단
```

- `z-40` 오버레이가 달력을 덮어서 클릭 차단
- `z-50` 바텀시트가 오버레이 위에 표시

---

## 5. CSS: `grid-cols-7`로 달력 그리드 만들기

```tsx
{/* 요일 헤더 */}
<div className="grid grid-cols-7 mb-1">
  {['일', '월', '화', '수', '목', '금', '토'].map(label => (
    <div key={label} className="text-center text-xs">{label}</div>
  ))}
</div>

{/* 날짜 그리드 */}
<div className="grid grid-cols-7 gap-y-1">
  {cells.map((cell, idx) => (
    <button key={idx} ...>
      {cell.day}
    </button>
  ))}
</div>
```

- `grid-cols-7`: 7열 그리드 레이아웃 (각 셀 너비 = 1/7)
- `gap-y-1`: 행 간 세로 간격 4px
- `min-h-[58px]`: 각 셀 최소 높이 58px (날짜 숫자 + 금액 레이블 공간 확보)

---

## 6. 오늘/선택/일요일/토요일 색상 처리

달력에서는 날짜 셀의 상태에 따라 배경색과 글자색이 다르게 적용됩니다.

| 상태 | 배경색 | 글자색 |
|---|---|---|
| 선택됨 | `var(--accent)` (보라) | 흰색 |
| 오늘 (미선택) | `rgba(99,102,241,0.18)` (반투명 보라) | `var(--accent)` (보라) |
| 일반 | 없음 | `var(--text-primary)` |
| 일요일 | 없음 | `var(--expense)` (빨강) |
| 토요일 | 없음 | `#6fa8dc` (파랑) |

### 열 인덱스로 요일 판별

```typescript
const colIndex = idx % 7; // 전체 배열 인덱스를 7로 나눈 나머지
const isSunday   = colIndex === 0; // 0번째 열 = 일요일
const isSaturday = colIndex === 6; // 6번째 열 = 토요일
```

---

## 7. `data-date` 속성과 E2E 테스트 셀렉터

달력 버튼의 accessible name은 "18 25万 -1.5千" 처럼 날짜 + 금액이 합쳐집니다.
`getByRole('button', { name: '18', exact: true })` 로는 찾을 수 없습니다.

그래서 버튼에 `data-date` 속성을 추가합니다:

```tsx
<button
  data-date={cell.dateStr}  // "2026-06-18"
  ...
>
```

테스트에서는:

```typescript
// 특정 날짜 셀을 정확하게 찾을 수 있음
await page.locator('[data-date="2026-06-18"]').click();
await page.locator(`[data-date="${TODAY}"]`).click();
```

이 패턴은 "테스트를 위한 HTML 속성"의 대표적인 사용 예입니다.
`aria-label` 과 달리 UX에 영향을 주지 않으면서도 셀렉터를 안정적으로 만들 수 있습니다.

---

## 8. Phase 11에서 사용한 주요 기술 패턴 요약

| 패턴 | 설명 |
|---|---|
| `buildCalendarCells()` | 요일 계산 → 빈 셀 + 날짜 셀 배열 생성 |
| `new Date(y, m, 0)` | 해당 달 말일 구하는 JavaScript 트릭 |
| `Map<string, DaySummary>` | 날짜별 거래 집계 |
| `selectedDate` 상태 | null=닫힘, 날짜문자열=바텀시트 열림 |
| `fixed inset-0 z-40/50` | 오버레이 + 바텀시트 레이어 구조 |
| `grid-cols-7` | Tailwind 7열 그리드 달력 |
| `data-date` 속성 | E2E 테스트용 날짜 셀 식별자 |
| `cancelled` 플래그 | useEffect 클린업 (Phase 10과 동일 패턴) |
| `refreshKey` 의존성 | 거래 저장 후 달력 자동 갱신 (Phase 10과 동일) |
