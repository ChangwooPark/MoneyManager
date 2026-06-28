# Phase 19-1 — 取引詳細シートの共通化 + ボトムシート最小高さ 学習ドキュメント

## 概要

Phase 19-1で実装した2つの改善事項をコードとともに説明します。

1. **ボトムシート最小高さの統一 (18-2)** — コンテンツが少なくてもシートが小さく表示されないよう `minHeight` を追加
2. **取引詳細シートの共通コンポーネント分離 (18-3)** — カレンダー・統計タブでも取引クリック時に詳細/編集/削除が可能に

---

## 1. ボトムシート最小高さ (minHeight)

### 問題

既存のボトムシートには `maxHeight: '65vh'` のみで `minHeight` がありませんでした。
取引が1〜2件しかない日にカレンダーの日付シートを開くと、シートが画面下部に小さく表示されてしまう不便さがありました。

### 解決策

```tsx
style={{
  maxHeight: '65vh',
  minHeight: '66vh',   // 追加 — 常に画面の2/3以上を占めるよう設定
}}
```

`minHeight: '66vh'` を追加し、コンテンツが少なくてもシートが画面の約2/3の高さを保ちます。

### 適用対象

| コンポーネント | 役割 |
|---------|------|
| `TransactionForm` | FAB 取引入力フォーム |
| `CalendarTab` | 日付詳細シート |
| `TransactionDetailSheet` | 取引詳細/編集/削除シート |
| `StatsTab` | カテゴリ詳細シート |

---

## 2. 取引詳細シートの共通コンポーネント分離

### 背景

Phase 14.3で `HomeTab.tsx` 内に取引詳細シートをインラインで実装しました。
しかし、カレンダータブ (CalendarTab) と統計タブ (StatsTab) にも同じ機能が必要になりました。
3ヵ所のコードをそれぞれ管理するのはメンテナンスが難しいため、共通コンポーネントとして抽出しました。

### コンポーネント設計

```
TransactionDetailSheet.tsx
├── Props
│   ├── transaction: Transaction   (表示する取引データ)
│   ├── onClose: () => void        (シートを閉じる)
│   ├── onEdit: (tx) => void       (編集ボタン → MainAppでTransactionFormを開く)
│   └── onDeleted: () => void      (削除完了 → 親でリスト更新)
└── 内部状態
    ├── deleteConfirm: boolean     (削除確認ステップ)
    ├── deleteLoading: boolean     (削除API呼び出し中)
    └── deleteError: string        (削除失敗メッセージ)
```

### コード — コンポーネントの骨格

```tsx
// src/components/features/transaction/TransactionDetailSheet.tsx
export default function TransactionDetailSheet({
  transaction, onClose, onEdit, onDeleted,
}: TransactionDetailSheetProps) {

  const handleDelete = async () => {
    await deleteTransaction(transaction.id);
    onClose();
    onDeleted();   // 親でrefreshKey増加 → リスト更新
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" ...>
      <div style={{ minHeight: '66vh' }} ...>
        {!deleteConfirm ? <詳細表示 /> : <削除確認 />}
      </div>
    </div>
  );
}
```

### z-index設計

```
カレンダー/統計のサブシート オーバーレイ  z-40
カレンダー/統計のサブシート 本体          z-50
統計タブ 収入/支出切替タブ               z-60
TransactionDetailSheet オーバーレイ      z-70  ← すべてのサブシートの上に表示
TransactionDetailSheet 本体              z-80
```

カレンダーの日付シート (z-50) 内で取引をクリックすると、TransactionDetailSheet (z-70) が日付シートの上に重なって表示されます。

---

## 3. CalendarTab / StatsTab の変更点

### Props拡張

```tsx
// 変更前
interface CalendarTabProps {
  yearMonth: string;
  refreshKey: number;
}

// 変更後
interface CalendarTabProps {
  yearMonth: string;
  refreshKey: number;
  onEdit:    (tx: Transaction) => void;  // 追加
  onRefresh: () => void;                 // 追加
}
```

### 取引行のクリック処理

```tsx
// 変更前 — クリック不可（表示のみ）
<div className="flex items-center justify-between px-4 py-3 gap-3">

// 変更後 — クリックで詳細シートを開く
<div
  className="flex items-center justify-between px-4 py-3 gap-3
             cursor-pointer active:opacity-60 transition-opacity"
  onClick={() => setSelectedTx(tx)}
>
```

### TransactionDetailSheetのマウント

```tsx
{selectedTx && (
  <TransactionDetailSheet
    transaction={selectedTx}
    onClose={() => setSelectedTx(null)}
    onEdit={onEdit}
    onDeleted={() => {
      setSelectedTx(null);
      setSelectedDate(null);  // 日付シートも閉じる
      onRefresh();            // カレンダーデータ更新
    }}
  />
)}
```

削除完了時に `onDeleted` で日付シートも閉じます。詳細シートだけ閉じると、日付シートに削除済み取引が一瞬残って表示される問題が起きるためです。

---

## 4. MainApp の変更点

CalendarTabとStatsTabが新しいpropsを受け取れるよう、MainAppから渡します。

```tsx
// 変更前
<CalendarTab yearMonth={yearMonth} refreshKey={refreshKey} />
<StatsTab    yearMonth={yearMonth} refreshKey={refreshKey} />

// 変更後
<CalendarTab
  yearMonth={yearMonth}
  refreshKey={refreshKey}
  onEdit={setEditingTx}     // 編集フォームを開く
  onRefresh={handleSaved}   // refreshKey増加
/>
<StatsTab
  yearMonth={yearMonth}
  refreshKey={refreshKey}
  onEdit={setEditingTx}
  onRefresh={handleSaved}
/>
```

`setEditingTx` はMainAppにもともとあった状態更新関数です。
`editingTx` が設定されると、MainApp最下部に編集モードの `TransactionForm` が開きます。

---

## 5. Reactコンポーネント設計の原則 — Props Drilling

今回の変更では **Props Drilling** パターンを適用しました。

```
MainApp
├── setEditingTx (状態更新関数)
└── handleSaved  (refreshKey増加関数)
      ↓ propsで渡す
CalendarTab / StatsTab
      ↓ propsで渡す
TransactionDetailSheet
```

- **Props Drilling**: 上位コンポーネントの状態や関数を複数段階の子コンポーネントへ渡すパターン
- メリット: Redux・Zustandなどの状態管理ライブラリなしでシンプルに実装できる
- デメリット: コンポーネントの階層が深くなるほどコードが煩雑になる（今回は3段階程度で適切な規模）

---

## 6. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| `minHeight` | 要素の最小高さ。`maxHeight` と組み合わせることでコンテンツ量に関わらず一定範囲のサイズを保つ |
| `z-index` | 要素の重なり順。数字が大きいほど前面に表示。`fixed` ポジションで効果あり |
| Props Drilling | 親 → 子 → 孫の順にデータ/関数をpropsで渡すパターン |
| コンポーネント抽出 | 繰り返されるUIブロックを別コンポーネントファイルに分離し、再利用性とメンテナンス性を高めるリファクタリング手法 |
