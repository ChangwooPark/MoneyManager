# Phase 18-1 — 다국어 지원 (한국어 ↔ 일본어) 학습 문서

## 개요

Phase 18-1에서 구현한 다국어 지원(i18n) 기능을 설명합니다.

**구현 기능:**
1. 한국어 ↔ 일본어 전환 (즉시 UI 반영 + Firestore 저장)
2. `LanguageContext` — React Context로 전역 언어 상태 관리
3. 번역 맵 (`translations.ts`) — 타입 안전 UI 문자열 관리
4. 더보기 탭에 언어 설정 UI 섹션 추가
5. 날짜 포맷 언어별 분기 (`6月18日 (月)` / `6월 18일 (월)`)

---

## 1. 다국어 지원의 핵심 개념

### 왜 React Context를 사용하나?

언어 상태는 앱의 모든 컴포넌트(탭바, 폼, 상세 시트 등)에서 동시에 필요합니다.
Props로 전달하면 중간 컴포넌트까지 불필요하게 props를 받아야 하는 **Props Drilling** 문제가 생깁니다.

React Context는 "전역 창고"처럼 작동합니다.

```
LanguageProvider (AppShell에서 전체 래핑)
  └── BottomNav        → useLanguage() 로 직접 접근
  └── MonthSelector    → useLanguage() 로 직접 접근
  └── HomeTab          → useLanguage() 로 직접 접근
  └── CalendarTab      → useLanguage() 로 직접 접근
  └── StatsTab         → useLanguage() 로 직접 접근
  └── TransactionForm  → useLanguage() 로 직접 접근
  └── MoreTab          → useLanguage() 로 직접 접근
```

---

## 2. 파일 구조

```
frontend/src/
├── i18n/
│   └── translations.ts       # 번역 맵 + Lang 타입 + DAY_NAMES
└── contexts/
    └── LanguageContext.tsx    # LanguageProvider + useLanguage() 훅
```

---

## 3. translations.ts — 번역 맵

```typescript
export type Lang = 'ko' | 'ja';

// 요일 이름 (달력 탭에서 사용)
export const DAY_NAMES: Record<Lang, readonly string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

export const translations = {
  ko: {
    loading:       '불러오는 중...',
    navHome:       '홈',
    navCalendar:   '달력',
    formTitleAdd:  '내역 추가',
    txDelete:      '삭제',
    moreLang:      '언어 / 言語',
    // ... 모든 UI 문자열
  },
  ja: {
    loading:       '読み込み中...',
    navHome:       'ホーム',
    navCalendar:   'カレンダー',
    formTitleAdd:  '取引を追加',
    txDelete:      '削除',
    moreLang:      '言語 / 언어',
    // ... 모든 UI 문자열
  },
} as const;

// TranslationKey는 ko 객체의 모든 키 이름을 자동으로 타입으로 만들어줍니다.
// 존재하지 않는 키를 t()에 전달하면 TypeScript 컴파일 에러가 발생합니다.
export type TranslationKey = keyof typeof translations.ko;
```

**`as const` 의 역할**
- `as const` 없이는 `translations.ko.loading`의 타입이 `string`
- `as const` 사용 시 타입이 `'불러오는 중...'` (리터럴 타입) — 더 정확한 타입 추론 가능

---

## 4. LanguageContext.tsx — 전역 언어 상태 관리

```typescript
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, DAY_NAMES, Lang, TranslationKey } from '@/i18n/translations';
import { getLanguageSetting, setLanguageSetting } from '@/lib/api';

interface LanguageContextValue {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  formatYearMonth: (year: string, month: string) => string;
  formatDateHeader: (dateStr: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Lang>('ko');

  // 앱 시작 시 저장된 언어 설정 로드
  useEffect(() => {
    getLanguageSetting()
      .then(({ language: saved }) => {
        if (saved === 'ko' || saved === 'ja') setLang(saved);
      })
      .catch(() => {});
  }, []);

  // 즉시 UI 반영 + 백그라운드 저장
  const setLanguage = useCallback((lang: Lang) => {
    setLang(lang);                          // React state 즉시 업데이트 → UI 즉시 변경
    setLanguageSetting(lang).catch(() => {}); // Firestore에 비동기 저장 (다음 접속 시 유지)
  }, []);

  // t('key') → 현재 언어의 번역 문자열 반환
  const t = useCallback(
    (key: TranslationKey): string => translations[language][key] as string,
    [language]
  );

  // "2026-06" → "2026년 6월" (ko) / "2026年6月" (ja)
  const formatYearMonth = useCallback((year: string, month: string) =>
    language === 'ko'
      ? `${year}년 ${Number(month)}월`
      : `${year}年${Number(month)}月`,
    [language]
  );

  // "2026-06-18" → "6월 18일 (수)" (ko) / "6月18日 (水)" (ja)
  const formatDateHeader = useCallback((dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayName = DAY_NAMES[language][new Date(y, m - 1, d).getDay()];
    return language === 'ko'
      ? `${m}월 ${d}일 (${dayName})`
      : `${m}月${d}日 (${dayName})`;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatYearMonth, formatDateHeader }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
```

### useCallback을 사용하는 이유

`t`, `setLanguage`, `formatYearMonth`, `formatDateHeader` 함수들을 `useCallback`으로 감쌉니다.

- `useCallback` 없으면: `LanguageProvider`가 리렌더링될 때마다 새 함수 객체가 생성됨
- `useCallback` 사용 시: `language`가 바뀔 때만 새 함수 생성 → 불필요한 자식 컴포넌트 리렌더링 방지

---

## 5. 컴포넌트에서 사용하는 방법

```typescript
// 어느 컴포넌트에서나 useLanguage() 한 줄로 접근
import { useLanguage } from '@/contexts/LanguageContext';

export default function SomeComponent() {
  const { t, language, setLanguage, formatYearMonth, formatDateHeader } = useLanguage();

  return (
    <div>
      <p>{t('loading')}</p>                           {/* "불러오는 중..." / "読み込み中..." */}
      <p>{formatYearMonth('2026', '06')}</p>           {/* "2026년 6월" / "2026年6月" */}
      <p>{formatDateHeader('2026-06-18')}</p>          {/* "6월 18일 (수)" / "6月18日 (水)" */}
      <button onClick={() => setLanguage('ja')}>日本語</button>
    </div>
  );
}
```

---

## 6. 언어 설정 저장 흐름 (즉시 반영 + 지속성)

```
사용자: 言語 버튼 클릭
     │
     ├─ setLang('ja')               → React state 업데이트 → UI 즉시 '일본어'로 변경
     │
     └─ setLanguageSetting('ja')    → PUT /settings/language (비동기, 백그라운드)
                                       └─ Firestore settings/app_settings { language: 'ja' }

다음 접속 시:
  useEffect → getLanguageSetting() → GET /settings/language
            → Firestore에서 'ja' 읽기 → setLang('ja') → 일본어로 시작
```

**"즉시 반영 + 비동기 저장" 패턴의 장점**
- 사용자는 API 응답을 기다리지 않아도 됨 (즉각적인 UX)
- API 실패 시에도 현재 세션에서는 원하는 언어로 계속 사용 가능

---

## 7. 백엔드 — 언어 설정 API

### firestore.ts

```typescript
const SETTINGS_DOC = 'app_settings';

export async function getLanguage(): Promise<string> {
  const doc = await db.collection('settings').doc(SETTINGS_DOC).get();
  if (!doc.exists) return 'ko';                          // 기본값: 한국어
  return (doc.data() as { language?: string }).language ?? 'ko';
}

export async function setLanguage(lang: string): Promise<void> {
  // merge: true → 기존 pin 필드를 덮어쓰지 않고 language 필드만 업데이트
  await db.collection('settings').doc(SETTINGS_DOC).set({ language: lang }, { merge: true });
}
```

### routes/settings.ts

```typescript
// GET /settings/language — 저장된 언어 조회
router.get('/language', async (_req, res) => {
  const language = await getLanguage();
  res.json({ language });
});

// PUT /settings/language — 언어 변경 저장
router.put('/language', async (req, res) => {
  const { language } = req.body;
  if (!language || !['ko', 'ja'].includes(language)) {
    res.status(400).json({ error: 'language must be "ko" or "ja"' });
    return;
  }
  await setLanguage(language);
  res.json({ language });
});
```

---

## 8. Firestore 데이터 구조

`settings/app_settings` 문서에 기존 PIN 설정과 함께 저장됩니다.

```
Firestore
└── settings (컬렉션)
    └── app_settings (문서)
        ├── pin: "1234"          ← Phase 7부터 존재
        └── language: "ja"       ← Phase 18-1에서 추가
```

`merge: true` 옵션 덕분에 `setLanguage()` 호출 시 `pin` 필드가 지워지지 않습니다.

---

## 9. 언어 전환 UI (더보기 탭)

더보기 탭에 **언어 설정** 아코디언 섹션이 추가되었습니다.

```
더보기 탭
  ├─ 🔐 PIN 번호 변경
  ├─ 💰 예산 설정
  ├─ 📂 카테고리 관리
  ├─ 🌐 언어 / 言語  ← 신규 추가
  │     현재 선택: 한국어 / 日本語
  │     [🇰🇷 한국어]  [🇯🇵 日本語]   (선택된 쪽은 accent 색상으로 강조)
  ├─ 🔔 LINE 알림
  └─ 🗑️ 데이터 초기화
```

---

## 10. 번역 대상과 비대상

| 대상 | 비대상 |
|------|--------|
| 모든 UI 레이블, 버튼 텍스트 | 카테고리 이름 (식비, 교통 등) |
| 에러 메시지 | 메모 내용 (사용자 입력) |
| 날짜/연월 포맷 | 금액 (¥ 기호는 그대로) |
| 요일 이름 (일~토 / 日~土) | |

카테고리 이름과 메모는 **Firestore에 저장된 사용자 데이터**이므로 번역 대상이 아닙니다.

---

## 11. TypeScript 타입 안전성

```typescript
// TranslationKey = 'loading' | 'loadError' | 'navHome' | 'navCalendar' | ...
// (ko 객체의 모든 키를 자동으로 Union 타입으로 생성)
export type TranslationKey = keyof typeof translations.ko;

// 존재하지 않는 키 사용 시 컴파일 에러
t('nonExistentKey'); // TypeScript Error: '"nonExistentKey"' is not assignable to 'TranslationKey'
```

이 덕분에 번역 키 오타나 누락을 배포 전에 발견할 수 있습니다.
