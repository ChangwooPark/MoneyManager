# Phase 9: 거래 내역 입력 폼

## 이 단계에서 한 일

앱에서 수입/지출 내역을 입력하는 폼을 구현했습니다.  
화면 우하단의 FAB(Floating Action Button) `+` 버튼을 누르면  
하단에서 슬라이드업 되는 바텀 시트(Bottom Sheet) 형태의 입력 폼이 열립니다.

---

## 구현 화면 구조

```
┌─────────────────────────┐
│      MonthSelector       │
├─────────────────────────┤
│                         │
│      탭 컨텐츠          │
│                         │
│                   [+]   │  ← FAB 버튼 (우하단 고정)
├─────────────────────────┤
│  🏠    📅    📊    ⋯   │
└─────────────────────────┘

            ↓ FAB 클릭

┌─────────────────────────┐
│  어두운 오버레이         │  ← 클릭 시 폼 닫힘
├──────────────────────── ┤
│  ────── (핸들바)         │
│  내역 추가          ✕   │
│                         │
│  [ 지출 ]  [  수입  ]   │  ← 토글
│                         │
│  날짜: [2026-06-17    ] │
│  내용: [점심 식사      ] │
│  금액: [¥ 1500  ¥1,500] │
│  메모: [선택 입력      ] │
│                         │
│  [       저장       ]   │
└─────────────────────────┘
```

---

## 생성/수정된 파일

### `src/components/features/transaction/TransactionForm.tsx` (신규)

거래 내역 입력 바텀 시트 컴포넌트입니다.

**Props:**

```typescript
interface TransactionFormProps {
  onClose: () => void;  // 취소 또는 저장 완료 후 폼 닫기
  onSaved: () => void;  // 저장 성공 시 부모에게 알려 목록 갱신
}
```

**주요 상태:**

| 상태 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `type` | `'income' \| 'expense'` | `'expense'` | 수입/지출 구분 |
| `date` | `string` | 오늘 날짜 | YYYY-MM-DD 형식 |
| `category` | `string` | `''` | 내용(필수) |
| `amount` | `string` | `''` | 금액, 문자열로 관리 후 저장 시 숫자 변환 |
| `memo` | `string` | `''` | 메모(선택) |
| `loading` | `boolean` | `false` | 저장 중 버튼 비활성화 |
| `error` | `string` | `''` | 유효성 검사 오류 표시 |

**저장 처리 흐름:**

```
1. 유효성 검사: category 비어있음 → 오류 표시
                amount ≤ 0    → 오류 표시

2. createTransaction(data) 호출 → 백엔드 POST /transactions

3. 성공: onSaved() → 목록 갱신
         onClose() → 폼 닫기

4. 실패: 오류 메시지 표시
```

**금액 입력 처리:**

```typescript
const handleAmountChange = (value: string) => {
  // 숫자가 아닌 문자는 필터링 (정규식)
  if (value === '' || /^\d+$/.test(value)) {
    setAmount(value);
  }
};
```

- `inputMode="numeric"`: 모바일에서 숫자 키패드 표시
- 입력 중 오른쪽에 `¥12,000` 형식으로 미리보기 표시

**수입/지출 토글 색상:**

```typescript
const accentColor = type === 'income' ? 'var(--income)' : 'var(--expense)';
// 수입: #34d399 (초록)
// 지출: #f87171 (빨강)
```

토글 버튼, ¥ 기호, 금액 미리보기, 저장 버튼이 모두 같은 색으로 변합니다.

---

### `src/components/MainApp.tsx` (수정)

**추가된 상태:**

```typescript
// 거래 입력 폼 표시 여부
const [showForm, setShowForm] = useState(false);

// 저장 완료 시 +1 증가 → HomeTab 목록 재조회 트리거
const [refreshKey, setRefreshKey] = useState(0);
```

**추가된 FAB 버튼:**

```tsx
<button
  onClick={() => setShowForm(true)}
  className="absolute bottom-20 right-4 w-14 h-14 rounded-full ..."
  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
>
  +
</button>
```

- `absolute bottom-20 right-4`: 탭바 위 우하단에 배치
- `bottom-20 (80px)`: 탭바(64px) + 여유 공간 16px
- `z-40`: 탭바보다 위, 폼 오버레이(z-50)보다 아래

**조건부 폼 렌더링:**

```tsx
{showForm && (
  <TransactionForm
    onClose={() => setShowForm(false)}
    onSaved={() => setRefreshKey((k) => k + 1)}
  />
)}
```

---

### `src/components/features/home/HomeTab.tsx` (수정)

`refreshKey` prop을 받도록 업데이트했습니다.  
Phase 10 구현 시 이 값을 `useEffect` 의존성 배열에 포함시켜 자동 재조회를 구현합니다.

```typescript
interface HomeTabProps {
  yearMonth: string;
  refreshKey: number;  // 추가: 저장 완료 시 목록 재조회 트리거
}
```

---

## 바텀 시트(Bottom Sheet) 패턴 설명

바텀 시트는 모바일 앱에서 자주 쓰이는 UI 패턴입니다.  
화면 하단에서 위로 슬라이드되어 콘텐츠를 표시합니다.

```
장점:
  - 자연스러운 엄지 손가락 닿는 범위에 UI 배치
  - 기존 화면 맥락(배경)을 유지하면서 추가 작업 수행
  - 모달과 달리 화면 전체를 가리지 않음

구현 방식:
  fixed inset-0        → 화면 전체를 덮는 투명 레이어
  flex flex-col justify-end → 내용물을 화면 하단 정렬
  rounded-t-2xl        → 상단 모서리만 둥글게 (하단은 화면 끝)
  max-h-[90vh]         → 모달이 화면 높이의 90% 이상 차지하지 않도록 제한
  overflow-y-auto      → 키보드 올라와도 폼 내부 스크롤 가능
```

---

## 모바일 키보드 오픈 시 레이아웃 처리

입력 필드를 클릭하면 모바일 가상 키보드가 올라옵니다.  
이때 폼 내용이 키보드 뒤에 가려지지 않도록 처리했습니다.

```
처리 방법:
  overflow-y-auto on 바텀 시트 → 폼 내부에서 스크롤 가능
  max-h-[90vh]                → 최대 높이 제한 → 키보드가 올라와도 스크롤 가능 범위 내 유지
```

바텀 시트 자체에 `overflow-y-auto`를 설정하여  
키보드가 올라와서 공간이 줄어들면 폼 내부에서 스크롤할 수 있게 됩니다.

---

## 데이터 저장 흐름

```
TransactionForm
  ↓  handleSave() 호출
  ↓  createTransaction(data)       ← lib/api.ts
  ↓  POST /transactions            ← 백엔드 Cloud Run
  ↓  addTransaction()              ← src/services/firestore.ts
  ↓  Firestore transactions 컬렉션 저장 (서버 타임스탬프 포함)
  ↓  onSaved() 호출
  ↓  refreshKey +1                 ← MainApp 상태 갱신
  ↓  HomeTab 목록 자동 재조회 (Phase 10 구현 예정)
```

---

## 유효성 검사 규칙

| 필드 | 필수 여부 | 검사 내용 |
|------|----------|----------|
| 내용(category) | 필수 | 비어있으면 오류 |
| 금액(amount) | 필수 | 0 이하이면 오류, 숫자만 입력 가능 |
| 날짜(date) | 필수 | 기본값(오늘)이 있으므로 별도 검사 불필요 |
| 메모(memo) | 선택 | 검사 없음, 빈 값이면 백엔드에 전송하지 않음 |

---

## 이후 작업 (Phase 10)

Phase 10에서 `HomeTab`을 구현할 때:

1. `refreshKey`를 `useEffect` 의존성으로 추가
2. `getTransactions(yearMonth)` API 호출로 목록 재조회
3. 날짜별 그룹화 + 최신순 정렬 표시
4. 예산 대시보드 표시
