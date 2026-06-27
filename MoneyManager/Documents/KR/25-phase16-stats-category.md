# Phase 16 — 통계 탭 카테고리 상세 바텀시트 학습 문서

## 개요

Phase 16에서 구현한 기능을 코드와 함께 설명합니다.

- **카테고리 행 클릭 → 바텀시트** — 해당 카테고리의 개별 거래 목록을 하단 슬라이드업 패널로 표시
- **수입/지출 탭 전환 시 시트 자동 닫힘** — 탭 컨텍스트가 바뀌면 이전 선택 해제
- **z-index 계층 조정** — 오버레이 위에서도 탭 토글 버튼 클릭 가능하도록 수정

---

## 1. 상태 구조

```tsx
// StatsTab.tsx
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [dragOffset,       setDragOffset]        = useState(0);
const [isDragging,       setIsDragging]        = useState(false);
const dragStartY = useRef(0);
const sheetRef   = useRef<HTMLDivElement>(null);
```

`selectedCategory`가 `null`이면 시트가 닫혀 있고, 문자열값이면 해당 카테고리의 시트가 열립니다.
CalendarTab의 `selectedDate`와 동일한 패턴입니다.

---

## 2. 탭 전환 시 시트 자동 닫힘

```tsx
useEffect(() => {
  setSelectedCategory(null); // 탭이 바뀌면 열려 있던 시트 닫기
}, [activeTab]);
```

수입 탭에서 "급여" 카테고리 시트를 열고 지출 탭으로 전환하면 자동으로 닫힙니다.
이것이 없으면 지출 탭에서 수입 카테고리 목록이 그대로 보이는 버그가 생깁니다.

---

## 3. 카테고리별 거래 목록 계산

```tsx
const selectedTransactions = useMemo(() => {
  if (!selectedCategory) return [];

  const rows = activeTab === 'expense' ? expenseRows : incomeRows;
  const row  = rows.find(r => r.category === selectedCategory);
  if (!row) return [];

  // 날짜 내림차순 → 같은 날짜면 createdAt 내림차순
  return [...row.transactions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const aTs = (a.createdAt as { _seconds: number } | undefined)?._seconds ?? 0;
    const bTs = (b.createdAt as { _seconds: number } | undefined)?._seconds ?? 0;
    return bTs - aTs;
  });
}, [selectedCategory, activeTab, expenseRows, incomeRows]);
```

`useMemo`로 감싸 `selectedCategory`나 `activeTab`이 바뀔 때만 재계산합니다.
`[...row.transactions]`로 원본 배열을 복사한 뒤 정렬합니다 (원본 불변 유지).

---

## 4. z-index 계층 — 탭 토글이 오버레이 위에 있어야 하는 이유

처음 구현 시 수입/지출 토글 탭의 z-index가 `z-10`이었습니다.
바텀시트 오버레이를 `z-40`으로 열자 탭 버튼이 오버레이에 가려져 클릭이 안 됐습니다.

```
z-[60]  ← 수입/지출 토글 탭 (항상 클릭 가능해야 함)
z-50    ← 바텀시트 본체
z-40    ← 반투명 오버레이
z-10    ← 일반 콘텐츠
```

```tsx
{/* sticky top-0 z-[60]: 오버레이(z-40)·시트(z-50) 위에 위치해야 탭 전환 가능 */}
<div className="flex border-b sticky top-0 z-[60]" ...>
```

`z-50`과 `z-60` 사이 정수를 쓰려면 Tailwind 기본 클래스(`z-50`, `z-60`)가 없으므로
`z-[60]`처럼 대괄호로 임의값을 지정합니다 (JIT 모드).

---

## 5. 날짜 포맷 헬퍼

```tsx
// "2026-06-18" → "6월 18일 (수)"
function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00'); // 시간대 오차 방지용 T00:00:00
  const month   = date.getMonth() + 1;
  const day     = date.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}
```

`new Date('2026-06-18')`는 UTC 자정으로 파싱되어 JST(UTC+9)에서 하루 앞당겨지는 문제가 있습니다.
`T00:00:00`을 붙이면 로컬 타임존 자정으로 파싱되어 날짜가 정확합니다.

---

## 6. 바텀시트 구조 — 오버레이 + 시트

```tsx
{selectedCategory && (
  <>
    {/* 반투명 배경 — 클릭 시 닫기 */}
    <div
      className="fixed inset-0 z-40"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={closeSheet}
    />

    {/* 시트 본체 */}
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col"
      style={{
        backgroundColor: 'var(--bg-card)',
        maxHeight: '65vh',
        transform: `translateY(${dragOffset}px)`,
      }}
    >
      {/* 핸들 바 */}
      <div className="flex justify-center pt-3 pb-1 cursor-grab"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
      </div>

      {/* 헤더 */}
      {/* 거래 목록 */}
    </div>
  </>
)}
```

`fixed inset-0`으로 오버레이가 전체 화면을 덮고, 시트는 `fixed bottom-0`으로 하단에 붙습니다.
`maxHeight: '65vh'`로 화면의 65%를 넘지 않도록 제한합니다.

---

## 7. 드래그로 닫기 (Pointer Events)

```tsx
const DISMISS_THRESHOLD = 100; // 100px 이상 아래로 드래그하면 닫힘

const handleDragStart = (e: React.PointerEvent) => {
  dragStartY.current = e.clientY;
  setIsDragging(true);
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
};

const handleDragMove = (e: React.PointerEvent) => {
  if (!isDragging) return;
  const delta = e.clientY - dragStartY.current;
  if (delta > 0) setDragOffset(delta); // 아래 방향만 허용
};

const handleDragEnd = () => {
  setIsDragging(false);
  if (dragOffset >= DISMISS_THRESHOLD) {
    closeSheet(); // 임계값 초과 → 닫기
  } else {
    setDragOffset(0); // 미달 → 원위치 스냅백
  }
};
```

`setPointerCapture`는 포인터가 요소 밖으로 나가도 이벤트를 계속 받도록 합니다.
마우스를 빠르게 움직여도 드래그가 끊기지 않습니다.
위 방향(delta < 0)은 무시해서 시트를 더 위로 올리는 동작을 막습니다.

---

## 8. iOS Pull-to-Refresh 방지

```tsx
useEffect(() => {
  if (!selectedCategory) return;

  // iOS Safari의 Pull-to-Refresh 비활성화
  document.body.style.overscrollBehavior = 'none';

  // 시트 밖의 touchmove는 막고, 시트 안은 허용
  const prevent = (e: TouchEvent) => {
    if (sheetRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', prevent, { passive: false });

  return () => {
    document.body.style.overscrollBehavior = '';
    document.removeEventListener('touchmove', prevent);
  };
}, [selectedCategory]);
```

`overscrollBehavior = 'none'`만으로는 iOS Safari에서 완전히 막히지 않아
`touchmove preventDefault`를 함께 사용합니다.
클린업 함수에서 두 설정을 모두 복원해야 다른 시트에서 정상 스크롤이 됩니다.

---

## 9. 메모 표시 조건

```tsx
{/* 메모가 카테고리 이름과 다를 때만 표시 */}
{tx.memo && tx.memo !== tx.category && (
  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
    {tx.memo}
  </span>
)}
```

"식비"라는 카테고리에 메모도 "식비"로 입력한 경우 중복 표시를 피하기 위해
메모 값이 카테고리 이름과 다를 때만 렌더링합니다.

---

## 정리

| 구현 포인트 | 핵심 |
|---|---|
| 상태 관리 | `selectedCategory: string \| null` — CalendarTab의 `selectedDate`와 동일 패턴 |
| 탭 전환 자동 닫힘 | `useEffect(() => setSelectedCategory(null), [activeTab])` |
| z-index 계층 | 탭 토글 `z-[60]` > 시트 `z-50` > 오버레이 `z-40` |
| 날짜 파싱 | `new Date(str + 'T00:00:00')` — 시간대 오차 방지 |
| 드래그 닫기 | `setPointerCapture` + DISMISS_THRESHOLD 100px |
| iOS 스크롤 방지 | `overscrollBehavior + touchmove preventDefault` 세트로 사용 |
