# Phase 14.3 — 홈 탭 거래 내역 UX 개선 학습 문서

## 개요

Phase 14.3에서 구현한 4가지 기능을 코드와 함께 설명합니다.

1. **날짜 헤더 구분선** — 헤더와 항목 사이 시각적 경계
2. **날짜별 순수익 표시** — 수입 + 지출이 모두 있는 날에 순수익 계산
3. **거래 항목 클릭 → 상세 시트** — 하단에서 슬라이드업되는 상세 정보 패널
4. **거래 수정 / 삭제** — TransactionForm 재사용한 수정 + 삭제 확인 2단계

---

## 1. 날짜 헤더 구분선 (border-b)

```tsx
<div
  className="flex justify-between items-center px-1 pb-1 mb-1"
  style={{ borderBottom: '1px solid var(--border)' }}
>
  <span>{formatDateHeader(group.date)}</span>
  <div>{/* 소계 */}</div>
</div>
```

`border-b` Tailwind 클래스 대신 인라인 스타일로 CSS 변수 `--border`를 참조합니다.
CSS 변수는 다크 테마 전환 시 자동으로 값이 바뀌므로 하드코딩된 색상보다 안전합니다.

---

## 2. 날짜별 순수익 표시

```tsx
const net = group.totalIncome - group.totalExpense;

{/* 수입과 지출이 모두 있을 때만 표시 */}
{group.totalIncome > 0 && group.totalExpense > 0 && (
  <span style={{ color: net >= 0 ? 'var(--income)' : 'var(--expense)' }}>
    ={formatYen(Math.abs(net))}
  </span>
)}
```

두 조건 `totalIncome > 0 && totalExpense > 0` 을 모두 만족해야 표시합니다.
하나만 있는 날(지출만 or 수입만)은 이미 소계에서 명확히 보이므로 순수익이 불필요합니다.

---

## 3. 거래 항목 클릭 — 상세 시트

### 상태 구조

```tsx
const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
const [deleteConfirm, setDeleteConfirm] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);
const [deleteError,   setDeleteError]   = useState('');
```

`selectedTx`가 null이면 시트 없음, 값이 있으면 시트 표시.
내부에서 `deleteConfirm`으로 상세 보기 ↔ 삭제 확인 단계를 전환합니다.

### 클릭 핸들러

```tsx
<div
  className="... cursor-pointer active:opacity-60 transition-opacity"
  onClick={() => {
    setSelectedTx(tx);
    setDeleteConfirm(false);
    setDeleteError('');
  }}
>
```

`active:opacity-60`: 터치 시 시각적 피드백 (모바일 탭 효과).

### 시트 레이아웃

```tsx
{selectedTx && (
  <div
    className="fixed inset-0 z-50 flex flex-col justify-end"
    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    onClick={closeDetail}   {/* 오버레이 클릭 → 닫기 */}
  >
    <div
      ref={detailSheetRef}
      className="rounded-t-2xl w-full max-w-md self-center"
      onClick={e => e.stopPropagation()}  {/* 시트 내부 클릭 버블링 차단 */}
    >
      ...
    </div>
  </div>
)}
```

`fixed inset-0` — 뷰포트 전체를 덮는 반투명 오버레이.
`justify-end` — 시트를 화면 하단에 배치.
`stopPropagation()` — 시트 내부 클릭이 오버레이 닫기 이벤트로 전파되지 않도록 차단.

### iOS Safari 배경 스크롤 차단

```tsx
const detailSheetRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!selectedTx) return;
  const prevent = (e: TouchEvent) => {
    if (detailSheetRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', prevent, { passive: false });
  return () => document.removeEventListener('touchmove', prevent);
}, [selectedTx]);
```

iOS Safari는 `overflow: hidden`만으로는 배경 스크롤이 차단되지 않습니다.
`document`에 `{ passive: false }` 옵션으로 touchmove 리스너를 등록하고
`e.preventDefault()`를 호출해야 배경 스크롤이 막힙니다.
시트 내부(`detailSheetRef.current?.contains`)는 예외처리해 시트 내 스크롤은 허용합니다.

---

## 4. 거래 수정 — TransactionForm 재사용

### Props 확장 (TransactionForm)

```tsx
interface TransactionFormProps {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Transaction;  // 수정 모드일 때 주입
}

const isEdit = !!initialData?.id;
const [amount, setAmount] = useState(
  initialData?.amount ? String(initialData.amount) : ''
);
```

`initialData`가 있으면 수정 모드, 없으면 추가 모드.
상태 초기값을 `initialData`에서 읽어오는 방식으로 기존 데이터를 폼에 채웁니다.

### 저장 분기

```tsx
if (isEdit && initialData?.id) {
  await updateTransaction(initialData.id, data);  // PUT
} else {
  await createTransaction(data);                   // POST
}
```

### MainApp에서 수정 폼 열기

```tsx
// 수정할 거래 상태
const [editingTx, setEditingTx] = useState<Transaction | null>(null);

// HomeTab에 콜백 전달
<HomeTab onEdit={setEditingTx} ... />

// 수정 폼 렌더링
{editingTx && (
  <TransactionForm
    initialData={editingTx}
    onClose={() => setEditingTx(null)}
    onSaved={() => { setEditingTx(null); handleSaved(); }}
  />
)}
```

`onSaved`에서 `editingTx`를 null로 초기화 후 `handleSaved()`로 목록도 갱신합니다.

---

## 5. 거래 삭제 — 2단계 확인

### 흐름

```
[삭제] 버튼 클릭
  → setDeleteConfirm(true) → 확인 화면으로 전환
    → [취소]: setDeleteConfirm(false) → 상세 보기 복귀
    → [삭제]: DELETE /transactions/:id 호출
      → 성공: closeDetail() + onRefresh()
      → 실패: deleteError 표시
```

### 삭제 핸들러

```tsx
const handleDelete = async () => {
  if (!selectedTx?.id) return;
  setDeleteLoading(true);
  setDeleteError('');
  try {
    await deleteTransaction(selectedTx.id);
    closeDetail();   // 시트 닫기
    onRefresh();     // 목록 갱신 (refreshKey++)
  } catch {
    setDeleteError('삭제에 실패했습니다. 다시 시도해 주세요.');
  } finally {
    setDeleteLoading(false);
  }
};
```

---

## 6. HomeTab Props 확장 — MainApp과의 통신

```tsx
interface HomeTabProps {
  yearMonth: string;
  refreshKey: number;
  onRefresh: () => void;   // 삭제 완료 → MainApp refreshKey++
  onEdit: (tx: Transaction) => void;  // 수정 클릭 → MainApp editingTx 설정
}
```

### MainApp hasModal 로직

```tsx
const hasModal = showForm || !!editingTx;

<main className={`flex-1 flex flex-col ${hasModal ? 'overflow-hidden' : 'overflow-y-auto'}`}>
```

추가 폼(`showForm`)과 수정 폼(`editingTx`) 중 하나라도 열려 있으면
배경 스크롤을 차단합니다.

---

## 7. E2E 테스트 — route.fallback() 패턴

Phase 14.3에서 DELETE 요청을 모킹할 때 `route.fallback()` 패턴을 사용했습니다.

```typescript
// beforeEach에서 mockTransactions가 **/transactions* 를 먼저 등록
// 개별 테스트에서 DELETE 모킹을 나중에 등록 → LIFO 우선순위로 먼저 실행
await page.route('**/transactions/**', route => {
  if (route.request().method() === 'DELETE') {
    return route.fulfill({ status: 204 });
  }
  route.fallback(); // GET 등 다른 메서드 → 이전 핸들러(mockTransactions)에 위임
});
```

### route.continue() vs route.fallback()

| | `route.continue()` | `route.fallback()` |
|---|---|---|
| 동작 | 실제 네트워크로 요청 전달 | 다음 등록된 Playwright 핸들러로 전달 |
| 사용 시점 | 실서버에 요청을 보내야 할 때 | 다른 mock 핸들러에 위임할 때 |
| 가용 버전 | 전 버전 | Playwright 1.23+ |

---

## 정리

| 기능 | 핵심 기술 | 파일 |
|---|---|---|
| 날짜 헤더 구분선 | CSS 변수 `--border` 인라인 스타일 | `HomeTab.tsx` |
| 순수익 표시 | 조건부 렌더링 (수입 > 0 && 지출 > 0) | `HomeTab.tsx` |
| 상세 시트 | `fixed inset-0 z-50` + stopPropagation | `HomeTab.tsx` |
| iOS 스크롤 차단 | touchmove `preventDefault` + `passive: false` | `HomeTab.tsx` |
| 거래 수정 | `initialData?: Transaction` prop + PUT 분기 | `TransactionForm.tsx` |
| 거래 삭제 | 2단계 확인 + DELETE API | `HomeTab.tsx` |
| hasModal 로직 | `showForm \|\| !!editingTx` | `MainApp.tsx` |
| E2E DELETE 모킹 | `route.fallback()` LIFO 패턴 | `home-tab.spec.ts` |
