# Phase 14.3 — ホームタブ取引履歴UX改善 学習文書

## 概要

Phase 14.3で実装した4つの機能をコードと共に説明します。

1. **日付ヘッダー区切り線** — ヘッダーと項目の間の視覚的な境界
2. **日付別純収益の表示** — 収入と支出の両方がある日に純収益を計算
3. **取引項目クリック → 詳細シート** — 下からスライドアップする詳細情報パネル
4. **取引の編集/削除** — TransactionFormを再利用した編集 + 削除確認の2段階

---

## 1. 日付ヘッダー区切り線（border-b）

```tsx
<div
  className="flex justify-between items-center px-1 pb-1 mb-1"
  style={{ borderBottom: '1px solid var(--border)' }}
>
  <span>{formatDateHeader(group.date)}</span>
  <div>{/* 小計 */}</div>
</div>
```

`border-b` Tailwindクラスの代わりにインラインスタイルでCSS変数 `--border` を参照します。
CSS変数はダークテーマ切り替え時に自動で値が変わるため、ハードコードされた色よりも安全です。

---

## 2. 日付別純収益の表示

```tsx
const net = group.totalIncome - group.totalExpense;

{/* 収入と支出の両方がある場合のみ表示 */}
{group.totalIncome > 0 && group.totalExpense > 0 && (
  <span style={{ color: net >= 0 ? 'var(--income)' : 'var(--expense)' }}>
    ={formatYen(Math.abs(net))}
  </span>
)}
```

2つの条件 `totalIncome > 0 && totalExpense > 0` の両方を満たす場合のみ表示します。
どちらか一方しかない日（支出のみまたは収入のみ）は小計で既に明確に表示されるため純収益は不要です。

---

## 3. 取引項目クリック — 詳細シート

### 状態構造

```tsx
const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
const [deleteConfirm, setDeleteConfirm] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);
const [deleteError,   setDeleteError]   = useState('');
```

`selectedTx` が null ならシートなし、値があればシートを表示します。
内部で `deleteConfirm` を使って詳細表示 ↔ 削除確認の段階を切り替えます。

### クリックハンドラー

```tsx
<div
  className="... cursor-pointer active:opacity-60 transition-opacity"
  onClick={() => {
    setSelectedTx(tx);
    setDeleteConfirm(false);
    setDeleteError('');
  }}
>
```

`active:opacity-60`：タッチ時の視覚的フィードバック（モバイルのタップ効果）。

### シートのレイアウト

```tsx
{selectedTx && (
  <div
    className="fixed inset-0 z-50 flex flex-col justify-end"
    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    onClick={closeDetail}   {/* オーバーレイクリック → 閉じる */}
  >
    <div
      ref={detailSheetRef}
      className="rounded-t-2xl w-full max-w-md self-center"
      onClick={e => e.stopPropagation()}  {/* シート内部クリックのバブリングを阻止 */}
    >
      ...
    </div>
  </div>
)}
```

`fixed inset-0` — ビューポート全体を覆う半透明オーバーレイ。
`justify-end` — シートを画面下部に配置。
`stopPropagation()` — シート内部のクリックがオーバーレイの閉じるイベントに伝播しないよう阻止。

### iOS Safari 背景スクロールの阻止

```tsx
const detailSheetRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!selectedTx) return;
  const prevent = (e: TouchEvent) => {
    if (detailSheetRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', prevent, { passive: false });
  return () => document.removeEventListener('touchmove', prevent);
}, [selectedTx]);
```

iOS Safariでは `overflow: hidden` だけでは背景スクロールが阻止されません。
`document` に `{ passive: false }` オプションで touchmove リスナーを登録し、
`e.preventDefault()` を呼び出すことで背景スクロールを防ぎます。
シート内部（`detailSheetRef.current?.contains`）は例外処理してシート内のスクロールは許可します。

---

## 4. 取引の編集 — TransactionFormの再利用

### Props拡張（TransactionForm）

```tsx
interface TransactionFormProps {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Transaction;  // 編集モードの際に注入
}

const isEdit = !!initialData?.id;
const [amount, setAmount] = useState(
  initialData?.amount ? String(initialData.amount) : ''
);
```

`initialData` があれば編集モード、なければ追加モードです。
状態の初期値を `initialData` から読み込む方式で既存データをフォームに入力します。

### 保存の分岐

```tsx
if (isEdit && initialData?.id) {
  await updateTransaction(initialData.id, data);  // PUT
} else {
  await createTransaction(data);                   // POST
}
```

### MainAppから編集フォームを開く

```tsx
// 編集する取引の状態
const [editingTx, setEditingTx] = useState<Transaction | null>(null);

// HomeTab にコールバックを渡す
<HomeTab onEdit={setEditingTx} ... />

// 編集フォームのレンダリング
{editingTx && (
  <TransactionForm
    initialData={editingTx}
    onClose={() => setEditingTx(null)}
    onSaved={() => { setEditingTx(null); handleSaved(); }}
  />
)}
```

`onSaved` で `editingTx` を null に初期化した後、`handleSaved()` でリストも更新します。

---

## 5. 取引の削除 — 2段階確認

### フロー

```
[削除] ボタンクリック
  → setDeleteConfirm(true) → 確認画面に切り替え
    → [キャンセル]：setDeleteConfirm(false) → 詳細表示に戻る
    → [削除]：DELETE /transactions/:id を呼び出し
      → 成功：closeDetail() + onRefresh()
      → 失敗：deleteError を表示
```

### 削除ハンドラー

```tsx
const handleDelete = async () => {
  if (!selectedTx?.id) return;
  setDeleteLoading(true);
  setDeleteError('');
  try {
    await deleteTransaction(selectedTx.id);
    closeDetail();   // シートを閉じる
    onRefresh();     // リストを更新（refreshKey++）
  } catch {
    setDeleteError('削除に失敗しました。再度お試しください。');
  } finally {
    setDeleteLoading(false);
  }
};
```

---

## 6. HomeTab Props拡張 — MainAppとの通信

```tsx
interface HomeTabProps {
  yearMonth: string;
  refreshKey: number;
  onRefresh: () => void;   // 削除完了 → MainApp refreshKey++
  onEdit: (tx: Transaction) => void;  // 編集クリック → MainApp editingTx を設定
}
```

### MainApp hasModalロジック

```tsx
const hasModal = showForm || !!editingTx;

<main className={`flex-1 flex flex-col ${hasModal ? 'overflow-hidden' : 'overflow-y-auto'}`}>
```

追加フォーム（`showForm`）と編集フォーム（`editingTx`）のいずれかが開いていれば
背景スクロールを阻止します。

---

## 7. E2Eテスト — route.fallback() パターン

Phase 14.3でDELETEリクエストをモッキングする際に `route.fallback()` パターンを使用しました。

```typescript
// beforeEach で mockTransactions が **/transactions* を先に登録
// 個別テストで DELETE のモッキングを後で登録 → LIFO優先順位で先に実行
await page.route('**/transactions/**', route => {
  if (route.request().method() === 'DELETE') {
    return route.fulfill({ status: 204 });
  }
  route.fallback(); // GET など他のメソッド → 以前のハンドラー（mockTransactions）に委譲
});
```

### route.continue() vs route.fallback()

| | `route.continue()` | `route.fallback()` |
|---|---|---|
| 動作 | 実際のネットワークにリクエストを転送 | 次に登録されたPlaywrightハンドラーに転送 |
| 使用タイミング | 実サーバーにリクエストを送る必要がある場合 | 別のモックハンドラーに委譲する場合 |
| 利用可能バージョン | 全バージョン | Playwright 1.23+ |

---

## まとめ

| 機能 | 核心技術 | ファイル |
|---|---|---|
| 日付ヘッダー区切り線 | CSS変数 `--border` インラインスタイル | `HomeTab.tsx` |
| 純収益の表示 | 条件付きレンダリング（収入 > 0 && 支出 > 0） | `HomeTab.tsx` |
| 詳細シート | `fixed inset-0 z-50` + stopPropagation | `HomeTab.tsx` |
| iOSスクロール阻止 | touchmove `preventDefault` + `passive: false` | `HomeTab.tsx` |
| 取引の編集 | `initialData?: Transaction` prop + PUT分岐 | `TransactionForm.tsx` |
| 取引の削除 | 2段階確認 + DELETE API | `HomeTab.tsx` |
| hasModalロジック | `showForm \|\| !!editingTx` | `MainApp.tsx` |
| E2E DELETE モッキング | `route.fallback()` LIFOパターン | `home-tab.spec.ts` |
