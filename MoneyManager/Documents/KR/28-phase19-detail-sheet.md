# Phase 19-1 — 거래 상세 시트 공통화 + 바텀시트 최소 높이 학습 문서

## 개요

Phase 19-1에서 구현한 두 가지 개선 사항을 코드와 함께 설명합니다.

1. **바텀시트 최소 높이 통일 (18-2)** — 콘텐츠가 적어도 시트가 작게 뜨지 않도록 `minHeight` 추가
2. **거래 상세 시트 공통 컴포넌트 분리 (18-3)** — 달력·통계 탭에서도 거래 클릭 시 상세/수정/삭제 가능

---

## 1. 바텀시트 최소 높이 (minHeight)

### 문제

기존 바텀시트에는 `maxHeight: '65vh'` 만 있었고 `minHeight`가 없었습니다.
거래가 1~2건뿐인 날에 달력 날짜 시트를 열면, 시트가 화면 하단에 아주 작게 뜨는 불편함이 있었습니다.

### 해결책

```tsx
style={{
  maxHeight: '65vh',
  minHeight: '66vh',   // 추가 — 항상 화면의 2/3 이상 차지
}}
```

`minHeight: '66vh'`를 추가해 콘텐츠가 적어도 시트가 화면의 약 2/3 높이를 유지합니다.

### 적용 대상

| 컴포넌트 | 위치 |
|---------|------|
| `TransactionForm` | FAB 거래 입력 폼 |
| `CalendarTab` | 날짜 상세 시트 |
| `TransactionDetailSheet` | 거래 상세/수정/삭제 시트 |
| `StatsTab` | 카테고리 상세 시트 |

---

## 2. 거래 상세 시트 공통 컴포넌트 분리

### 배경

Phase 14.3에서 `HomeTab.tsx` 안에 거래 상세 시트를 인라인으로 구현했습니다.
그런데 달력 탭(CalendarTab)과 통계 탭(StatsTab)에도 같은 기능이 필요해졌습니다.
세 군데 코드를 각각 관리하는 것은 유지보수가 어려우므로, 공통 컴포넌트로 추출했습니다.

### 컴포넌트 설계

```
TransactionDetailSheet.tsx
├── Props
│   ├── transaction: Transaction   (표시할 거래 데이터)
│   ├── onClose: () => void        (시트 닫기)
│   ├── onEdit: (tx) => void       (수정 버튼 → MainApp에서 TransactionForm 열기)
│   └── onDeleted: () => void      (삭제 완료 → 부모에서 목록 갱신)
└── 내부 상태
    ├── deleteConfirm: boolean     (삭제 확인 단계)
    ├── deleteLoading: boolean     (삭제 API 호출 중)
    └── deleteError: string        (삭제 실패 메시지)
```

### 코드 — 컴포넌트 뼈대

```tsx
// src/components/features/transaction/TransactionDetailSheet.tsx
export default function TransactionDetailSheet({
  transaction, onClose, onEdit, onDeleted,
}: TransactionDetailSheetProps) {

  const handleDelete = async () => {
    await deleteTransaction(transaction.id);
    onClose();
    onDeleted();   // 부모에서 refreshKey 증가 → 목록 갱신
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" ...>
      <div style={{ minHeight: '66vh' }} ...>
        {!deleteConfirm ? <상세보기 /> : <삭제확인 />}
      </div>
    </div>
  );
}
```

### z-index 설계

```
달력/통계 하위 시트 오버레이  z-40
달력/통계 하위 시트 본체      z-50
통계 탭 수입/지출 전환 탭     z-60
TransactionDetailSheet 오버레이 z-70  ← 모든 하위 시트 위에 표시
TransactionDetailSheet 본체    z-80
```

달력 날짜 시트(z-50) 안에서 거래를 클릭하면, TransactionDetailSheet(z-70)가 날짜 시트 위에 겹쳐 표시됩니다.

---

## 3. CalendarTab / StatsTab 변경 사항

### Props 확장

```tsx
// 기존
interface CalendarTabProps {
  yearMonth: string;
  refreshKey: number;
}

// 변경 후
interface CalendarTabProps {
  yearMonth: string;
  refreshKey: number;
  onEdit:    (tx: Transaction) => void;  // 추가
  onRefresh: () => void;                 // 추가
}
```

### 거래 행 클릭 처리

```tsx
// 기존 — 클릭 불가 (표시만)
<div className="flex items-center justify-between px-4 py-3 gap-3">

// 변경 후 — 클릭 시 상세 시트 열기
<div
  className="flex items-center justify-between px-4 py-3 gap-3
             cursor-pointer active:opacity-60 transition-opacity"
  onClick={() => setSelectedTx(tx)}
>
```

### TransactionDetailSheet 마운트

```tsx
{selectedTx && (
  <TransactionDetailSheet
    transaction={selectedTx}
    onClose={() => setSelectedTx(null)}
    onEdit={onEdit}
    onDeleted={() => {
      setSelectedTx(null);
      setSelectedDate(null);  // 날짜 시트도 닫기
      onRefresh();            // 달력 데이터 갱신
    }}
  />
)}
```

삭제 완료 시 `onDeleted`에서 날짜 시트까지 닫아줍니다. 상세 시트만 닫으면 날짜 시트가 남아서 이미 삭제된 거래가 잠깐 보이는 문제가 생기기 때문입니다.

---

## 4. MainApp 변경 사항

CalendarTab과 StatsTab이 새 props를 받도록 MainApp에서 전달합니다.

```tsx
// 기존
<CalendarTab yearMonth={yearMonth} refreshKey={refreshKey} />
<StatsTab    yearMonth={yearMonth} refreshKey={refreshKey} />

// 변경 후
<CalendarTab
  yearMonth={yearMonth}
  refreshKey={refreshKey}
  onEdit={setEditingTx}     // 수정 폼 열기
  onRefresh={handleSaved}   // refreshKey 증가
/>
<StatsTab
  yearMonth={yearMonth}
  refreshKey={refreshKey}
  onEdit={setEditingTx}
  onRefresh={handleSaved}
/>
```

`setEditingTx`는 MainApp에 이미 있던 상태 업데이트 함수입니다.
`editingTx`가 설정되면 MainApp 최하단에 수정 모드 `TransactionForm`이 열립니다.

---

## 5. React 컴포넌트 설계 원칙 — Props Drilling

이번 변경에서 **Props Drilling** 패턴을 적용했습니다.

```
MainApp
├── setEditingTx (상태 업데이트 함수)
└── handleSaved  (refreshKey 증가 함수)
      ↓ props로 전달
CalendarTab / StatsTab
      ↓ props로 전달
TransactionDetailSheet
```

- **Props Drilling**: 상위 컴포넌트의 상태나 함수를 여러 단계의 자식 컴포넌트로 내려 전달하는 방법
- 장점: 별도 상태 관리 라이브러리(Redux, Zustand 등) 없이 간단하게 구현 가능
- 단점: 컴포넌트 계층이 깊어질수록 코드가 번잡해짐 (이 경우 3단계 수준으로 적절함)

---

## 6. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| `minHeight` | 요소의 최소 높이. `maxHeight`와 함께 쓰면 콘텐츠 양에 관계없이 일정 범위 내 크기 유지 |
| `z-index` | 요소의 겹침 순서. 숫자가 클수록 앞에 표시. `fixed` position에서 효과 있음 |
| Props Drilling | 부모 → 자식 → 손자 순으로 데이터/함수를 props로 전달하는 패턴 |
| 컴포넌트 추출 | 반복되는 UI 블록을 별도 컴포넌트 파일로 분리해 재사용성과 유지보수성을 높이는 리팩터링 기법 |
