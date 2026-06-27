# Phase 14.1 — 共通UX改善 学習文書

## 概要

この文書はMoneyManager Phase 14.1で実装した共通UX改善4つを、コードと共に説明します。
各改善項目がなぜ必要だったか、どんな技術を使ったか、核心コードが何かを整理します。

---

## 1. FABモーダルの幅制限

### 問題

FAB（Floating Action Button）ボタンを押して取引入力モーダルを開くと、モーダルのボトムシートがビューポート（ブラウザウィンドウ）全幅を埋めていました。
デスクトップWebではアプリが中央の`max-w-md (448px)`コンテナ内に描かれているのに、モーダルだけ1200px全幅を使用しレイアウトが不自然でした。

### 解決の原理

取引入力モーダルは以下の構造です。

```
[全画面オーバーレイ div: fixed inset-0 flex flex-col justify-end]
  └── [シート div: ボトムシート本体]
```

オーバーレイは `fixed inset-0` で画面全体を覆います。
シートがオーバーレイの直接の子要素のため、デフォルトで100%幅を持ちます。

CSS `align-self: center`（= `self-center`）をシートに適用すると、
flexコンテナ（オーバーレイ）の交差軸の整列をシート個別にオーバーライドして中央に配置されます。
ここに `w-full max-w-md` を合わせることで最大448pxに制限されます。

### 核心コード — `TransactionForm.tsx`

```tsx
// 変更前
<div className="rounded-t-2xl overflow-y-auto modal-sheet-max-height">

// 変更後
<div className="rounded-t-2xl overflow-y-auto modal-sheet-max-height w-full max-w-md self-center">
```

| クラス | 役割 |
|---|---|
| `w-full` | モバイルでは画面全幅 |
| `max-w-md` | デスクトップでは448px以内に制限 |
| `self-center` | flexオーバーレイ内で水平中央揃え |

### 動作確認方法

```javascript
// ブラウザのコンソールで確認
const sheet = document.querySelector('[class*="modal-sheet-max-height"]');
console.log({
  sheetWidth: sheet.getBoundingClientRect().width, // モバイル：ビューポート幅、デスクトップ：448
  viewportWidth: window.innerWidth,
});
```

---

## 2. 取引入力モーダルの背景スクロールブロック

### 問題

モーダル（ボトムシート）が開いている状態でも後ろのコンテンツ（ホーム/統計タブの取引リストなど）がスクロールされ、
UXの観点でモーダルと背景が分離している感覚を与えられませんでした。

### 解決の原理

メインスクロールコンテナ（`<main>`）に `overflow-hidden` を適用するとスクロールがブロックされます。
モーダルが開いているときだけブロックし、閉じると再び `overflow-y-auto` でスクロールを許可します。

### 核心コード — `MainApp.tsx`

```tsx
// showForm 状態に応じて overflow クラスを動的に切り替え
<main className={`flex-1 flex flex-col ${showForm ? 'overflow-hidden' : 'overflow-y-auto'}`}>
```

- `showForm = true` → `overflow-hidden`：スクロールを完全にブロック
- `showForm = false` → `overflow-y-auto`：通常スクロールを許可

### 注意事項

`overflow-hidden` はスクロールをブロックすると同時にスクロール位置を0にリセットしません。
モーダルを閉じた後も以前のスクロール位置がそのまま維持されます。

---

## 3. 統計タブの収入/支出切り替えタブのスクロール固定（Sticky）

### 問題

統計タブでカテゴリーリストが長くてスクロールが必要な場合、収入/支出切り替えタブバーも一緒にスクロールされ、
どのタブか確認するには一番上まで再びスクロールする必要がありました。

### 解決の原理

CSS `position: sticky` は要素がスクロールコンテナの指定位置（top-0）に達すると
そこに固定されます。`position: fixed` と違い、レイアウトフロー（flow）に影響を与えます。

```
[main: overflow-y-auto] ← スクロールコンテナ
  └── [StatsTab]
       ├── [収入/支出タブ: position: sticky; top: 0; z-index: 10] ← スクロール時に上部固定
       └── [カテゴリーリスト：長ければスクロール]
```

#### `sticky` の動作条件

1. スクロールコンテナ（`overflow-y-auto` または `overflow-y-scroll`）が祖先にあること
2. `top`、`bottom`、`left`、`right` のいずれかが指定されていること
3. `sticky` 要素の親コンテナより要素が小さいこと（親の方が大きければ固定効果なし）

#### 背景色が必須

`sticky` 要素に背景色を指定しないと、スクロールされたコンテンツがタブの後ろに透けて見えます。

### 核心コード — `StatsTab.tsx`

```tsx
// 変更前
<div className="flex border-b" style={{ borderColor: 'var(--border)' }}>

// 変更後
<div
  className="flex border-b sticky top-0 z-10"
  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
>
```

| クラス/スタイル | 役割 |
|---|---|
| `sticky top-0` | スクロールコンテナの上部に固定 |
| `z-10` | スクロールされるコンテンツより上に表示 |
| `backgroundColor` | 背景の透明を防ぐ |

---

## 4. カレンダー日付のボトムシートをドラッグで閉じる

### 問題

カレンダーで日付をクリックすると、その日付の取引履歴のボトムシートが表示されます。
このシートを閉じるにはXボタンを押すか背景をタップする必要がありましたが、
モバイルUXの観点から下にドラッグして閉じる方が自然です。

### 核心概念：タッチイベント vs マウスイベント

| イベント | 発生条件 |
|---|---|
| `onTouchStart` | 指が画面に触れたとき |
| `onTouchMove` | 指が画面上を動くとき |
| `onTouchEnd` | 指が画面から離れたとき |

`e.touches[0].clientY` で現在のタッチのY座標（ピクセル）を取得できます。

### ドラッグで閉じるロジック

```
1. onTouchStart → 開始Y座標を保存（dragStartY）
2. onTouchMove  → 現在Y - 開始Y = dragOffset（移動距離）
                  dragOffset > 0（下方向）の場合のみシートを移動
3. onTouchEnd   → dragOffset >= DISMISS_THRESHOLD(100px) → 閉じる
                  未満 → 元の位置にスナップバック
```

### 核心コード — `CalendarTab.tsx`

```tsx
const DISMISS_THRESHOLD = 100; // 100px以上ドラッグで閉じる

// dragStartY: useRef を使用（レンダリングトリガーを防ぐ）
// dragOffset, isDragging: useState（UIの変更が必要なので state）
const dragStartY = useRef<number | null>(null);
const [dragOffset, setDragOffset] = useState(0);
const [isDragging, setIsDragging] = useState(false);

// 日付が変わったときにドラッグ状態を初期化
useEffect(() => {
  setDragOffset(0);
  setIsDragging(false);
  dragStartY.current = null;
}, [selectedDate]);

const handleDragStart = (e: React.TouchEvent) => {
  dragStartY.current = e.touches[0].clientY; // 開始座標を保存
  setIsDragging(true);
};

const handleDragMove = (e: React.TouchEvent) => {
  if (dragStartY.current === null) return;
  const delta = e.touches[0].clientY - dragStartY.current;
  if (delta > 0) setDragOffset(delta); // 下方向のみ許可
};

const handleDragEnd = () => {
  if (dragOffset >= DISMISS_THRESHOLD) {
    closeSheet(); // 閾値超え → 閉じる
  } else {
    setDragOffset(0); // 未達 → スナップバック
  }
  dragStartY.current = null;
  setIsDragging(false);
};
```

### useRef vs useState の選択基準

| 基準 | useRef | useState |
|---|---|---|
| レンダリングトリガー | なし | あり |
| 使用目的 | 中間計算値の保管 | UIに反映する値 |
| 例 | `dragStartY`（TouchMoveで読み取るだけ） | `dragOffset`（シートの位置 = UI変更） |

`dragStartY` はTouchMoveハンドラーで読み取るだけで画面に直接表示されないため `useRef` が適切です。
不要な再レンダリングを防いでドラッグ中のパフォーマンスを確保します。

### オーバーレイの動的な透明度

ドラッグするほど背景が徐々に透明になり、閉じることを視覚的に予告します。

```tsx
// dragOffset が大きいほど opacity が低くなる
// Math.max(0.1, ...) で完全透明を防ぐ
opacity: Math.max(0.1, 0.45 - dragOffset / 400)
```

| dragOffset | opacity |
|---|---|
| 0 | 0.45 |
| 140 | 0.10（最小値） |
| 200 | 0.10（最小値を維持） |

### シートのアニメーション

ドラッグ中はtransitionをオフ（即座に反応）にし、ドラッグ終了後のスナップバック時にはtransitionをオンにします。

```tsx
style={{
  transform: `translateY(${dragOffset}px)`,
  transition: isDragging
    ? 'none'                                          // ドラッグ中：即座に反応
    : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)', // スナップバック/表示：自然な加速
}}
```

`cubic-bezier(0.32, 0.72, 0, 1)` はAppleのシートアニメーション曲線に類似した「速い開始 → 徐々に減速」パターンです。

---

## 5. E2Eテストの改善：addInitScript によるPINバイパス

### 既存方式の問題

一部のテストファイル（`stats-tab.spec.ts`）がPINバイパスのために `page.route()` + ボタンクリック方式を使用していました。

```typescript
// 既存：4つのPINボタンクリックが必要
const pinButtons = page.getByRole('button', { name: /^[0-9]$/ });
if (pinCount > 0) {
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '1' }).first().click();
  }
}
```

並列テスト実行時にdevサーバーの負荷によりボタンクリックのタイミングが失敗するフレーキー現象がありました。

### 改善された方式

```typescript
// 改善：page.goto() 前に sessionStorage を直接注入
await page.addInitScript(() => sessionStorage.setItem('mm_verified', 'true'));
await page.goto('/');
// PIN画面自体が表示されない
```

`addInitScript` はページのJavaScriptが実行される前に注入されます。
アプリが初期ロード時に `sessionStorage.getItem('mm_verified')` を確認するため、
`true` が既にあれば PIN画面をスキップします。

この方式はより速く安定しており、PIN APIのモッキングも不要です。

---

## まとめ

| 改善項目 | 核心技術 | ファイル |
|---|---|---|
| FABモーダルの幅制限 | CSS `align-self: center` + `max-w-md` | `TransactionForm.tsx` |
| 背景スクロールブロック | 条件付き `overflow-hidden` | `MainApp.tsx` |
| 統計タブトグル固定 | CSS `position: sticky` | `StatsTab.tsx` |
| カレンダードラッグで閉じる | タッチイベント + `useRef` + `translateY` | `CalendarTab.tsx` |
| E2E PINバイパスの改善 | `addInitScript` | `stats-tab.spec.ts` |
