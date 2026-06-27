# Phase 10: 홈 화면 — 일일 내역 탭

## 이 단계에서 한 일

홈 탭 화면을 실제로 구현했습니다.  
Phase 9까지는 거래 내역을 저장하는 기능만 있었고, 홈 탭은 빈 자리(플레이스홀더)였습니다.  
이번 단계에서 저장된 내역을 날짜별로 불러와 화면에 표시하고,  
상단에 예산 현황 대시보드를 추가했습니다.

---

## 구현 화면 구조

```
┌─────────────────────────────┐
│         2026년 6월   ‹  ›   │  ← MonthSelector (연월 선택기)
├─────────────────────────────┤
│  예산        지출      잔여  │
│  미설정    ¥14,720     ¥0   │  ← 예산 대시보드 카드
│  ██████████████░░░ 80% 소진 │  ← 소진 진행 바
├─────────────────────────────┤
│  6월 18일 (목)    -¥1,500  │  ← 날짜 헤더 + 일일 소계
│ ┌───────────────────────── ┐│
│ │ [기타]           -¥1,500 ││  ← 거래 항목 카드
│ └─────────────────────────┘│
│                             │
│  6월 17일 (수)   -¥13,220  │
│ ┌───────────────────────── ┐│
│ │ [식비]  점심 식사  -¥5,000││
│ │──────────────────────────││
│ │ [교통비]          -¥1,500 ││
│ │──────────────────────────││
│ │ [빵]              -¥1,420 ││
│ └─────────────────────────┘│
├─────────────────────────────┤
│  🏠    📅    📊    ⋯    [+] │
└─────────────────────────────┘
```

---

## 핵심 개념 1: useEffect로 데이터 가져오기

컴포넌트가 화면에 나타날 때 서버에서 데이터를 가져오는 패턴입니다.

```tsx
useEffect(() => {
  let cancelled = false; // 클린업 플래그 (중요!)

  async function fetchData() {
    setLoading(true);
    try {
      const [txList, budgetData] = await Promise.all([
        getTransactions(yearMonth),          // 거래 내역 조회
        getBudget(yearMonth).catch(() => null), // 예산 조회 (없으면 null)
      ]);
      if (!cancelled) {
        setTransactions(txList);
        setBudget(budgetData);
      }
    } catch {
      if (!cancelled) setError('데이터를 불러오는 데 실패했습니다.');
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  fetchData();
  return () => { cancelled = true; }; // 언마운트 시 정리
}, [yearMonth, refreshKey]); // 연월 변경 또는 저장 완료 시 재조회
```

### `cancelled` 플래그가 왜 필요한가?

```
1. 사용자가 "6월" 선택 → API 요청 A 시작
2. 사용자가 "5월"로 빠르게 변경 → API 요청 B 시작
3. 요청 B가 먼저 완료되어 5월 데이터 세팅
4. 요청 A가 나중에 완료 → 6월 데이터로 덮어씀! (버그)
```

`cancelled = true`로 이전 요청의 응답을 무시하면 이 문제를 방지합니다.  
React에서 `useEffect` 정리 함수(`return () => {...}`)는 의존성이 바뀌거나 컴포넌트가 사라질 때 호출됩니다.

---

### `Promise.all`로 병렬 요청하기

```tsx
// ❌ 순차 요청 — 총 대기 시간 = 요청A 시간 + 요청B 시간
const txList     = await getTransactions(yearMonth); // 500ms 대기
const budgetData = await getBudget(yearMonth);       // 300ms 대기
// 총 800ms

// ✅ 병렬 요청 — 총 대기 시간 = max(요청A 시간, 요청B 시간)
const [txList, budgetData] = await Promise.all([
  getTransactions(yearMonth), // ┐
  getBudget(yearMonth),       // ┘ 동시에 시작
]);
// 총 500ms (더 긴 쪽 기준)
```

예산 API에 `.catch(() => null)`을 붙이는 이유:  
예산을 한 번도 설정하지 않은 달은 백엔드가 404를 반환합니다.  
이때 `Promise.all` 전체가 실패하지 않도록 오류를 `null`로 흡수합니다.

---

## 핵심 개념 2: `refreshKey` — 부모에서 자식 재조회 트리거

Phase 9에서 예고한 `refreshKey` 패턴이 여기서 실제로 사용됩니다.

```
MainApp (부모)
  └─ refreshKey: number  ← 저장 완료 시 +1
  └─ HomeTab (자식)
       └─ useEffect([yearMonth, refreshKey])
            └─ refreshKey가 바뀌면 API 재조회
```

```tsx
// MainApp.tsx — 부모
const [refreshKey, setRefreshKey] = useState(0);
const handleSaved = () => setRefreshKey((k) => k + 1); // 저장 완료 시 증가

<HomeTab yearMonth={yearMonth} refreshKey={refreshKey} />
<TransactionForm onSaved={handleSaved} />

// HomeTab.tsx — 자식
useEffect(() => {
  fetchData();
}, [yearMonth, refreshKey]); // refreshKey가 1 → 2로 바뀌면 재실행
```

이 방식의 장점: 부모-자식 간 복잡한 상태 공유 없이 단순한 숫자 하나로 동기화합니다.

---

## 핵심 개념 3: 데이터 그룹화 — 날짜별 묶기

서버에서 받은 거래 내역 배열을 날짜별로 묶는 함수입니다.

```
입력 (서버 응답):
  [{ date: "2026-06-18", category: "기타",  amount: 1500 },
   { date: "2026-06-17", category: "식비",  amount: 5000 },
   { date: "2026-06-17", category: "교통비", amount: 1500 }]

출력 (그룹화 결과):
  [{ date: "2026-06-18", transactions: [...1개], totalExpense: 1500 },
   { date: "2026-06-17", transactions: [...2개], totalExpense: 6500 }]
```

```tsx
function groupByDate(transactions: Transaction[]): DayGroup[] {
  // 1단계: 날짜 DESC, 같은 날짜면 등록일 DESC 정렬
  const sorted = [...transactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return createdAtSeconds(b) - createdAtSeconds(a);
  });

  // 2단계: Map으로 날짜별 그룹화 (삽입 순서 유지)
  const map = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }

  // 3단계: DayGroup 배열로 변환 + 합계 계산
  return [...map.entries()].map(([date, txs]) => ({
    date,
    transactions: txs,
    totalIncome:  txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }));
}
```

### `Map`을 쓰는 이유

`{ [date: string]: Transaction[] }` 객체를 쓸 수도 있지만,  
JavaScript 객체는 키 삽입 순서가 보장되지 않을 수 있습니다.  
`Map`은 삽입 순서가 항상 보장되므로 날짜를 내림차순으로 정렬한 뒤 Map에 넣으면  
꺼낼 때도 그 순서 그대로 나옵니다.

---

## 핵심 개념 4: Firestore 쿼리와 복합 인덱스

### 문제: 복합 인덱스 오류

처음 구현 시 백엔드 쿼리를 이렇게 작성했습니다:

```typescript
db.collection('transactions')
  .orderBy('date', 'desc')
  .orderBy('createdAt', 'desc')  // ← 이 줄이 문제
  .where('date', '>=', '2026-06-01')
  .where('date', '<=', '2026-06-31')
```

실행하면 오류가 발생했습니다:
```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```

### 왜 인덱스가 필요한가?

Firestore는 데이터베이스 테이블처럼 자동으로 모든 필드 조합을 인덱싱하지 않습니다.  
**범위 필터(`>=`, `<=`)** 와 **다른 필드의 정렬(`orderBy`)** 을 함께 사용하면  
Firestore가 효율적으로 쿼리하기 위해 **복합 인덱스(Composite Index)** 가 필요합니다.

```
단일 필드 orderBy + 동일 필드 범위 필터 → 인덱스 불필요 ✅
  .orderBy('date').where('date', '>=', ...).where('date', '<=', ...)

다른 필드 orderBy 추가 → 복합 인덱스 필요 ❌
  .orderBy('date').orderBy('createdAt')
  + .where('date', '>=', ...).where('date', '<=', ...)
```

### 해결 방법: 정렬을 JavaScript로 이동

```typescript
// 수정 전: Firestore가 2개 필드를 동시에 정렬 → 인덱스 필요
.orderBy('date', 'desc').orderBy('createdAt', 'desc')

// 수정 후: Firestore는 date만 정렬, createdAt은 JS에서 처리
.orderBy('date', 'desc')
// 그 후 JS에서:
rows.sort((a, b) => {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return bTs - aTs; // createdAt 2차 정렬
});
```

Firestore 복합 인덱스를 생성하는 방법도 있습니다:

```bash
gcloud firestore indexes composite create \
  --collection-group=transactions \
  --field-config=field-path=date,order=DESCENDING \
  --field-config=field-path=createdAt,order=DESCENDING
```

인덱스 생성에는 몇 분이 걸리고, 이미 운영 중인 서비스라면 데이터 규모에 따라 더 걸릴 수 있습니다.

---

## 핵심 개념 5: 예산 대시보드 UI 계산

```tsx
// 당월 수입/지출 집계 (transactions 배열에서 계산)
const totalIncome  = transactions.filter(t => t.type === 'income')
                                 .reduce((sum, t) => sum + t.amount, 0);
const totalExpense = transactions.filter(t => t.type === 'expense')
                                 .reduce((sum, t) => sum + t.amount, 0);

// 잔여 예산 (예산 설정 시)
const remaining = budget ? budget.amount - totalExpense : null;

// 진행 바 비율 (0~1 범위로 클램프)
const budgetRatio = budget && budget.amount > 0
  ? Math.min(1, totalExpense / budget.amount)
  : 0;
```

### `Math.min(1, ...)` 클램프가 필요한 이유

예산이 ¥100,000인데 지출이 ¥120,000이면 비율이 1.2(120%)가 됩니다.  
CSS `width`에 `120%`를 주면 진행 바가 컨테이너를 넘어 깨집니다.  
`Math.min(1, 1.2) = 1`로 최대 100%를 넘지 않도록 제한합니다.

```tsx
// 진행 바 색상: 90% 이상 소진이면 빨간 경고
backgroundColor: budgetRatio >= 0.9 ? 'var(--expense)' : 'var(--income)'
```

---

## 핵심 개념 6: 3단계 화면 상태 (Loading / Error / Content)

데이터를 외부에서 가져오는 화면은 항상 세 가지 상태를 처리해야 합니다.

```tsx
// 로딩 중
if (loading) {
  return <p>불러오는 중...</p>;
}

// 오류 발생
if (error) {
  return <p style={{ color: 'var(--expense)' }}>{error}</p>;
}

// 정상 데이터 (빈 상태 포함)
return (
  <div>
    {/* 예산 대시보드 */}
    {dayGroups.length === 0 ? (
      <p>이번 달 거래 내역이 없습니다.</p>
    ) : (
      dayGroups.map(group => <DayGroupCard ... />)
    )}
  </div>
);
```

이 패턴을 지키지 않으면:
- 로딩 중에 빈 화면이 보이거나 (UX 불량)
- API 오류 시 앱이 죽거나 (안정성 불량)
- 데이터 없을 때 아무것도 안 보이거나 (안내 불량)

---

## 미구현 항목: Firestore 실시간 연동 (`onSnapshot`)

### `onSnapshot`이란?

> "데이터베이스가 바뀌는 순간, 서버에 물어보지 않아도 화면이 자동으로 바뀐다."

현재 앱은 **요청(fetch)** 방식으로 데이터를 가져옵니다.  
`onSnapshot`은 Firestore가 제공하는 **실시간 구독(Subscribe)** 기능입니다.

---

### 현재 방식 vs `onSnapshot` 방식

**현재 방식 — fetch + refreshKey (요청-응답)**

```
사용자: 저장 버튼 클릭
    │
    ▼
앱: refreshKey +1 → useEffect 재실행 → GET /transactions 요청
    │
    ▼
서버: 데이터 응답
    │
    ▼
화면 갱신 ✅
```

- 내가 직접 저장한 경우에만 갱신됨
- 1회성 통신 (요청 → 응답 → 끝)

---

**onSnapshot 방식 — 실시간 구독 (지속 연결)**

```
앱 시작 시: Firestore에 구독 등록 ("이 데이터 계속 지켜볼게")
    │
    ▼ (소켓 연결 유지 중...)
    │
누군가 DB에 데이터를 추가/수정/삭제
    │
    ▼
Firestore: "바뀌었어!" → 앱에 자동 푸시 (요청 없이)
    │
    ▼
화면 자동 갱신 ✅
```

- DB가 바뀌면 Firestore가 먼저 앱에게 알려줌
- 요청 없이도 항상 최신 상태 유지

---

### 실생활 비유

| 방식 | 비유 |
|---|---|
| **현재 방식 (fetch)** | 카페에서 "제 음료 나왔나요?" 하고 직접 카운터에 가서 확인 |
| **onSnapshot** | 진동벨을 받아 놓고 앉아 있다가 울리면 가는 것 |

fetch는 내가 움직여서 확인하고, `onSnapshot`은 Firestore가 알아서 알려줍니다.

---

### 코드로 보는 차이

```typescript
// ── 현재 방식 (fetch) ──────────────────────────────────────────
// 특정 시점에 한 번 요청하고 응답을 받으면 끝
const data = await getTransactions(yearMonth);
setTransactions(data);

// ── onSnapshot 방식 ────────────────────────────────────────────
// 구독을 걸어 두면, DB가 바뀔 때마다 콜백이 자동으로 호출됨
const unsubscribe = db.collection('transactions')
  .where('yearMonth', '==', yearMonth)
  .onSnapshot((snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setTransactions(data); // DB 변경 시 자동 실행
  });

// 컴포넌트 언마운트 시 구독 해제 (메모리 누수 방지)
return () => unsubscribe();
```

---

### 이 앱에서 실제로 어떤 차이가 생기나?

**지금은 불편하지 않은 이유:**

현재는 사용자 혼자 사용하고, 저장하면 `refreshKey`로 즉시 갱신되기 때문에 실질적인 불편함이 없습니다.

**`onSnapshot`이 유용해지는 시나리오:**

| 시나리오 | 현재 방식 | onSnapshot |
|---|---|---|
| 폰에서 저장 → 노트북 탭 | 노트북에서 새로고침 필요 | 노트북 화면이 자동으로 갱신됨 |
| 가족과 가계부 공유 | 상대방이 저장해도 내 화면은 그대로 | 상대방이 저장하면 내 화면도 즉시 갱신 |
| 오프라인 → 온라인 복귀 | 새로고침 필요 | Firestore가 자동으로 밀린 변경 사항 동기화 |

---

### 지금 구현하기 어려운 이유

현재 아키텍처 구조:

```
프론트(Vercel) → 백엔드 API(Cloud Run) → Firestore
```

`onSnapshot`은 **프론트가 Firestore에 직접 연결된 소켓**을 유지해야 합니다.  
그런데 현재 프론트는 Firestore를 직접 보지 못하고 백엔드 API를 통해서만 접근합니다.

**구현 선택지와 문제점:**

| 방법 | 내용 | 문제 |
|---|---|---|
| **프론트에 Firebase SDK 직접 추가** | 프론트에서 Firestore에 직접 `onSnapshot` 구독 | 백엔드가 담당하던 보안·인증 분리 원칙이 깨짐. Firestore 자격증명을 프론트 환경변수에 노출해야 함 |
| **백엔드에서 SSE 구현** | 백엔드가 `onSnapshot` 구독 후 프론트로 이벤트 스트림 전송 | Vercel 서버리스 함수는 최대 30초 타임아웃 → 장시간 연결 유지 불가 |

**결론:** 1인 가계부 앱에서는 `refreshKey` 방식으로 충분. 다중 기기 동시 사용 또는 가족 공유 기능이 필요해지는 시점에 Firebase 직접 연동 방식으로 재설계 검토.

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/components/features/home/HomeTab.tsx` | 전면 구현 (Phase 10 플레이스홀더 → 실제 화면) |
| `src/services/firestore.ts` | `getTransactions` 쿼리에서 2중 `orderBy` 제거, JS 정렬로 대체 |
| `todo-architecture.md` | Phase 10 완료 표기 |

---

## 데이터 흐름 전체 그림

```
사용자가 연월 변경 또는 거래 저장
         │
         ▼
MainApp: yearMonth 또는 refreshKey 변경
         │
         ▼
HomeTab: useEffect 재실행
         │
         ├─── Promise.all ──────────────────────────────────────────┐
         │       ├── GET /transactions?yearMonth=2026-06            │
         │       │       └── Firestore: date DESC 정렬 + 범위 필터  │
         │       │           JS: createdAt 2차 정렬                 │
         │       └── GET /budgets/2026-06                          │
         │               └── Firestore: yearMonth 일치 도큐먼트 조회│
         └───────────────────────────────────────────────────────────┘
                  │
                  ▼
         groupByDate() 로 날짜별 그룹화
                  │
                  ▼
         화면 렌더링:
           - 예산 대시보드 (예산/지출/잔여 + 진행 바)
           - 날짜별 거래 카드 목록
```
