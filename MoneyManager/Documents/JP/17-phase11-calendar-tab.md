# Phase 11 — カレンダータブ（CalendarTab）

## 概要

Phase 11で実装したカレンダータブの核心概念をまとめます。

---

## 1. カレンダーグリッド生成ロジック（`buildCalendarCells`）

### カレンダーグリッドとは？

月間カレンダーは7列（日〜土）のグリッドです。1日が何曜日かによって前側に空セルを埋め、末日以降にも空セルを追加して7の倍数になるよう調整します。

```
日  月  火  水  木  金  土
              1   2   3   4   5   6
 7   8   9  10  11  12  13
...
```

### 核心コード

```typescript
function buildCalendarCells(yearMonth: string, today: string): CalendarCell[] {
  const [y, m] = yearMonth.split('-').map(Number);

  // 1日の曜日: 0=日曜、1=月曜、...、6=土曜
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();

  // 末日: new Date(y, m, 0) は「翌月の0日」=「今月の最終日」
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells: CalendarCell[] = [];

  // 1日の前の空セルを埋める（日曜から始めるため）
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, dateStr: null, isToday: false });
  }

  // 日付セルを追加
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isToday: dateStr === today });
  }

  // 末日以降の空セルを埋める（7の倍数に揃える）
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ day: null, dateStr: null, isToday: false });
    }
  }

  return cells;
}
```

### なぜ `new Date(y, m, 0)` なのか？

`new Date(y, m, 0)` はJavaScriptの特殊なパターンです。
- `new Date(2026, 6, 0)` → 7月（インデックス6）の0日 → **6月30日**
- つまり、翌月の0日 = 今月の最終日

---

## 2. 金額の省略表記（`formatYenShort`）

カレンダーセルの幅が狭いため（画面の1/7）、金額を万/千単位で省略します。

```typescript
function formatYenShort(amount: number): string {
  if (amount >= 10000) {
    const man = amount / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  if (amount >= 1000) {
    const sen = amount / 1000;
    return `${Number.isInteger(sen) ? sen : sen.toFixed(1)}千`;
  }
  return `¥${amount}`;
}
```

| 金額 | 表示 | 説明 |
|---|---|---|
| ¥250,000 | `25万` | 25 × 10,000 |
| ¥15,000 | `1.5万` | 1.5 × 10,000 |
| ¥5,000 | `5千` | 5 × 1,000 |
| ¥1,500 | `1.5千` | 1.5 × 1,000 |
| ¥800 | `¥800` | 1,000未満はそのまま |

---

## 3. 日付別サマリーMapの生成

APIから受け取った取引リストを日付別に集計します。
`Map<日付文字列, { totalIncome, totalExpense, transactions[] }>`

```typescript
const summaryMap = new Map<string, DaySummary>();

for (const tx of transactions) {
  if (!summaryMap.has(tx.date)) {
    summaryMap.set(tx.date, { totalIncome: 0, totalExpense: 0, transactions: [] });
  }
  const s = summaryMap.get(tx.date)!;
  s.transactions.push(tx);

  if (tx.type === 'income') s.totalIncome += tx.amount;
  else                      s.totalExpense += tx.amount;
}
```

- **Map**は`{key: value}`形式のデータ構造です。
- `has()` → キーが存在するか確認、`get()` → 値の読み取り、`set()` → 値の書き込み
- カレンダーセルのレンダリング時に`summaryMap.get(cell.dateStr)` で該当日付のサマリーを取得します。

---

## 4. 日付クリック → ボトムシート（Bottom Sheet）

### 状態管理

```typescript
const [selectedDate, setSelectedDate] = useState<string | null>(null);
// null なら ボトムシートが閉じている
// "2026-06-18" なら その日付のボトムシートが開いている
```

### 日付ボタンクリック時

```typescript
onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
```

- `isSelected = (selectedDate === cell.dateStr)` — 現在選択中の日付かどうか
- 既に選択されている日付を再クリックすると`null`で閉じる（トグル）
- **ただし実際のUIではボトムシートのオーバーレイがカレンダーの上を覆うため**、同一日付の再クリックで閉じることはできません。✕ボタンまたはオーバーレイクリックで閉じます。

### ボトムシートの構造

```
┌────────────────────────────────────┐
│         ────  (ハンドルバー)         │
│  6月18日（木）              ✕      │
│────────────────────────────────────│
│  [ 給与 ]              +¥250,000   │
│────────────────────────────────────│
│  [ その他 ]  ガソリン代  -¥1,500   │
└────────────────────────────────────┘
```

### オーバーレイのレイヤー構造

```
画面
├── カレンダーグリッド（ベースレイヤー）
├── オーバーレイ（fixed inset-0 z-40、半透明の黒）← クリックで閉じる
└── ボトムシート（fixed bottom-0 z-50）          ← 常に最前面
```

- `z-40` のオーバーレイがカレンダーを覆ってクリックをブロック
- `z-50` のボトムシートがオーバーレイの上に表示

---

## 5. CSS：`grid-cols-7`でカレンダーグリッドを作る

```tsx
{/* 曜日ヘッダー */}
<div className="grid grid-cols-7 mb-1">
  {['日', '月', '火', '水', '木', '金', '土'].map(label => (
    <div key={label} className="text-center text-xs">{label}</div>
  ))}
</div>

{/* 日付グリッド */}
<div className="grid grid-cols-7 gap-y-1">
  {cells.map((cell, idx) => (
    <button key={idx} ...>
      {cell.day}
    </button>
  ))}
</div>
```

- `grid-cols-7`：7列グリッドレイアウト（各セルの幅 = 1/7）
- `gap-y-1`：行間の縦間隔4px
- `min-h-[58px]`：各セルの最小高さ58px（日付の数字 + 金額ラベルのスペース確保）

---

## 6. 今日/選択/日曜/土曜の色処理

カレンダーでは日付セルの状態に応じて背景色と文字色が異なります。

| 状態 | 背景色 | 文字色 |
|---|---|---|
| 選択済み | `var(--accent)`（紫） | 白 |
| 今日（未選択） | `rgba(99,102,241,0.18)`（半透明の紫） | `var(--accent)`（紫） |
| 通常 | なし | `var(--text-primary)` |
| 日曜日 | なし | `var(--expense)`（赤） |
| 土曜日 | なし | `#6fa8dc`（青） |

### 列インデックスで曜日を判別

```typescript
const colIndex = idx % 7; // 全体配列インデックスを7で割った余り
const isSunday   = colIndex === 0; // 0番目の列 = 日曜
const isSaturday = colIndex === 6; // 6番目の列 = 土曜
```

---

## 7. `data-date` 属性とE2Eテストセレクター

カレンダーボタンのアクセシブルネームは「18 25万 -1.5千」のように日付 + 金額が合わさります。
`getByRole('button', { name: '18', exact: true })` では見つけられません。

そのためボタンに`data-date`属性を追加します：

```tsx
<button
  data-date={cell.dateStr}  // "2026-06-18"
  ...
>
```

テストでは：

```typescript
// 特定の日付セルを正確に見つけることができる
await page.locator('[data-date="2026-06-18"]').click();
await page.locator(`[data-date="${TODAY}"]`).click();
```

このパターンは「テストのためのHTML属性」の代表的な使用例です。
`aria-label`と違い、UXに影響を与えずにセレクターを安定して作ることができます。

---

## 8. Phase 11で使用した主要技術パターンまとめ

| パターン | 説明 |
|---|---|
| `buildCalendarCells()` | 曜日計算 → 空セル + 日付セルの配列を生成 |
| `new Date(y, m, 0)` | 当月の末日を求めるJavaScriptのトリック |
| `Map<string, DaySummary>` | 日付別の取引集計 |
| `selectedDate` State | null=閉じている、日付文字列=ボトムシートが開いている |
| `fixed inset-0 z-40/50` | オーバーレイ + ボトムシートのレイヤー構造 |
| `grid-cols-7` | Tailwind 7列グリッドカレンダー |
| `data-date` 属性 | E2Eテスト用日付セルの識別子 |
| `cancelled` フラグ | useEffect クリーンアップ（Phase 10と同じパターン） |
| `refreshKey` 依存関係 | 取引保存後にカレンダーを自動更新（Phase 10と同じ） |
