# Phase 14.1 — 공통 UX 개선 학습 문서

## 개요

이 문서는 MoneyManager Phase 14.1에서 구현한 공통 UX 개선 4가지를 코드와 함께 설명합니다.
각 개선 항목이 왜 필요했는지, 어떤 기술을 사용했는지, 핵심 코드가 무엇인지 정리합니다.

---

## 1. FAB 모달 너비 제한

### 문제

FAB(Floating Action Button) 버튼을 눌러 거래 입력 모달을 열면, 모달 바텀시트가 뷰포트(브라우저 창) 전체 너비를 채웠습니다.
데스크톱 웹에서 앱은 중앙의 `max-w-md (448px)` 컨테이너 안에 그려지는데, 모달만 1200px 전부를 사용해 레이아웃이 어색했습니다.

### 해결 원리

거래 입력 모달은 다음 구조입니다.

```
[전체 화면 오버레이 div: fixed inset-0 flex flex-col justify-end]
  └── [시트 div: 바텀시트 본체]
```

오버레이는 `fixed inset-0`으로 화면 전체를 덮습니다.
시트가 오버레이의 직계 자식이므로 기본적으로 100% 너비를 가집니다.

CSS `align-self: center`(= `self-center`)를 시트에 적용하면,
flex 컨테이너(오버레이)의 교차축 정렬을 시트 개별적으로 override하여 중앙에 배치됩니다.
여기에 `w-full max-w-md`를 함께 주면 최대 448px로 제한됩니다.

### 핵심 코드 — `TransactionForm.tsx`

```tsx
// 변경 전
<div className="rounded-t-2xl overflow-y-auto modal-sheet-max-height">

// 변경 후
<div className="rounded-t-2xl overflow-y-auto modal-sheet-max-height w-full max-w-md self-center">
```

| 클래스 | 역할 |
|---|---|
| `w-full` | 모바일에서는 화면 전체 너비 |
| `max-w-md` | 데스크톱에서는 448px 이내로 제한 |
| `self-center` | flex 오버레이 안에서 수평 중앙 정렬 |

### 동작 확인 방법

```javascript
// 브라우저 콘솔에서 확인
const sheet = document.querySelector('[class*="modal-sheet-max-height"]');
console.log({
  sheetWidth: sheet.getBoundingClientRect().width, // 모바일: 뷰포트 너비, 데스크톱: 448
  viewportWidth: window.innerWidth,
});
```

---

## 2. 거래 입력 모달 배경 스크롤 차단

### 문제

모달(바텀시트)이 열린 상태에서도 뒤의 콘텐츠(홈/통계 탭의 거래 목록 등)가 스크롤되어,
UX 관점에서 모달과 배경이 분리된 느낌을 주지 못했습니다.

### 해결 원리

메인 스크롤 컨테이너(`<main>`)에 `overflow-hidden`을 적용하면 스크롤이 차단됩니다.
모달이 열렸을 때만 차단하고, 닫히면 다시 `overflow-y-auto`로 스크롤을 허용합니다.

### 핵심 코드 — `MainApp.tsx`

```tsx
// showForm 상태에 따라 overflow 클래스를 동적으로 교체
<main className={`flex-1 flex flex-col ${showForm ? 'overflow-hidden' : 'overflow-y-auto'}`}>
```

- `showForm = true` → `overflow-hidden`: 스크롤 완전 차단
- `showForm = false` → `overflow-y-auto`: 일반 스크롤 허용

### 주의 사항

`overflow-hidden`은 스크롤을 차단하는 동시에 스크롤 위치를 0으로 리셋하지 않습니다.
모달을 닫은 후 이전 스크롤 위치가 그대로 유지됩니다.

---

## 3. 통계 탭 수입/지출 전환 탭 스크롤 고정 (Sticky)

### 문제

통계 탭에서 카테고리 목록이 길어 스크롤이 필요할 때, 수입/지출 전환 탭 바가 함께 스크롤되어
어느 탭인지 확인하려면 맨 위로 다시 올라가야 했습니다.

### 해결 원리

CSS `position: sticky`는 요소가 스크롤 컨테이너의 지정 위치(top-0)에 닿으면
거기에 고정됩니다. `position: fixed`와 달리 레이아웃 흐름(flow)에 영향을 줍니다.

```
[main: overflow-y-auto] ← 스크롤 컨테이너
  └── [StatsTab]
       ├── [수입/지출 탭: position: sticky; top: 0; z-index: 10] ← 스크롤 시 상단 고정
       └── [카테고리 목록: 길면 스크롤]
```

#### `sticky`의 동작 조건

1. 스크롤 컨테이너(`overflow-y-auto` 또는 `overflow-y-scroll`)가 조상에 있어야 함
2. `top`, `bottom`, `left`, `right` 중 하나가 지정되어야 함
3. `sticky` 요소의 부모 컨테이너보다 요소가 작아야 함 (부모가 더 크면 고정 효과 없음)

#### 배경색 필수

`sticky` 요소에 배경색을 지정하지 않으면 스크롤 내용이 탭 뒤로 비쳐 보입니다.

### 핵심 코드 — `StatsTab.tsx`

```tsx
// 변경 전
<div className="flex border-b" style={{ borderColor: 'var(--border)' }}>

// 변경 후
<div
  className="flex border-b sticky top-0 z-10"
  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
>
```

| 클래스/스타일 | 역할 |
|---|---|
| `sticky top-0` | 스크롤 컨테이너 상단에 고정 |
| `z-10` | 스크롤되는 콘텐츠보다 위에 표시 |
| `backgroundColor` | 배경 투명 방지 |

---

## 4. 달력 날짜 바텀시트 드래그로 닫기

### 문제

달력에서 날짜를 클릭하면 해당 날짜의 거래 내역 바텀시트가 나타납니다.
이 시트를 닫으려면 X 버튼을 누르거나 배경을 탭해야 했는데,
모바일 UX 관점에서 아래로 드래그해서 닫는 것이 더 자연스럽습니다.

### 핵심 개념: Touch 이벤트 vs Mouse 이벤트

| 이벤트 | 발생 조건 |
|---|---|
| `onTouchStart` | 손가락이 화면에 닿을 때 |
| `onTouchMove` | 손가락이 화면 위를 움직일 때 |
| `onTouchEnd` | 손가락이 화면에서 떨어질 때 |

`e.touches[0].clientY`로 현재 터치의 Y 좌표(픽셀)를 얻을 수 있습니다.

### 드래그 닫기 로직

```
1. onTouchStart → 시작 Y 좌표 저장 (dragStartY)
2. onTouchMove  → 현재 Y - 시작 Y = dragOffset (이동 거리)
                  dragOffset > 0 (아래 방향)일 때만 시트 이동
3. onTouchEnd   → dragOffset >= DISMISS_THRESHOLD(100px) → 닫기
                  미만 → 원위치로 스냅백
```

### 핵심 코드 — `CalendarTab.tsx`

```tsx
const DISMISS_THRESHOLD = 100; // 100px 이상 드래그 시 닫힘

// dragStartY: useRef 사용 (렌더 트리거 방지)
// dragOffset, isDragging: useState (UI 변경이 필요하므로 state)
const dragStartY = useRef<number | null>(null);
const [dragOffset, setDragOffset] = useState(0);
const [isDragging, setIsDragging] = useState(false);

// 날짜 변경 시 드래그 상태 초기화
useEffect(() => {
  setDragOffset(0);
  setIsDragging(false);
  dragStartY.current = null;
}, [selectedDate]);

const handleDragStart = (e: React.TouchEvent) => {
  dragStartY.current = e.touches[0].clientY; // 시작 좌표 저장
  setIsDragging(true);
};

const handleDragMove = (e: React.TouchEvent) => {
  if (dragStartY.current === null) return;
  const delta = e.touches[0].clientY - dragStartY.current;
  if (delta > 0) setDragOffset(delta); // 아래 방향만 허용
};

const handleDragEnd = () => {
  if (dragOffset >= DISMISS_THRESHOLD) {
    closeSheet(); // 임계값 초과 → 닫기
  } else {
    setDragOffset(0); // 미만 → 스냅백
  }
  dragStartY.current = null;
  setIsDragging(false);
};
```

### useRef vs useState 선택 기준

| 기준 | useRef | useState |
|---|---|---|
| 렌더링 트리거 | 없음 | 있음 |
| 사용 목적 | 중간 계산값 보관 | UI에 반영할 값 |
| 예시 | `dragStartY` (매 touchmove마다 읽기만 함) | `dragOffset` (시트 위치 = UI 변경) |

`dragStartY`는 TouchMove 핸들러에서 읽기만 하고 화면에 직접 표시되지 않으므로 `useRef`가 적합합니다.
불필요한 리렌더링을 방지해 드래그 중 성능을 보장합니다.

### 오버레이 동적 투명도

드래그할수록 배경이 점차 투명해지면 닫힐 것임을 시각적으로 예고합니다.

```tsx
// dragOffset이 클수록 opacity가 낮아짐
// Math.max(0.1, ...)로 완전 투명은 방지
opacity: Math.max(0.1, 0.45 - dragOffset / 400)
```

| dragOffset | opacity |
|---|---|
| 0 | 0.45 |
| 140 | 0.10 (최소값) |
| 200 | 0.10 (최소값 유지) |

### 시트 애니메이션

드래그 중에는 transition을 끄고 (즉각 반응), 드래그 종료 후 스냅백 시에는 transition을 켭니다.

```tsx
style={{
  transform: `translateY(${dragOffset}px)`,
  transition: isDragging
    ? 'none'                                          // 드래그 중: 즉각 반응
    : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)', // 스냅백/열림: 자연스러운 가속
}}
```

`cubic-bezier(0.32, 0.72, 0, 1)`은 Apple의 시트 애니메이션 곡선과 유사한 "빠른 시작 → 점진적 감속" 패턴입니다.

---

## 5. E2E 테스트 개선: addInitScript PIN 우회

### 기존 방식의 문제

일부 테스트 파일(`stats-tab.spec.ts`)이 PIN 우회를 위해 `page.route()` + 버튼 클릭 방식을 사용했습니다.

```typescript
// 기존: 4개의 PIN 버튼 클릭 필요
const pinButtons = page.getByRole('button', { name: /^[0-9]$/ });
if (pinCount > 0) {
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '1' }).first().click();
  }
}
```

병렬 테스트 실행 시 dev 서버 부하로 인해 버튼 클릭 타이밍이 실패하는 flaky 현상이 있었습니다.

### 개선된 방식

```typescript
// 개선: page.goto() 이전에 sessionStorage 직접 주입
await page.addInitScript(() => sessionStorage.setItem('mm_verified', 'true'));
await page.goto('/');
// PIN 화면 자체가 표시되지 않음
```

`addInitScript`는 페이지 JavaScript 실행 이전에 주입됩니다.
앱이 초기 로드 시 `sessionStorage.getItem('mm_verified')`를 확인하므로,
`true`가 이미 있으면 PIN 화면을 건너뜁니다.

이 방식은 더 빠르고 안정적이며, PIN API 모킹도 불필요합니다.

---

## 정리

| 개선 항목 | 핵심 기술 | 파일 |
|---|---|---|
| FAB 모달 너비 제한 | CSS `align-self: center` + `max-w-md` | `TransactionForm.tsx` |
| 배경 스크롤 차단 | 조건부 `overflow-hidden` | `MainApp.tsx` |
| 통계 탭 토글 고정 | CSS `position: sticky` | `StatsTab.tsx` |
| 달력 드래그 닫기 | Touch 이벤트 + `useRef` + `translateY` | `CalendarTab.tsx` |
| E2E PIN 우회 개선 | `addInitScript` | `stats-tab.spec.ts` |
