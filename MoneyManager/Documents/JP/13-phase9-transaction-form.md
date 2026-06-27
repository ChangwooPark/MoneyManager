# Phase 9: 取引履歴入力フォーム

## このフェーズで行ったこと

アプリで収入/支出の履歴を入力するフォームを実装しました。
画面右下のFAB（Floating Action Button）`+`ボタンを押すと
下からスライドアップするボトムシート（Bottom Sheet）形式の入力フォームが開きます。

---

## 実装画面構成

```
┌─────────────────────────┐
│      MonthSelector       │
├─────────────────────────┤
│                         │
│      タブコンテンツ      │
│                         │
│                   [+]   │  ← FABボタン（右下固定）
├─────────────────────────┤
│  🏠    📅    📊    ⋯   │
└─────────────────────────┘

            ↓ FABクリック

┌─────────────────────────┐
│  暗いオーバーレイ         │  ← クリックでフォームを閉じる
├──────────────────────── ┤
│  ────── （ハンドルバー）  │
│  履歴を追加         ✕   │
│                         │
│  [ 支出 ]  [  収入  ]   │  ← トグル
│                         │
│  日付: [2026-06-17    ] │
│  内容: [昼食          ] │
│  金額: [¥ 1500  ¥1,500] │
│  メモ: [任意入力      ] │
│                         │
│  [       保存       ]   │
└─────────────────────────┘
```

---

## 作成/更新されたファイル

### `src/components/features/transaction/TransactionForm.tsx`（新規）

取引履歴入力ボトムシートコンポーネントです。

**Props：**

```typescript
interface TransactionFormProps {
  onClose: () => void;  // キャンセルまたは保存完了後にフォームを閉じる
  onSaved: () => void;  // 保存成功時に親に通知してリストを更新
}
```

**主なState：**

| State | 型 | デフォルト値 | 説明 |
|------|------|--------|------|
| `type` | `'income' \| 'expense'` | `'expense'` | 収入/支出の区分 |
| `date` | `string` | 今日の日付 | YYYY-MM-DD 形式 |
| `category` | `string` | `''` | 内容（必須） |
| `amount` | `string` | `''` | 金額、文字列で管理して保存時に数値変換 |
| `memo` | `string` | `''` | メモ（任意） |
| `loading` | `boolean` | `false` | 保存中ボタン無効化 |
| `error` | `string` | `''` | バリデーションエラー表示 |

**保存処理フロー：**

```
1. バリデーション: category が空 → エラー表示
                  amount ≤ 0   → エラー表示

2. createTransaction(data) 呼び出し → バックエンド POST /transactions

3. 成功: onSaved() → リスト更新
         onClose() → フォームを閉じる

4. 失敗: エラーメッセージ表示
```

**金額入力処理：**

```typescript
const handleAmountChange = (value: string) => {
  // 数字以外の文字はフィルタリング（正規表現）
  if (value === '' || /^\d+$/.test(value)) {
    setAmount(value);
  }
};
```

- `inputMode="numeric"`：モバイルで数字キーパッドを表示
- 入力中に右側に`¥12,000`形式でプレビュー表示

**収入/支出トグルの色：**

```typescript
const accentColor = type === 'income' ? 'var(--income)' : 'var(--expense)';
// 収入: #34d399（緑）
// 支出: #f87171（赤）
```

トグルボタン、¥記号、金額プレビュー、保存ボタンが全て同じ色に変わります。

---

### `src/components/MainApp.tsx`（更新）

**追加されたState：**

```typescript
// 取引入力フォームの表示状態
const [showForm, setShowForm] = useState(false);

// 保存完了時に+1増加 → HomeTabリスト再取得トリガー
const [refreshKey, setRefreshKey] = useState(0);
```

**追加されたFABボタン：**

```tsx
<button
  onClick={() => setShowForm(true)}
  className="absolute bottom-20 right-4 w-14 h-14 rounded-full ..."
  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
>
  +
</button>
```

- `absolute bottom-20 right-4`：タブバーの上・右下に配置
- `bottom-20 (80px)`：タブバー（64px）＋余白16px
- `z-40`：タブバーより上、フォームオーバーレイ（z-50）より下

**条件付きフォームレンダリング：**

```tsx
{showForm && (
  <TransactionForm
    onClose={() => setShowForm(false)}
    onSaved={() => setRefreshKey((k) => k + 1)}
  />
)}
```

---

### `src/components/features/home/HomeTab.tsx`（更新）

`refreshKey` propを受け取るよう更新しました。
Phase 10実装時にこの値を`useEffect`の依存配列に含めて自動再取得を実装します。

```typescript
interface HomeTabProps {
  yearMonth: string;
  refreshKey: number;  // 追加：保存完了時にリスト再取得トリガー
}
```

---

## ボトムシート（Bottom Sheet）パターンの説明

ボトムシートはモバイルアプリでよく使われるUIパターンです。
画面下部から上にスライドしてコンテンツを表示します。

```
メリット：
  - 自然な親指の届く範囲にUIを配置
  - 既存画面のコンテキスト（背景）を維持しながら追加作業を実行
  - モーダルと違い画面全体を隠さない

実装方式：
  fixed inset-0        → 画面全体を覆う透明レイヤー
  flex flex-col justify-end → コンテンツを画面下部に配置
  rounded-t-2xl        → 上部角のみ丸く（下部は画面端）
  max-h-[90vh]         → モーダルが画面高さの90%以上を占めないよう制限
  overflow-y-auto      → キーボードが上がってもフォーム内でスクロール可能
```

---

## モバイルキーボード表示時のレイアウト処理

入力フィールドをクリックするとモバイルの仮想キーボードが表示されます。
このとき、フォームのコンテンツがキーボードの後ろに隠れないよう処理しました。

```
処理方法：
  overflow-y-auto on ボトムシート → フォーム内でスクロール可能
  max-h-[90vh]                  → 最大高さ制限 → キーボードが上がってもスクロール可能範囲内を維持
```

ボトムシート自体に`overflow-y-auto`を設定することで
キーボードが表示されてスペースが減ってもフォーム内でスクロールできます。

---

## データ保存フロー

```
TransactionForm
  ↓  handleSave() 呼び出し
  ↓  createTransaction(data)       ← lib/api.ts
  ↓  POST /transactions            ← バックエンド Cloud Run
  ↓  addTransaction()              ← src/services/firestore.ts
  ↓  Firestore transactions コレクションに保存（サーバータイムスタンプ含む）
  ↓  onSaved() 呼び出し
  ↓  refreshKey +1                 ← MainApp State更新
  ↓  HomeTab リスト自動再取得（Phase 10で実装予定）
```

---

## バリデーションルール

| フィールド | 必須 | チェック内容 |
|------|----------|----------|
| 内容（category） | 必須 | 空の場合エラー |
| 金額（amount） | 必須 | 0以下の場合エラー、数字のみ入力可能 |
| 日付（date） | 必須 | デフォルト値（今日）があるため別途チェック不要 |
| メモ（memo） | 任意 | チェックなし、空の場合はバックエンドに送信しない |

---

## 今後の作業（Phase 10）

Phase 10で`HomeTab`を実装する際：

1. `refreshKey`を`useEffect`の依存関係に追加
2. `getTransactions(yearMonth)` API呼び出しでリスト再取得
3. 日付別グループ化＋新着順ソートで表示
4. 予算ダッシュボードの表示
