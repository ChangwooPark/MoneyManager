# Phase 13 공부 문서 — 더보기 탭 (MoreTab)

## 1. 개요

더보기 탭은 앱의 설정 화면입니다.  
단일 컴포넌트(`MoreTab.tsx`) 안에서 두 가지 화면을 뷰 상태로 전환합니다.

```
MoreView = 'main'       → 메인 메뉴 (PIN·예산·카테고리 진입점)
MoreView = 'categories' → 카테고리 관리 화면
```

---

## 2. 핵심 패턴 — 뷰 전환 (View Switching)

```typescript
// 단일 컴포넌트 내에서 화면 전환
type MoreView = 'main' | 'categories';
const [view, setView] = useState<MoreView>('main');

if (view === 'categories') {
  return <카테고리화면 />;
}
return <메인메뉴 />;
```

**왜 이렇게 하나?**  
별도 Route(페이지)로 분리하면 URL이 바뀌고 뒤로가기 동작이 달라집니다.  
앱 내 전환(내비게이션 없이)은 상태로 처리하는 것이 자연스럽습니다.

---

## 3. 아코디언 패턴 (Accordion)

```typescript
const [pinOpen, setPinOpen] = useState(false);

// 헤더 버튼 클릭 → 토글
onClick={() => setPinOpen(o => !o)}

// 확장 영역: 상태에 따라 조건부 렌더링
{pinOpen && <폼 영역 />}
```

**포인트**: `setPinOpen(o => !o)` — 함수형 업데이트로 이전 값 기반 토글  
(이전 상태를 직접 참조하지 않아 클로저 문제 방지)

---

## 4. Firestore 카테고리 CRUD

### 4-1. 백엔드 서비스 (`src/services/firestore.ts`)

```typescript
export interface Category {
  id?: string;
  type: 'income' | 'expense';
  name: string;
  order: number;
}

// 비어 있으면 자동 seed → 재조회 → 반환
export async function getCategories(type: 'income' | 'expense'): Promise<Category[]> {
  const snapshot = await db.collection('categories').where('type', '==', type).get();
  if (snapshot.empty) {
    await seedCategories(type);           // 기본값 등록
    return getCategories(type);           // 재조회 (재귀)
  }
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
}
```

**Firestore 복합 인덱스 회피 전략**:  
`where('type', '==', type)` — 단일 필드 필터만 사용  
→ Firestore 인덱스 생성 없이도 동작  
→ 정렬(`order` 기준)은 JS 배열 `.sort()`로 처리

### 4-2. API 라우트 (`src/routes/categories.ts`)

```typescript
// GET /categories?type=expense|income
router.get('/', async (req, res) => {
  const type = req.query.type as 'income' | 'expense';
  const list = await getCategories(type);
  res.json(list);
});

// POST /categories { type, name }
router.post('/', async (req, res) => {
  const { type, name } = req.body;
  const cat = await addCategory(type, name);
  res.status(201).json(cat);
});

// DELETE /categories/:id
router.delete('/:id', async (req, res) => {
  // TypeScript: req.params.id 타입이 string | string[] 이므로 처리 필요
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await deleteCategoryById(id);
  res.status(204).send();
});
```

---

## 5. 폴백(Fallback) 전략 — TransactionForm

```typescript
// 초기값: 하드코딩 목록 (API 로딩 전 빈 화면 방지)
const [apiCategories, setApiCategories] = useState<Record<...>>(FALLBACK_CATEGORIES);

useEffect(() => {
  Promise.all([getCategories('expense'), getCategories('income')])
    .then(([exp, inc]) => {
      setApiCategories({
        expense: exp.map(c => c.name),
        income:  inc.map(c => c.name),
      });
    })
    .catch(() => {}); // 실패 시 폴백 유지
}, []);
```

**핵심**: API가 느리거나 실패해도 화면이 빈 칩 목록으로 보이지 않음  
→ FALLBACK → API 성공 → 교체 패턴

---

## 6. PIN 입력 처리

```typescript
// 숫자만 허용, 최대 4자리
<input
  type="password"        // 입력 중 ● 마스킹
  inputMode="numeric"    // 모바일: 숫자 키패드 표시
  maxLength={4}
  onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 4))}
  placeholder="••••"
/>
```

**`replace(/\D/g, '')`**: 숫자가 아닌 문자 제거  
**`.slice(0, 4)`**: 4자리 초과 방지 (maxLength 보강)

---

## 7. 성공 메시지 자동 숨김 패턴

```typescript
setPinSuccess(true);
setTimeout(() => {
  setPinSuccess(false);  // 메시지 숨기기
  setPinOpen(false);     // 아코디언 닫기
}, 1500);
```

→ 사용자가 버튼을 다시 클릭할 필요 없이 1.5초 후 자동으로 닫힘

---

## 8. E2E 테스트 주요 기법 (`tests/more-tab.spec.ts`)

### 8-1. sessionStorage로 PIN 화면 우회

```typescript
// page.goto() 이전에 등록해야 적용됨!
await page.addInitScript(() => {
  sessionStorage.setItem('mm_verified', 'true');
});
await page.goto('/');
```

`addInitScript` — 페이지 스크립트가 실행되기 전에 삽입됩니다.  
`goto()` 이후에 하면 이미 PIN 화면이 렌더된 후라 효과 없음.

### 8-2. exact: true로 버튼 중복 회피

```typescript
// FAB 버튼(aria-label="거래 추가")과 중복 매칭 방지
await page.getByRole('button', { name: '추가', exact: true }).click();
```

### 8-3. XPath 부모 선택으로 행(row) 특정

```typescript
// span의 직계 부모(행 div)로 이동 후 삭제 버튼 클릭
await page.locator('span', { hasText: '식비' }).first()
  .locator('xpath=..')     // 부모 요소로 이동
  .getByRole('button', { name: '삭제' })
  .click();
```

**`xpath=..`**: Playwright 로케이터에서 직계 부모를 선택하는 XPath 축(axis)

### 8-4. PUT 메서드별 라우트 모킹

```typescript
await page.route('**/settings/pin', route => {
  if (route.request().method() === 'PUT') {
    return route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  }
  route.continue(); // 다른 메서드는 실제 요청 통과
});
```

---

## 9. 배포 흐름

```bash
# 백엔드 빌드 및 Cloud Run 배포
cd /Users/cw-park/private-project/MoneyManager
npx tsc
gcloud run deploy money-manager --source . --region asia-northeast3

# 프론트엔드 Vercel 자동 배포 (git push → Vercel CI)
```

---

## 10. 요약: Phase 13에서 배운 것

| 개념 | 핵심 포인트 |
|------|-------------|
| 뷰 전환 | `MoreView` 타입 + 조건부 return으로 SPA 내 화면 전환 |
| 아코디언 | `useState(false)` + `o => !o` 함수형 토글 |
| Firestore CRUD | 단일 필드 필터로 복합 인덱스 회피, auto-seed 패턴 |
| 폴백 전략 | FALLBACK → API 교체 (로딩 중 빈 화면 방지) |
| PIN 입력 | `type="password"` + `inputMode="numeric"` + `replace(/\D/g, '')` |
| E2E 세션 우회 | `addInitScript` + `sessionStorage.setItem` |
| E2E 버튼 특정 | `exact: true` + `xpath=..` 부모 선택 |
