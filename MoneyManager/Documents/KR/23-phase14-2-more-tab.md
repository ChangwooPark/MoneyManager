# Phase 14.2 — 더보기 탭 기능 보강 학습 문서

## 개요

Phase 14.2에서 구현한 2가지 기능을 코드와 함께 설명합니다.

1. **아코디언 단일 열림** — 한 번에 하나의 섹션만 펼쳐지는 UI 패턴
2. **데이터 초기화** — PIN 2단계 인증 후 전체 거래 내역 삭제

---

## 1. 아코디언 단일 열림 (Accordion Single-Open)

### 문제

기존에는 PIN 변경, 예산 설정 각각이 독립적인 `boolean` 상태를 가졌습니다.

```tsx
// 기존: 각 섹션 독립 boolean
const [pinOpen,    setPinOpen]    = useState(false);
const [budgetOpen, setBudgetOpen] = useState(false);
```

두 섹션을 동시에 펼쳐두어도 아무런 제약이 없었습니다.

### 해결 원리: 단일 상태로 통합

```tsx
// 변경: 하나의 string | null 값으로 관리
type OpenSection = 'pin' | 'budget' | 'reset' | null;
const [openSection, setOpenSection] = useState<OpenSection>(null);

// 토글 함수: 같은 섹션 → 닫기(null), 다른 섹션 → 열기
const toggleSection = (section: OpenSection) => {
  setOpenSection(prev => prev === section ? null : section);
};
```

```tsx
// 헤더 버튼: toggleSection 호출
<button onClick={() => toggleSection('pin')}>PIN 번호 변경</button>

// 확장 영역: openSection 값으로만 표시 여부 결정
{openSection === 'pin' && <PinForm />}
{openSection === 'budget' && <BudgetForm />}
```

### 섹션 전환 시 폼 상태 초기화

섹션이 닫힐 때 이전에 입력한 값이 남아있지 않도록 `useEffect`로 초기화합니다.

```tsx
useEffect(() => {
  if (openSection !== 'pin') {
    setCurrentPin(''); setNewPin(''); setConfirmPin('');
    setPinError(''); setPinSuccess(false);
  }
  if (openSection !== 'budget') {
    setBudgetInput(''); setBudgetError(''); setBudgetSuccess(false);
  }
  if (openSection !== 'reset') {
    setResetPin(''); setResetStep('pin');
    setResetError(''); setResetSuccess(false);
  }
}, [openSection]);
```

`openSection`이 바뀔 때마다 실행되므로, 예산 섹션을 열면 PIN 입력값이 자동으로 지워집니다.

### 패턴 비교

| | boolean 독립 방식 | string \| null 단일 방식 |
|---|---|---|
| 동시 열림 가능 | ✅ | ❌ (단 하나만 열림) |
| 새 섹션 추가 | boolean 변수 추가 필요 | union 타입에 값만 추가 |
| 상태 개수 | 섹션 수 × 1 | 항상 1개 |

---

## 2. 데이터 초기화 — 2단계 인증 후 전체 삭제

### 흐름

```
[데이터 초기화] 클릭
  → 아코디언 열림 (Step 1: PIN 입력)
  → PIN 4자리 입력 후 [확인] 클릭
    → 서버 PIN 검증 (POST /settings/pin/verify)
    → 실패: "PIN이 올바르지 않습니다" 오류 표시
    → 성공: Step 2로 전환 (최종 확인 화면)
  → [초기화] 클릭
    → DELETE /transactions/all 호출
    → 성공: "초기화가 완료되었습니다 ✓"  + 홈/달력/통계 탭 갱신
    → 실패: 오류 메시지 + Step 1로 복귀
```

### 상태 설계

```tsx
const [resetPin,     setResetPin]     = useState('');
const [resetStep,    setResetStep]    = useState<'pin' | 'confirm'>('pin');
const [resetLoading, setResetLoading] = useState(false);
const [resetError,   setResetError]   = useState('');
const [resetSuccess, setResetSuccess] = useState(false);
```

`resetStep`으로 현재 어느 단계인지 추적합니다. Step 상태 기계(State Machine)를 최소한으로 구현한 패턴입니다.

### Step 1: PIN 검증

```tsx
const handleResetVerifyPin = async () => {
  setResetError('');
  if (!/^\d{4}$/.test(resetPin)) { setResetError('PIN 4자리를 입력해 주세요'); return; }

  setResetLoading(true);
  try {
    const res = await verifyPin(resetPin);
    if (res.success) {
      setResetStep('confirm'); // → Step 2
    } else {
      setResetError('PIN이 올바르지 않습니다');
    }
  } catch {
    setResetError('확인에 실패했습니다. 다시 시도해 주세요.');
  } finally {
    setResetLoading(false);
  }
};
```

### Step 2: 전체 삭제 실행

```tsx
const handleResetConfirm = async () => {
  setResetLoading(true);
  try {
    await deleteAllTransactions();
    setResetSuccess(true);
    onReset?.();                // 홈·달력·통계 탭 refreshKey 증가
    setTimeout(() => {
      setResetSuccess(false);
      setOpenSection(null);     // 아코디언 닫기
    }, 2000);
  } catch {
    setResetError('초기화에 실패했습니다. 다시 시도해 주세요.');
    setResetStep('pin');        // 오류 시 Step 1로 복귀
  } finally {
    setResetLoading(false);
  }
};
```

### onReset prop: 탭 간 데이터 갱신

`MoreTab`은 홈·달력·통계 탭의 `refreshKey`에 직접 접근할 수 없습니다.
`MainApp`이 `onReset` 콜백을 전달하여 초기화 완료 시 전체 탭을 갱신합니다.

```tsx
// MainApp.tsx
const handleSaved = () => setRefreshKey(k => k + 1);

{activeTab === 'more' && <MoreTab onReset={handleSaved} />}
```

```tsx
// MoreTab.tsx
interface MoreTabProps {
  onReset?: () => void; // 초기화 완료 시 호출
}
export default function MoreTab({ onReset }: MoreTabProps) {
  ...
  onReset?.(); // Optional chaining으로 undefined 안전하게 호출
}
```

---

## 3. 백엔드: DELETE /transactions/all

### Firestore batch delete

Firestore의 `WriteBatch`는 한 번에 최대 500개 작업을 처리할 수 있습니다.
500개를 초과하는 경우 여러 배치로 나누어 처리합니다.

```typescript
// firestore.ts
export async function deleteAllTransactions(): Promise<number> {
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) return 0;

  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snapshot.docs.slice(i, i + BATCH_SIZE).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.slice(i, i + BATCH_SIZE).length;
  }

  return deleted;
}
```

### 라우트 등록 순서가 중요

Express에서 라우트는 등록 순서대로 매칭됩니다.
`DELETE /:id`가 먼저 등록되면 `'all'` 문자열이 `:id`로 파싱되어 `DELETE /all`이 작동하지 않습니다.

```typescript
// transactions.ts — 반드시 /:id 보다 앞에 위치
router.delete('/all', async (_req, res) => {
  const count = await deleteAllTransactions();
  res.json({ deleted: count });
});

router.delete('/:id', async (req, res) => { ... });
```

---

## 4. E2E 테스트 — 새 패턴

### Playwright route override (후순위 > 선순위)

`setupApp`이 PIN 검증을 `{ success: true }`로 모킹한 후,
특정 테스트에서 실패 케이스를 테스트하려면 같은 URL 패턴을 다시 등록합니다.
Playwright는 **나중에 등록된 핸들러가 먼저 실행**됩니다.

```typescript
test('잘못된 PIN 입력 시 오류 메시지', async ({ page }) => {
  await setupApp(page); // success: true 모킹 등록
  // 나중에 등록 → 우선순위 높음 → success: false 가 실제로 적용됨
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: false } })
  );
  ...
});
```

### exact: true로 텍스트 충돌 방지

"데이터 초기화" 헤더 버튼이 `getByRole('button', { name: '초기화' })`에도 매칭되는 문제 발생.
(버튼 텍스트가 "데이터 초기화"이므로 부분 매칭)

```typescript
// ❌ 2개 매칭: "데이터 초기화" 헤더 + "초기화" 확인 버튼
await page.getByRole('button', { name: '초기화' }).click();

// ✅ 정확히 "초기화" 텍스트만 매칭
await page.getByRole('button', { name: '초기화', exact: true }).click();
```

---

## 정리

| 개선 항목 | 핵심 기술 | 파일 |
|---|---|---|
| 아코디언 단일 열림 | `string \| null` 단일 상태 + useEffect 초기화 | `MoreTab.tsx` |
| 데이터 초기화 UI | 2단계 상태 머신 (`'pin' \| 'confirm'`) | `MoreTab.tsx` |
| onReset 콜백 | optional prop + optional chaining | `MainApp.tsx`, `MoreTab.tsx` |
| Batch delete | Firestore `WriteBatch` 500개 단위 | `firestore.ts` |
| DELETE /all 라우트 | Express 라우트 등록 순서 | `transactions.ts` |
