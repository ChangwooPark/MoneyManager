# Phase 12 — 統計タブ（StatsTab）

## 概要

Phase 12で実装した統計タブの核心概念をまとめます。

---

## 1. カテゴリー別集計（`aggregateByCategory`）

### 何をする関数か？

APIから受け取った取引リストを受け取り、収入または支出のみを絞り込んで、カテゴリー単位で**件数**と**合計金額**を計算します。その結果を金額を基準にソートした配列として返します。

### 処理フロー

```
transactions（全リスト）
    ↓ filter（incomeまたはexpenseのみ抽出）
filtered
    ↓ for..of 巡回 → Mapにカテゴリー別に累積
Map<category, { count, total }>
    ↓ Map.values() → Array
rows[]
    ↓ sort（金額昇順または降順）
ソート済み CategoryRow[]
```

### 核心コード

```typescript
// 集計結果を格納する型：カテゴリー名、件数、合計金額
interface CategoryRow {
  category: string;
  count: number;
  total: number;
}

function aggregateByCategory(
  transactions: Transaction[],
  type: 'income' | 'expense',
  sortDir: 'desc' | 'asc',
): CategoryRow[] {
  // 1. 型フィルター
  const filtered = transactions.filter(tx => tx.type === type);

  // 2. Mapでカテゴリー別に集計
  const map = new Map<string, CategoryRow>();
  for (const tx of filtered) {
    if (!map.has(tx.category)) {
      map.set(tx.category, { category: tx.category, count: 0, total: 0 });
    }
    const row = map.get(tx.category)!;
    row.count += 1;
    row.total += tx.amount;
  }

  // 3. 配列変換 + ソート
  const rows = Array.from(map.values());
  rows.sort((a, b) =>
    sortDir === 'desc' ? b.total - a.total : a.total - b.total
  );

  return rows;
}
```

---

## 2. Mapでカテゴリーを集計する

### Mapとは？

`Map`はJavaScriptのデータ構造です。通常のオブジェクト（`{}`）と似ていますが、キーにどんな型でも使えて、挿入順序を記憶します。

| メソッド | 役割 | 例 |
|---|---|---|
| `map.has(key)` | キーが存在するか確認 | `map.has('食費')` → true/false |
| `map.get(key)` | キーに対応する値を読み取る | `map.get('食費')` → CategoryRow |
| `map.set(key, val)` | キー-値のペアを保存 | `map.set('食費', { count: 0, total: 0 })` |
| `map.values()` | 全ての値のイテレーター | `Array.from(map.values())` → 配列 |

### なぜ `if (!map.has(tx.category))` パターンを使うか？

初めて登場するカテゴリーなら初期値（0, 0）で設定し、既に存在すればスキップします。次に`map.get()`で取り出して値を累積します。

```typescript
// 初めて登場したカテゴリー → 初期値を生成
if (!map.has(tx.category)) {
  map.set(tx.category, { category: tx.category, count: 0, total: 0 });
}

// 既に存在していても、get()で取り出して累積
const row = map.get(tx.category)!;
row.count += 1;
row.total += tx.amount;
```

`!`（Non-null assertion）：`map.get()`は`CategoryRow | undefined`を返します。直前に`set()`で必ず存在するよう保証したので`!`でundefinedを除去します。

---

## 3. 状態設計 — タブ切り替えとソート方向

```typescript
// 現在のタブ：'income'（収入）または 'expense'（支出）
const [activeTab, setActiveTab] = useState<TabType>('expense');

// ソート方向：'desc'（降順、デフォルト）または 'asc'（昇順）
const [sortDir, setSortDir] = useState<SortDir>('desc');
```

### タブ切り替えの実装

```tsx
{(['expense', 'income'] as TabType[]).map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    style={{
      // 選択されたタブのみ色を強調
      color: activeTab === tab
        ? (tab === 'income' ? 'var(--income)' : 'var(--expense)')
        : 'var(--text-secondary)',
      // 下線：選択されたタブのみ表示
      borderBottom: activeTab === tab
        ? `2px solid ${tab === 'income' ? 'var(--income)' : 'var(--expense)'}`
        : '2px solid transparent',
    }}
  >
    {tab === 'income' ? '収入' : '支出'}
  </button>
))}
```

**`'2px solid transparent'` を使う理由**：`borderBottom: 'none'` を使うとタブ切り替え時にレイアウトが揺れます。透明なボーダーを事前に確保しておくことで、選択/非選択時のレイアウトを同じに保ちます。

### ソートトグルの実装

```tsx
// 現在の方向の反対に切り替え
setSortDir(d => d === 'desc' ? 'asc' : 'desc')
```

`prev => next` 関数型更新パターン：現在のState（`d`）を受け取って新しいStateを返します。外部の変数を参照しないため、常に最新のStateを基準に安全にトグルできます。

---

## 4. 割合ゲージバー

### ゲージバーとは？

各カテゴリーが全体の支出/収入の何%を占めるかを視覚的に示す横棒です。

```tsx
{/* コンテナ：全幅、グレー背景 */}
<div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
  {/* 塗りつぶし部分：割合分の幅を設定 */}
  <div
    className="h-full rounded-full"
    style={{
      width: grandTotal > 0
        ? `${(row.total / grandTotal) * 100}%`
        : '0%',
      backgroundColor: activeTab === 'income' ? 'var(--income)' : 'var(--expense)',
    }}
  />
</div>
```

- `row.total / grandTotal * 100`：該当カテゴリーの割合（%）
- `grandTotal > 0` の条件：分母が0の場合に`NaN%`になるのを防ぐための防御処理

### 割合テキスト（Math.round）

```typescript
`${Math.round((row.total / grandTotal) * 100)}%`
// 例：30000 / 49000 * 100 = 61.22... → 61%
```

`Math.round()`：小数点を四捨五入。`61.22%`の代わりに`61%`のようにすっきりと表示します。

---

## 5. grandTotalの計算

```typescript
// reduce: 配列の全ての項目を一つの値に合算
const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
const grandCount = rows.reduce((sum, r) => sum + r.count, 0);
```

`reduce(callback, initialValue)`：
- `sum`：累積値（最初は0）
- `r`：現在の項目
- 毎回の呼び出しで `sum + r.total` を次の `sum` として渡す
- 例）`[30000, 15000, 4000]` → `0 + 30000 + 15000 + 4000 = 49000`

---

## 6. 条件付きレンダリング構造

StatsTabs のレンダリングは3段階に分岐します：

```tsx
{/* 1. ローディング中 */}
{loading && <p>読み込み中...</p>}

{/* 2. エラー発生 */}
{!loading && error && <p>{error}</p>}

{/* 3. データ正常 */}
{!loading && !error && (
  <>
    {rows.length === 0 ? (
      // 3-1. 該当タブに取引なし
      <p>今月の支出履歴はありません。</p>
    ) : (
      // 3-2. カテゴリーリストを表示
      <カテゴリーリスト />
    )}
  </>
)}
```

このパターンは**HomeTab**、**CalendarTab**などでも同様に使用されます。

---

## 7. Phase 12で使用した主要技術パターンまとめ

| パターン | 説明 |
|---|---|
| `Map<string, CategoryRow>` | カテゴリー別集計（has/get/set） |
| `Array.from(map.values())` | Map → 配列変換 |
| `rows.sort((a, b) => b.total - a.total)` | 降順ソート |
| `setSortDir(d => d === 'desc' ? 'asc' : 'desc')` | 関数型更新でトグル |
| `borderBottom: '2px solid transparent'` | レイアウトの揺れのないタブ下線 |
| `Math.round(割合 * 100)` | 整数%表記 |
| `grandTotal > 0 ? % : '0%'` | 分母0の防御処理 |
| `rows.reduce((sum, r) => sum + r.total, 0)` | 配列の合算 |
