# Phase 14.2 — もっとみるタブ機能強化 学習文書

## 概要

Phase 14.2で実装した2つの機能をコードと共に説明します。

1. **アコーディオン単一開き** — 一度に一つのセクションだけ展開するUIパターン
2. **データ初期化** — PIN 2段階認証後に全取引履歴を削除

---

## 1. アコーディオン単一開き（Accordion Single-Open）

### 問題

以前はPIN変更・予算設定それぞれが独立した `boolean` 状態を持っていました。

```tsx
// 以前：各セクション独立 boolean
const [pinOpen,    setPinOpen]    = useState(false);
const [budgetOpen, setBudgetOpen] = useState(false);
```

2つのセクションを同時に展開しても何の制約もありませんでした。

### 解決原理：単一状態に統合

```tsx
// 変更：一つの string | null 値で管理
type OpenSection = 'pin' | 'budget' | 'reset' | null;
const [openSection, setOpenSection] = useState<OpenSection>(null);

// トグル関数：同じセクション → 閉じる(null)、別のセクション → 開く
const toggleSection = (section: OpenSection) => {
  setOpenSection(prev => prev === section ? null : section);
};
```

```tsx
// ヘッダーボタン：toggleSection を呼び出す
<button onClick={() => toggleSection('pin')}>PIN番号の変更</button>

// 展開エリア：openSection の値だけで表示/非表示を決定
{openSection === 'pin' && <PinForm />}
{openSection === 'budget' && <BudgetForm />}
```

### セクション切り替え時にフォーム状態を初期化

セクションが閉じる際に以前入力した値が残らないよう `useEffect` で初期化します。

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

`openSection` が変わるたびに実行されるので、予算セクションを開くとPIN入力値が自動的にクリアされます。

### パターン比較

| | boolean独立方式 | string \| null単一方式 |
|---|---|---|
| 同時開きが可能 | ✅ | ❌（一つだけ開く） |
| 新しいセクション追加 | boolean変数を追加が必要 | union型に値を追加するだけ |
| 状態数 | セクション数 × 1 | 常に1つ |

---

## 2. データ初期化 — 2段階認証後に全削除

### フロー

```
[データ初期化] クリック
  → アコーディオンが開く（Step 1: PIN入力）
  → PIN 4桁を入力して [確認] クリック
    → サーバーPIN検証（POST /settings/pin/verify）
    → 失敗：「PINが正しくありません」エラーを表示
    → 成功：Step 2に切り替え（最終確認画面）
  → [初期化] クリック
    → DELETE /transactions/all を呼び出し
    → 成功：「初期化が完了しました ✓」+ ホーム/カレンダー/統計タブを更新
    → 失敗：エラーメッセージ + Step 1に戻る
```

### 状態設計

```tsx
const [resetPin,     setResetPin]     = useState('');
const [resetStep,    setResetStep]    = useState<'pin' | 'confirm'>('pin');
const [resetLoading, setResetLoading] = useState(false);
const [resetError,   setResetError]   = useState('');
const [resetSuccess, setResetSuccess] = useState(false);
```

`resetStep` で現在どの段階かを追跡します。ステートマシン（State Machine）を最小限に実装したパターンです。

### Step 1: PIN検証

```tsx
const handleResetVerifyPin = async () => {
  setResetError('');
  if (!/^\d{4}$/.test(resetPin)) { setResetError('PIN4桁を入力してください'); return; }

  setResetLoading(true);
  try {
    const res = await verifyPin(resetPin);
    if (res.success) {
      setResetStep('confirm'); // → Step 2
    } else {
      setResetError('PINが正しくありません');
    }
  } catch {
    setResetError('確認に失敗しました。再度お試しください。');
  } finally {
    setResetLoading(false);
  }
};
```

### Step 2: 全削除の実行

```tsx
const handleResetConfirm = async () => {
  setResetLoading(true);
  try {
    await deleteAllTransactions();
    setResetSuccess(true);
    onReset?.();                // ホーム・カレンダー・統計タブの refreshKey を増加
    setTimeout(() => {
      setResetSuccess(false);
      setOpenSection(null);     // アコーディオンを閉じる
    }, 2000);
  } catch {
    setResetError('初期化に失敗しました。再度お試しください。');
    setResetStep('pin');        // エラー時に Step 1 に戻る
  } finally {
    setResetLoading(false);
  }
};
```

### onReset prop：タブ間データ更新

`MoreTab` はホーム・カレンダー・統計タブの `refreshKey` に直接アクセスできません。
`MainApp` が `onReset` コールバックを渡して、初期化完了時に全タブを更新します。

```tsx
// MainApp.tsx
const handleSaved = () => setRefreshKey(k => k + 1);

{activeTab === 'more' && <MoreTab onReset={handleSaved} />}
```

```tsx
// MoreTab.tsx
interface MoreTabProps {
  onReset?: () => void; // 初期化完了時に呼び出す
}
export default function MoreTab({ onReset }: MoreTabProps) {
  ...
  onReset?.(); // Optional chainingでundefinedを安全に呼び出し
}
```

---

## 3. バックエンド：DELETE /transactions/all

### Firestore batch delete

FirestoreのWriteBatchは一度に最大500個の操作を処理できます。
500個を超える場合は複数のバッチに分けて処理します。

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

### ルート登録順序が重要

Expressではルートは登録順に一致します。
`DELETE /:id` が先に登録されると `'all'` という文字列が `:id` としてパースされ、`DELETE /all` が機能しません。

```typescript
// transactions.ts — 必ず /:id より前に配置
router.delete('/all', async (_req, res) => {
  const count = await deleteAllTransactions();
  res.json({ deleted: count });
});

router.delete('/:id', async (req, res) => { ... });
```

---

## 4. E2Eテスト — 新しいパターン

### Playwright route override（後順位 > 先順位）

`setupApp` がPIN検証を `{ success: true }` でモッキングした後、
特定のテストで失敗ケースをテストするには同じURLパターンを再登録します。
Playwrightでは**後から登録されたハンドラーが先に実行**されます。

```typescript
test('誤ったPIN入力時にエラーメッセージ', async ({ page }) => {
  await setupApp(page); // success: true のモッキングを登録
  // 後で登録 → 優先度が高い → success: false が実際に適用される
  await page.route('**/settings/pin/verify', route =>
    route.fulfill({ json: { success: false } })
  );
  ...
});
```

### exact: true でテキスト衝突を防ぐ

「データ初期化」ヘッダーボタンが `getByRole('button', { name: '初期化' })` にもマッチする問題が発生します。
（ボタンテキストが「データ初期化」なので部分マッチ）

```typescript
// ❌ 2つマッチ：「データ初期化」ヘッダー + 「初期化」確認ボタン
await page.getByRole('button', { name: '初期化' }).click();

// ✅ 正確に「初期化」テキストのみマッチ
await page.getByRole('button', { name: '初期化', exact: true }).click();
```

---

## まとめ

| 改善項目 | 核心技術 | ファイル |
|---|---|---|
| アコーディオン単一開き | `string \| null` 単一状態 + useEffect初期化 | `MoreTab.tsx` |
| データ初期化UI | 2段階ステートマシン（`'pin' \| 'confirm'`） | `MoreTab.tsx` |
| onResetコールバック | optional prop + optional chaining | `MainApp.tsx`、`MoreTab.tsx` |
| Batch delete | Firestore `WriteBatch` 500個単位 | `firestore.ts` |
| DELETE /all ルート | Expressルート登録順序 | `transactions.ts` |
