# Phase 13.5 学習文書 — UX改善（FAB非表示・カレンダー全画面・区切り線・スクロールテスト）

## 1. 概要

Phase 13.5はユーザーのリクエストに応じて即時適用した4つのUX改善です。
バックエンドの変更なし、フロントエンドのコードのみ修正しました。

| 項目 | ファイル |
|------|------|
| もっとみるタブのFAB非表示 | `MainApp.tsx` |
| カレンダー全画面表示 | `MainApp.tsx`、`CalendarTab.tsx` |
| カレンダー日付区切り線 | `CalendarTab.tsx` |
| スクロールE2Eテスト | `tests/scroll.spec.ts` |

---

## 2. もっとみるタブのFAB非表示

### 問題
もっとみるタブ（設定画面）でも取引追加FAB（+）ボタンが表示されていました。
もっとみるタブはPIN・予算・カテゴリーの設定画面なので、取引追加ボタンは不要です。

### 解決 — 条件付きレンダリング

```tsx
// MainApp.tsx — 変更前
<button onClick={() => setShowForm(true)} aria-label="取引を追加">
  +
</button>

// MainApp.tsx — 変更後
{activeTab !== 'more' && (
  <button onClick={() => setShowForm(true)} aria-label="取引を追加">
    +
  </button>
)}
```

**核心パターン**：`{条件 && <コンポーネント />}` — 条件が `false` なら何もレンダリングしない

---

## 3. カレンダー全画面表示

### 問題
カレンダーが画面の半分程度しか占めず、下側に黒い空きスペースが生まれていました。
6月のように5〜6週の月はセルの高さが小さく、カレンダーがより上側に偏っていました。

### CSSの原因分析

```
既存の構造：
main (flex-1, overflow-y-auto)         ← 高さ555px
  └── CalendarTab (h-full)             ← 理論上555pxのはずだが...

問題: overflow-y: auto のコンテナ内で h-full（= height: 100%）が
      親の flex-1 の高さではなくコンテンツの高さを基準に計算される場合がある
      → CalendarTab が実際には216px（コンテンツの高さ）しか占めていない
```

これはCSSの既知の動作です。
`overflow: auto` コンテナ内部で `height: 100%` はブラウザによって
「スクロール領域全体の高さ」ではなく「現在のビューポートの高さ」として解釈されることがあります。

### 解決 — flexコンテキストの伝達

```tsx
// MainApp.tsx — main に flex flex-col を追加
<main className="flex-1 overflow-y-auto flex flex-col">
  {activeTab === 'calendar' && <CalendarTab ... />}
  {activeTab === 'home'     && <HomeTab ... />}
  ...
</main>
```

```tsx
// CalendarTab.tsx — h-full の代わりに flex-1 を使用
// 変更前
<div className="relative h-full flex flex-col">

// 変更後
<div className="relative flex-1 flex flex-col min-h-0">
```

**なぜこの方法が機能するのか？**

| CSSプロパティ | 動作 |
|----------|------|
| `h-full` (= `height: 100%`) | 親の高さを基準にパーセントを計算 — overflowコンテナ内では不安定 |
| `flex-1` (= `flex-grow: 1`) | flexコンテキスト内で残りのスペースを全て占有 — 安定 |

`main`に `flex flex-col` を追加すると子要素がflexアイテムになります。
- CalendarTab：`flex-1` → 残りの高さを全て占有 ✓
- HomeTab、StatsTab：自然な高さ → 長くなると `main` の `overflow-y-auto` がスクロールを提供 ✓

**`min-h-0` が必要な理由**：
flexアイテムのデフォルト値は `min-height: auto` です。
この場合、コンテンツより小さくなろうとしないため
`min-h-0`（= `min-height: 0`）でオーバーライドしないと正しくサイズが縮小されません。

---

## 4. カレンダー日付の区切り線

### 目標
各日付セルの間に薄いラインを追加して、日付を視覚的に区別します。

### 構造変更：grid → flex（週単位の行）

```
変更前: grid grid-cols-7（単一グリッド）
変更後: 各週（week）をflex行に分離 + 行間の区切り線
```

```tsx
// セル配列を週（week）単位に分割
const weeks: CalendarCell[][] = [];
for (let i = 0; i < cells.length; i += 7) {
  weeks.push(cells.slice(i, i + 7));
}

// 区切り線の定数
const DIVIDER = '1px solid var(--border)';
```

### 水平区切り線（週の間）

```tsx
{weeks.map((week, wi) => (
  <Fragment key={wi}>
    {/* 最初の行以外、週の間に水平区切り線を挿入 */}
    {wi > 0 && (
      <div style={{ height: '1px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
    )}
    <div className="flex flex-1 min-h-0">
      {/* 日付セルたち... */}
    </div>
  </Fragment>
))}
```

### 垂直区切り線（曜日の間）

```tsx
{week.map((cell, ci) => {
  const isLastCol = ci === 6;
  return (
    <div
      key={...}
      className="flex-1 min-w-0 overflow-hidden"
      style={{
        // 最後の列（土曜日）には右の区切り線なし
        borderRight: isLastCol ? 'none' : DIVIDER,
      }}
    >
      <button className="w-full h-full ...">
        {/* 日付の数字、金額ラベル */}
      </button>
    </div>
  );
})}
```

### 曜日ヘッダーもflexに統一

```tsx
// 変更前：grid grid-cols-7（日付セルと幅が一致しない可能性）
<div className="grid grid-cols-7 mb-1">

// 変更後：flex（日付セルと同じ幅配分）
<div className="flex" style={{ borderBottom: DIVIDER }}>
  {DAY_LABELS.map((label, i) => (
    <div
      key={label}
      className="flex-1 text-center text-xs py-1.5 font-semibold"
      style={{ borderRight: i < 6 ? DIVIDER : 'none', ... }}
    >
      {label}
    </div>
  ))}
</div>
```

**`Fragment`に key を付ける方法**：

```tsx
// <> </> 省略形には key を付けられない
<>...</>  // key 不可

// Fragment を明示的に import して使用
import { Fragment } from 'react';
<Fragment key={wi}>...</Fragment>  // key 可能 ✓
```

---

## 5. スクロールE2Eテスト

### 目的
ホームタブ・統計タブでコンテンツが画面を超える場合、
スクロールが正常に動作するか自動で検証します。

### スクロール可能かどうかを判断する方法

```typescript
// scrollHeight: コンテンツ全体の高さ（隠れている部分も含む）
// clientHeight: 実際に画面に見えている高さ
// scrollHeight > clientHeight → スクロールが必要 = スクロール可能

const { scrollHeight, clientHeight } = await page.locator('main').evaluate(el => ({
  scrollHeight: el.scrollHeight,
  clientHeight: el.clientHeight,
}));

expect(scrollHeight).toBeGreaterThan(clientHeight);
```

### スクロール動作の確認方法

```typescript
// 一番下までスクロール
await page.locator('main').evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));

// scrollTop: 現在のスクロール位置（0なら一番上）
// スクロールが起きたなら scrollTop > 0
const scrollTop = await page.locator('main').evaluate(el => el.scrollTop);
expect(scrollTop).toBeGreaterThan(0);
```

### 一番下への到達確認

```typescript
// scrollTop + clientHeight ≈ scrollHeight → 一番下までスクロールされた
const isAtBottom = await page.locator('main').evaluate(el =>
  Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) < 5
);
expect(isAtBottom).toBe(true);
```

`Math.abs(...) < 5`：小数点の丸めなどによる1〜2pxの誤差を許容します。

### タブバー・年月セレクターの固定位置検証

```typescript
// スクロール前後でnav（タブバー）のy座標が同じであること（= 画面に固定）
const navBefore = await page.locator('nav').boundingBox();
await page.locator('main').evaluate(el => el.scrollTo({ top: el.scrollHeight }));
const navAfter = await page.locator('nav').boundingBox();

expect(navBefore?.y).toBe(navAfter?.y);  // 位置が変わっていないこと
```

`boundingBox()`：要素の `{ x, y, width, height }` ビューポート基準の座標を返します。

### テスト用モックデータの設計

```typescript
// ホームタブ：25件の取引、25日にわたって分散 → 日付ヘッダー含めてスクロール発生
const HOME_TRANSACTIONS = Array.from({ length: 25 }, (_, i) => ({
  id: `tx-home-${i}`,
  date: `2026-06-${String((i % 25) + 1).padStart(2, '0')}`,
  ...
}));

// 統計タブ：20個の異なるカテゴリー → 各行が一つのカテゴリー → スクロール発生
const EXPENSE_CATEGORIES = [
  '食費', '交通', 'ショッピング', '医療', '通信', '趣味', '公共料金', '生活', '美容', '運動',
  '教育', 'カフェ', '外食', '日用品', 'レンタル', '定額制', '旅行', 'ビューティー', 'ペット', 'その他',
];
const STATS_TRANSACTIONS = EXPENSE_CATEGORIES.map((cat, i) => ({
  category: cat,
  amount: 10000 * (i + 1),  // 金額が全て異なる → 統計タブが各行で異なる表示
  ...
}));
```

**注意**：統計タブは金額の降順でソートします。
`'その他'`（amount=200,000）が最上段、`'食費'`（amount=10,000）が最下段です。
`toBeInViewport`で特定の項目を確認する際はソート順序を考慮する必要があります。

---

## 6. まとめ：Phase 13.5で学んだこと

| 概念 | 核心ポイント |
|------|-------------|
| 条件付きレンダリング | `{条件 && <コンポーネント />}` — falseならレンダリングなし |
| height: 100% の限界 | overflow: auto の中では不安定 → `flex-1` で代替 |
| min-h-0の必要性 | flexアイテムのデフォルト `min-height: auto` → `min-h-0` でオーバーライド |
| Fragment key | `<Fragment key={...}>` — 省略形の `<>` には key 不可 |
| DIVIDER定数 | 繰り返されるborderスタイルを定数として抽出 → 一貫性を維持 |
| scrollHeight vs clientHeight | scrollHeight > clientHeight → スクロールが必要 |
| スクロール一番下確認 | `Math.abs(scrollTop + clientHeight - scrollHeight) < 5` |
| boundingBox() | 要素のビューポート基準の座標 → 固定UIの検証に活用 |
