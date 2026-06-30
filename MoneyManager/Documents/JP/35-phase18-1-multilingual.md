# Phase 18-1 — 多言語対応（韓国語 ↔ 日本語）学習文書

## 概要

Phase 18-1で実装した多言語対応（i18n）機能を説明します。

**実装機能:**
1. 韓国語 ↔ 日本語の切り替え（即時UI反映 + Firestore保存）
2. `LanguageContext` — React Contextでグローバル言語状態を管理
3. 翻訳マップ（`translations.ts`）— 型安全なUI文字列管理
4. もっとみるタブに言語設定UIセクションを追加
5. 日付フォーマットの言語別分岐（`6月18日 (月)` / `6월 18일 (월)`）

---

## 1. 多言語対応の核心概念

### なぜReact Contextを使うのか？

言語状態はアプリの全コンポーネント（タブバー、フォーム、詳細シートなど）で同時に必要です。
Propsで渡すと、中間コンポーネントまで不必要にpropsを受け取らなければならない**Props Drilling**問題が発生します。

React Contextは「グローバル倉庫」として機能します。

```
LanguageProvider（AppShellで全体ラップ）
  └── BottomNav        → useLanguage()で直接アクセス
  └── MonthSelector    → useLanguage()で直接アクセス
  └── HomeTab          → useLanguage()で直接アクセス
  └── CalendarTab      → useLanguage()で直接アクセス
  └── StatsTab         → useLanguage()で直接アクセス
  └── TransactionForm  → useLanguage()で直接アクセス
  └── MoreTab          → useLanguage()で直接アクセス
```

---

## 2. ファイル構造

```
frontend/src/
├── i18n/
│   └── translations.ts       # 翻訳マップ + Lang型 + DAY_NAMES
└── contexts/
    └── LanguageContext.tsx    # LanguageProvider + useLanguage()フック
```

---

## 3. translations.ts — 翻訳マップ

```typescript
export type Lang = 'ko' | 'ja';

// 曜日名（カレンダータブで使用）
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
    // ... 全UIテキスト
  },
  ja: {
    loading:       '読み込み中...',
    navHome:       'ホーム',
    navCalendar:   'カレンダー',
    formTitleAdd:  '取引を追加',
    txDelete:      '削除',
    moreLang:      '言語 / 언어',
    // ... 全UIテキスト
  },
} as const;

// TranslationKeyはkoオブジェクトの全キー名を自動的に型として生成します。
// 存在しないキーをt()に渡すとTypeScriptコンパイルエラーになります。
export type TranslationKey = keyof typeof translations.ko;
```

**`as const`の役割**
- `as const`なしでは`translations.ko.loading`の型は`string`
- `as const`使用時は型が`'불러오는 중...'`（リテラル型）— より正確な型推論が可能

---

## 4. LanguageContext.tsx — グローバル言語状態管理

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

  // アプリ起動時に保存された言語設定をロード
  useEffect(() => {
    getLanguageSetting()
      .then(({ language: saved }) => {
        if (saved === 'ko' || saved === 'ja') setLang(saved);
      })
      .catch(() => {});
  }, []);

  // 即時UI反映 + バックグラウンド保存
  const setLanguage = useCallback((lang: Lang) => {
    setLang(lang);                           // React state即時更新 → UI即時変更
    setLanguageSetting(lang).catch(() => {}); // Firestoreに非同期保存（次回接続時も維持）
  }, []);

  // t('key') → 現在の言語の翻訳文字列を返す
  const t = useCallback(
    (key: TranslationKey): string => translations[language][key] as string,
    [language]
  );

  // "2026-06" → "2026년 6월"（ko）/ "2026年6月"（ja）
  const formatYearMonth = useCallback((year: string, month: string) =>
    language === 'ko'
      ? `${year}년 ${Number(month)}월`
      : `${year}年${Number(month)}月`,
    [language]
  );

  // "2026-06-18" → "6월 18일 (수)"（ko）/ "6月18日 (水)"（ja）
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

### useCallbackを使う理由

`t`、`setLanguage`、`formatYearMonth`、`formatDateHeader`関数を`useCallback`でラップします。

- `useCallback`なし：`LanguageProvider`が再レンダリングされるたびに新しい関数オブジェクトが生成される
- `useCallback`使用時：`language`が変わった時だけ新しい関数を生成 → 不要な子コンポーネントの再レンダリングを防止

---

## 5. コンポーネントでの使い方

```typescript
// どのコンポーネントでもuseLanguage()一行でアクセス可能
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

## 6. 言語設定の保存フロー（即時反映 + 永続化）

```
ユーザー：言語ボタンをクリック
     │
     ├─ setLang('ja')               → React state更新 → UI即時「日本語」に変更
     │
     └─ setLanguageSetting('ja')    → PUT /settings/language（非同期、バックグラウンド）
                                       └─ Firestore settings/app_settings { language: 'ja' }

次回接続時：
  useEffect → getLanguageSetting() → GET /settings/language
            → Firestoreから'ja'を読み込み → setLang('ja') → 日本語で開始
```

**「即時反映 + 非同期保存」パターンの利点**
- ユーザーはAPIレスポンスを待たなくてよい（即座なUX）
- API失敗時でも現在のセッションでは希望の言語を使い続けられる

---

## 7. バックエンド — 言語設定API

### firestore.ts

```typescript
const SETTINGS_DOC = 'app_settings';

export async function getLanguage(): Promise<string> {
  const doc = await db.collection('settings').doc(SETTINGS_DOC).get();
  if (!doc.exists) return 'ko';                          // デフォルト値：韓国語
  return (doc.data() as { language?: string }).language ?? 'ko';
}

export async function setLanguage(lang: string): Promise<void> {
  // merge: true → 既存のpinフィールドを上書きせず、languageフィールドのみ更新
  await db.collection('settings').doc(SETTINGS_DOC).set({ language: lang }, { merge: true });
}
```

### routes/settings.ts

```typescript
// GET /settings/language — 保存された言語を取得
router.get('/language', async (_req, res) => {
  const language = await getLanguage();
  res.json({ language });
});

// PUT /settings/language — 言語変更を保存
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

## 8. Firestoreデータ構造

`settings/app_settings`ドキュメントに既存のPIN設定と一緒に保存されます。

```
Firestore
└── settings（コレクション）
    └── app_settings（ドキュメント）
        ├── pin: "1234"          ← Phase 7から存在
        └── language: "ja"       ← Phase 18-1で追加
```

`merge: true`オプションにより、`setLanguage()`呼び出し時に`pin`フィールドが消えません。

---

## 9. 言語切り替えUI（もっとみるタブ）

もっとみるタブに**言語設定**アコーディオンセクションが追加されました。

```
もっとみるタブ
  ├─ 🔐 PIN番号変更
  ├─ 💰 予算設定
  ├─ 📂 カテゴリ管理
  ├─ 🌐 言語 / 언어  ← 新規追加
  │     現在の選択: 한국어 / 日本語
  │     [🇰🇷 한국어]  [🇯🇵 日本語]   （選択中はaccentカラーで強調）
  ├─ 🔔 LINE通知
  └─ 🗑️ データ初期化
```

---

## 10. 翻訳対象と非対象

| 対象 | 非対象 |
|------|--------|
| 全UIラベル、ボタンテキスト | カテゴリ名（食費、交通費など） |
| エラーメッセージ | メモ内容（ユーザー入力） |
| 日付・年月フォーマット | 金額（¥記号はそのまま） |
| 曜日名（일~토 / 日~土） | |

カテゴリ名とメモは**Firestoreに保存されたユーザーデータ**なので翻訳対象外です。

---

## 11. TypeScript型安全性

```typescript
// TranslationKey = 'loading' | 'loadError' | 'navHome' | 'navCalendar' | ...
// （koオブジェクトの全キーを自動的にUnion型として生成）
export type TranslationKey = keyof typeof translations.ko;

// 存在しないキー使用時はコンパイルエラー
t('nonExistentKey'); // TypeScript Error: '"nonExistentKey"' is not assignable to 'TranslationKey'
```

これにより、翻訳キーのタイポや漏れをデプロイ前に発見できます。
