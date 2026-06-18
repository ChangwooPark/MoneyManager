# Phase 12 — 통계 탭 (StatsTab)

## 개요

Phase 12에서 구현한 통계 탭의 핵심 개념들을 정리합니다.

---

## 1. 카테고리별 집계 (`aggregateByCategory`)

### 무엇을 하는 함수인가?

API에서 받은 거래 목록을 받아 수입 또는 지출만 추려내고, 카테고리 단위로 **건수**와 **합계 금액**을 계산합니다. 그 결과를 금액 기준으로 정렬한 배열로 반환합니다.

### 처리 흐름

```
transactions (전체 목록)
    ↓ filter (income 또는 expense만 추출)
filtered
    ↓ for..of 순회 → Map에 카테고리별 누적
Map<category, { count, total }>
    ↓ Map.values() → Array
rows[]
    ↓ sort (금액 오름차순 or 내림차순)
정렬된 CategoryRow[]
```

### 핵심 코드

```typescript
// 집계 결과를 담는 타입: 카테고리명, 건수, 합계 금액
interface CategoryRow {
  category: string;
  count: number;
  total: number;
}

function aggregateByCategory(
  transactions: Transaction[],
  type: 'income' | 'expense',
  sortDir: 'desc' | 'asc',
): CategoryRow[] {
  // 1. 타입 필터
  const filtered = transactions.filter(tx => tx.type === type);

  // 2. Map으로 카테고리별 집계
  const map = new Map<string, CategoryRow>();
  for (const tx of filtered) {
    if (!map.has(tx.category)) {
      map.set(tx.category, { category: tx.category, count: 0, total: 0 });
    }
    const row = map.get(tx.category)!;
    row.count += 1;
    row.total += tx.amount;
  }

  // 3. 배열 변환 + 정렬
  const rows = Array.from(map.values());
  rows.sort((a, b) =>
    sortDir === 'desc' ? b.total - a.total : a.total - b.total
  );

  return rows;
}
```

---

## 2. Map으로 카테고리 집계하기

### Map이란?

`Map`은 JavaScript의 자료구조입니다. 일반 객체(`{}`)와 비슷하지만 키로 어떤 타입이든 사용할 수 있고, 삽입 순서를 기억합니다.

| 메서드 | 역할 | 예시 |
|---|---|---|
| `map.has(key)` | 키가 존재하는지 확인 | `map.has('식비')` → true/false |
| `map.get(key)` | 키에 해당하는 값 읽기 | `map.get('식비')` → CategoryRow |
| `map.set(key, val)` | 키-값 쌍 저장 | `map.set('식비', { count: 0, total: 0 })` |
| `map.values()` | 모든 값의 이터레이터 | `Array.from(map.values())` → 배열 |

### 왜 `if (!map.has(tx.category))` 패턴을 사용하는가?

처음 등장하는 카테고리면 초기값(0, 0)으로 설정하고, 이미 있으면 건너뜁니다. 그 다음 `map.get()` 으로 불러와서 값을 누적합니다.

```typescript
// 처음 등장한 카테고리 → 초기값 생성
if (!map.has(tx.category)) {
  map.set(tx.category, { category: tx.category, count: 0, total: 0 });
}

// 이미 있든 없었든, get()으로 불러와 누적
const row = map.get(tx.category)!;
row.count += 1;
row.total += tx.amount;
```

`!` (Non-null assertion): `map.get()`은 `CategoryRow | undefined`를 반환합니다. 직전에 `set()`으로 반드시 존재하도록 보장했으므로 `!`로 undefined를 제거합니다.

---

## 3. 상태 설계 — 탭 전환과 정렬 방향

```typescript
// 현재 탭: 'income'(수입) 또는 'expense'(지출)
const [activeTab, setActiveTab] = useState<TabType>('expense');

// 정렬 방향: 'desc'(내림차순, 기본) 또는 'asc'(오름차순)
const [sortDir, setSortDir] = useState<SortDir>('desc');
```

### 탭 전환 구현

```tsx
{(['expense', 'income'] as TabType[]).map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    style={{
      // 선택된 탭만 색상 강조
      color: activeTab === tab
        ? (tab === 'income' ? 'var(--income)' : 'var(--expense)')
        : 'var(--text-secondary)',
      // 하단 밑줄: 선택된 탭만 표시
      borderBottom: activeTab === tab
        ? `2px solid ${tab === 'income' ? 'var(--income)' : 'var(--expense)'}`
        : '2px solid transparent',
    }}
  >
    {tab === 'income' ? '수입' : '지출'}
  </button>
))}
```

**`'2px solid transparent'` 를 쓰는 이유**: `borderBottom: 'none'` 을 쓰면 탭 전환 시 레이아웃이 흔들립니다. 투명한 테두리를 미리 확보해두면 선택/비선택 시 레이아웃이 동일하게 유지됩니다.

### 정렬 토글 구현

```tsx
// 현재 방향의 반대로 전환
setSortDir(d => d === 'desc' ? 'asc' : 'desc')
```

`prev => next` 함수형 업데이트 패턴: 현재 상태(`d`)를 받아서 새 상태를 반환합니다. 외부 변수를 참조하지 않아 항상 최신 상태 기준으로 안전하게 토글됩니다.

---

## 4. 비율 게이지 바

### 게이지 바란?

각 카테고리가 전체 지출/수입 중 몇 %를 차지하는지 시각적으로 보여주는 가로 막대입니다.

```tsx
{/* 컨테이너: 전체 너비, 회색 배경 */}
<div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
  {/* 채워진 부분: 비율만큼 너비 설정 */}
  <div
    className="h-full rounded-full"
    style={{
      width: grandTotal > 0
        ? `${(row.total / grandTotal) * 100}%`
        : '0%',
      backgroundColor: activeTab === 'income' ? 'var(--income)' : 'var(--expense)',
    }}
  />
</div>
```

- `row.total / grandTotal * 100` : 해당 카테고리 비율(%)
- `grandTotal > 0` 조건: 분모가 0이면 `NaN%` 가 되므로 방어 처리

### 비율 텍스트 (Math.round)

```typescript
`${Math.round((row.total / grandTotal) * 100)}%`
// 예: 30000 / 49000 * 100 = 61.22... → 61%
```

`Math.round()`: 소수점 반올림. `61.22%` 대신 `61%` 처럼 깔끔하게 표시합니다.

---

## 5. grandTotal 계산

```typescript
// reduce: 배열의 모든 항목을 하나의 값으로 합산
const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
const grandCount = rows.reduce((sum, r) => sum + r.count, 0);
```

`reduce(callback, initialValue)`:
- `sum`: 누적값 (처음에는 0)
- `r`: 현재 항목
- 매 호출마다 `sum + r.total`을 다음 `sum`으로 전달
- 예) `[30000, 15000, 4000]` → `0 + 30000 + 15000 + 4000 = 49000`

---

## 6. 조건부 렌더링 구조

StatsTab의 렌더링은 세 단계로 분기됩니다:

```tsx
{/* 1. 로딩 중 */}
{loading && <p>불러오는 중...</p>}

{/* 2. 오류 발생 */}
{!loading && error && <p>{error}</p>}

{/* 3. 데이터 정상 */}
{!loading && !error && (
  <>
    {rows.length === 0 ? (
      // 3-1. 해당 탭에 거래 없음
      <p>이번 달 지출 내역이 없습니다.</p>
    ) : (
      // 3-2. 카테고리 목록 표시
      <카테고리 목록 />
    )}
  </>
)}
```

이 패턴은 **HomeTab**, **CalendarTab** 등에서도 동일하게 사용됩니다.

---

## 7. Phase 12에서 사용한 주요 기술 패턴 요약

| 패턴 | 설명 |
|---|---|
| `Map<string, CategoryRow>` | 카테고리별 집계 (has/get/set) |
| `Array.from(map.values())` | Map → 배열 변환 |
| `rows.sort((a, b) => b.total - a.total)` | 내림차순 정렬 |
| `setSortDir(d => d === 'desc' ? 'asc' : 'desc')` | 함수형 업데이트로 토글 |
| `borderBottom: '2px solid transparent'` | 레이아웃 흔들림 없는 탭 밑줄 |
| `Math.round(비율 * 100)` | 정수 % 표기 |
| `grandTotal > 0 ? % : '0%'` | 분모 0 방어 처리 |
| `rows.reduce((sum, r) => sum + r.total, 0)` | 배열 합산 |
