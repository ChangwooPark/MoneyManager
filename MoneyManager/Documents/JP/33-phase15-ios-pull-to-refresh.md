# Phase 15 — iOS Safari Pull-to-Refresh 競合解決 学習ドキュメント

## 概要

iPhone Safariで取引入力モーダルを下にドラッグした際、iOSネイティブの「引っ張って更新」機能が先に発動する問題を解決した過程を説明します。

---

## 1. 問題の状況

### 発生条件

- iPhone Safariでアプリにアクセス
- FAB(+)ボタンで取引入力ボトムシートを開く
- シートを下にドラッグして閉じようとしたとき

### 症状

モーダルを閉じようとするドラッグ中に、モーダルではなく**背景ページ全体が下に引っ張られてブラウザが更新**される。
意図したモーダルの閉じ操作の代わりにページがリロードされてしまう。

---

## 2. 原因分析

### iOS Pull-to-Refreshとは

Safariはページ最上部から指を下にスワイプするとページを更新するネイティブ機能を提供します。

```
ユーザーが下にスワイプ
  → iOSが "Pull-to-Refresh" を検知
  → ページ全体が下に引っ張られる（更新アイコンが表示）
  → 指を離すとページリロード
```

### なぜ preventDefault() だけでは解決できないか

通常のWebスクロールは `touchmove` イベントで `preventDefault()` を呼ぶと止められます。
しかしiOS Pull-to-Refreshは**ブラウザのネイティブレイヤーで別途処理**されるため、
JavaScriptのイベントハンドラが介入する前にすでに動作が始まっています。

```
通常スクロール:     JS touchmove → preventDefault() → 停止可能 ✅
Pull-to-Refresh:  iOSネイティブレイヤー → JSイベントより先に処理 → 停止困難 ❌
```

---

## 3. 解決方法

### overscrollBehavior CSSプロパティ

`overscrollBehavior: 'none'` を `document.body` に適用すると、iOSのPull-to-Refreshを含むすべてのオーバースクロール動作をブロックできます。

```
overscrollBehavior: 'none'
  → スクロールがコンテナの境界に達しても親に伝播しない
  → Pull-to-Refresh、バウンス効果をすべてブロック
```

### 実装方法 — マウント/アンマウント時に適用・復元

モーダルが**開く時**にブロックを適用し、**閉じる時**に元の状態に戻します。

```typescript
useEffect(() => {
  // モーダルマウント時 — Pull-to-Refreshをブロック
  document.body.style.overscrollBehavior = 'none';

  return () => {
    // モーダルアンマウント時 — 元の状態を復元
    document.body.style.overscrollBehavior = '';
  };
}, []);
```

`useEffect` の返り値（cleanup関数）はコンポーネントがアンマウントされると自動実行されます。
モーダルが閉じると `overscrollBehavior` が自動的に元の値に戻ります。

### 適用対象

| コンポーネント | 理由 |
|--------------|------|
| `TransactionForm.tsx` | FABボタンで開く取引入力ボトムシート |
| `HomeTab.tsx` | 取引行タップで開く詳細/編集シート |
| `CalendarTab.tsx` | 日付タップで開く日付詳細シート |

---

## 4. CalendarTab への追加修正

CalendarTabではPull-to-Refreshブロック以外に、**背景スクロール防御**も欠けていました。

### 追加した内容

```typescript
// sheetRef — シートのDOM要素を参照
const sheetRef = useRef<HTMLDivElement>(null);

// touchmoveイベント — シート内のタッチが背景ページに伝播しないようブロック
useEffect(() => {
  const sheet = sheetRef.current;
  if (!sheet) return;

  const preventScroll = (e: TouchEvent) => e.preventDefault();
  sheet.addEventListener('touchmove', preventScroll, { passive: false });

  return () => {
    sheet.removeEventListener('touchmove', preventScroll);
  };
}, [selectedDate]);
```

`passive: false` オプションがあって初めて `preventDefault()` が実際にスクロールをブロックします。
（デフォルトの `passive: true` では `preventDefault()` の呼び出しが無視されます。）

---

## 5. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| Pull-to-Refresh | Safariで最上部スワイプ時にページを更新するiOSネイティブ機能 |
| `overscrollBehavior` | スクロール境界到達時の動作を制御するCSSプロパティ。`none`でオーバースクロール無効化 |
| `useEffect` cleanup | `useEffect`が返す関数。コンポーネントアンマウント時に自動実行されて副作用を整理 |
| `passive: false` | `addEventListener`オプション。これがあって初めて`preventDefault()`でスクロールブロック可能 |
| `e.stopPropagation()` | イベントが親要素へ伝播するのを止めるメソッド（バブリングブロック） |
