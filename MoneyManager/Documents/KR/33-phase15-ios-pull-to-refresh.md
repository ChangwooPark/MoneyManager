# Phase 15 — iOS Safari Pull-to-Refresh 충돌 해결 학습 문서

## 개요

iPhone Safari에서 거래 입력 모달을 아래로 드래그할 때 iOS 네이티브 "당겨서 새로고침" 기능이 먼저 발동되는 문제를 해결한 과정을 설명합니다.

---

## 1. 문제 상황

### 발생 조건

- iPhone Safari에서 앱 접속
- FAB(+) 버튼으로 거래 입력 바텀시트 열기
- 시트를 아래로 드래그하여 닫으려 할 때

### 증상

모달을 닫으려는 드래그 중에 모달이 아닌 **뒤 페이지 전체가 아래로 밀리며 브라우저 새로고침** 동작 발생.
의도한 모달 닫힘 대신 페이지가 새로고침됨.

---

## 2. 원인 분석

### iOS Pull-to-Refresh란?

Safari는 페이지 최상단에서 손가락을 아래로 스와이프하면 페이지를 새로고침하는 네이티브 기능을 제공합니다.

```
사용자가 아래로 스와이프
  → iOS가 "Pull-to-Refresh" 감지
  → 페이지 전체가 아래로 밀림 (새로고침 아이콘 등장)
  → 손 떼면 페이지 새로고침
```

### 왜 preventDefault()만으로는 안 되는가

일반적인 웹 스크롤은 `touchmove` 이벤트에 `preventDefault()`를 호출하면 차단됩니다.
그러나 iOS Pull-to-Refresh는 **브라우저 네이티브 레이어에서 별도로 처리**되므로,
JavaScript 이벤트 핸들러가 개입하기 전에 이미 동작이 시작됩니다.

```
일반 스크롤:  JS touchmove → preventDefault() → 차단 가능 ✅
Pull-to-Refresh:  iOS 네이티브 레이어 → JS 이벤트 이전 처리 → 차단 어려움 ❌
```

---

## 3. 해결 방법

### overscrollBehavior CSS 속성

`overscrollBehavior: 'none'`을 `document.body`에 적용하면 iOS의 Pull-to-Refresh를 포함한 모든 오버스크롤 동작을 차단합니다.

```
overscrollBehavior: 'none'
  → 스크롤이 컨테이너 경계에 도달해도 부모로 전파되지 않음
  → Pull-to-Refresh, 고무줄 효과(bounce) 모두 차단
```

### 구현 방식 — 마운트/언마운트 시 적용·복원

모달이 **열릴 때** 차단을 적용하고 **닫힐 때** 원래 상태로 복원합니다.

```typescript
useEffect(() => {
  // 모달 마운트 시 — Pull-to-Refresh 차단
  document.body.style.overscrollBehavior = 'none';

  return () => {
    // 모달 언마운트 시 — 원래 상태 복원
    document.body.style.overscrollBehavior = '';
  };
}, []);
```

`useEffect`의 반환 함수(cleanup)는 컴포넌트가 사라질 때 자동으로 실행됩니다.
모달이 닫히면 `overscrollBehavior`가 자동으로 원래 값으로 돌아옵니다.

### 적용 대상

| 컴포넌트 | 이유 |
|---------|------|
| `TransactionForm.tsx` | FAB 버튼으로 여는 거래 입력 바텀시트 |
| `HomeTab.tsx` | 거래 항목 클릭 시 열리는 상세/수정 시트 |
| `CalendarTab.tsx` | 날짜 클릭 시 열리는 날짜 상세 시트 |

---

## 4. CalendarTab 추가 수정

CalendarTab에서는 Pull-to-Refresh 차단 외에 **배경 스크롤 방어**도 함께 누락되어 있었습니다.

### 추가된 내용

```typescript
// sheetRef — 시트 DOM 요소 참조
const sheetRef = useRef<HTMLDivElement>(null);

// touchmove 이벤트 — 시트 내부 터치가 뒤 페이지로 전파되지 않도록 차단
useEffect(() => {
  const sheet = sheetRef.current;
  if (!sheet) return;

  const preventScroll = (e: TouchEvent) => e.preventDefault();
  sheet.addEventListener('touchmove', preventScroll, { passive: false });

  return () => {
    sheet.removeEventListener('touchmove', preventScroll);
  };
}, [selectedDate]);
```

`passive: false` 옵션이 있어야 `preventDefault()`가 실제로 스크롤을 차단합니다.
(기본값 `passive: true`이면 `preventDefault()` 호출이 무시됩니다.)

---

## 5. 핵심 개념 정리

| 개념 | 설명 |
|------|------|
| Pull-to-Refresh | Safari에서 최상단 스와이프 시 페이지를 새로고침하는 iOS 네이티브 기능 |
| `overscrollBehavior` | 스크롤 경계 도달 시 동작을 제어하는 CSS 속성. `none`으로 오버스크롤 비활성화 |
| `useEffect` cleanup | `useEffect`에서 반환하는 함수. 컴포넌트 언마운트 시 자동 실행되어 부작용 정리 |
| `passive: false` | `addEventListener` 옵션. 이 값이 있어야 `preventDefault()`로 스크롤 차단 가능 |
| `e.stopPropagation()` | 이벤트가 부모 요소로 전파되는 것을 막는 메서드 (버블링 차단) |
