# Phase 16 — 統計タブ カテゴリー詳細ボトムシート 学習文書

## 概要

Phase 16で実装した機能をコードと共に説明します。

- **カテゴリー行クリック → ボトムシート** — そのカテゴリーの個別取引リストを下からスライドアップするパネルで表示
- **収入/支出タブ切り替え時にシートを自動で閉じる** — タブのコンテキストが変わると以前の選択を解除
- **z-index階層の調整** — オーバーレイの上でもタブトグルボタンをクリックできるよう修正

---

## 1. 状態構造

```tsx
// StatsTab.tsx
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [dragOffset,       setDragOffset]        = useState(0);
const [isDragging,       setIsDragging]        = useState(false);
const dragStartY = useRef(0);
const sheetRef   = useRef<HTMLDivElement>(null);
```

`selectedCategory` が `null` ならシートが閉じており、文字列値があれば該当カテゴリーのシートが開きます。
CalendarTabの `selectedDate` と同じパターンです。

---

## 2. タブ切り替え時にシートを自動で閉じる

```tsx
useEffect(() => {
  setSelectedCategory(null); // タブが変わると開いていたシートを閉じる
}, [activeTab]);
```

収入タブで「給与」カテゴリーのシートを開いて支出タブに切り替えると自動で閉じます。
これがないと支出タブで収入カテゴリーのリストがそのまま表示されるバグが生じます。

---

## 3. カテゴリー別取引リストの計算

```tsx
const selectedTransactions = useMemo(() => {
  if (!selectedCategory) return [];

  const rows = activeTab === 'expense' ? expenseRows : incomeRows;
  const row  = rows.find(r => r.category === selectedCategory);
  if (!row) return [];

  // 日付降順 → 同じ日付なら createdAt 降順
  return [...row.transactions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const aTs = (a.createdAt as { _seconds: number } | undefined)?._seconds ?? 0;
    const bTs = (b.createdAt as { _seconds: number } | undefined)?._seconds ?? 0;
    return bTs - aTs;
  });
}, [selectedCategory, activeTab, expenseRows, incomeRows]);
```

`useMemo` で包んで `selectedCategory` や `activeTab` が変わった場合のみ再計算します。
`[...row.transactions]` で元の配列をコピーしてからソートします（元の配列の不変性を維持）。

---

## 4. z-index階層 — タブトグルがオーバーレイの上に必要な理由

最初の実装では収入/支出トグルタブの z-index が `z-10` でした。
ボトムシートオーバーレイを `z-40` で開くとタブボタンがオーバーレイに隠れてクリックできなくなりました。

```
z-[60]  ← 収入/支出トグルタブ（常にクリックできる必要がある）
z-50    ← ボトムシート本体
z-40    ← 半透明オーバーレイ
z-10    ← 通常コンテンツ
```

```tsx
{/* sticky top-0 z-[60]: オーバーレイ(z-40)・シート(z-50)の上に位置しないとタブ切り替えができない */}
<div className="flex border-b sticky top-0 z-[60]" ...>
```

`z-50` と `z-60` の間の整数を使うにはTailwindの基本クラス（`z-50`、`z-60`）がないため、
`z-[60]` のように角括弧で任意の値を指定します（JITモード）。

---

## 5. 日付フォーマットヘルパー

```tsx
// "2026-06-18" → "6月 18日 (水)"
function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00'); // タイムゾーンのずれ防止用 T00:00:00
  const month   = date.getMonth() + 1;
  const day     = date.getDate();
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${month}月 ${day}日 (${weekday})`;
}
```

`new Date('2026-06-18')` はUTC深夜0時としてパースされ、JST（UTC+9）では1日前にずれる問題があります。
`T00:00:00` を付けるとローカルタイムゾーンの深夜0時としてパースされて日付が正確になります。

---

## 6. ボトムシート構造 — オーバーレイ + シート

```tsx
{selectedCategory && (
  <>
    {/* 半透明の背景 — クリックで閉じる */}
    <div
      className="fixed inset-0 z-40"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={closeSheet}
    />

    {/* シート本体 */}
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col"
      style={{
        backgroundColor: 'var(--bg-card)',
        maxHeight: '65vh',
        transform: `translateY(${dragOffset}px)`,
      }}
    >
      {/* ハンドルバー */}
      <div className="flex justify-center pt-3 pb-1 cursor-grab"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
      </div>

      {/* ヘッダー */}
      {/* 取引リスト */}
    </div>
  </>
)}
```

`fixed inset-0` でオーバーレイが全画面を覆い、シートは `fixed bottom-0` で下部に固定されます。
`maxHeight: '65vh'` で画面の65%を超えないように制限します。

---

## 7. ドラッグで閉じる（Pointer Events）

```tsx
const DISMISS_THRESHOLD = 100; // 100px以上下にドラッグで閉じる

const handleDragStart = (e: React.PointerEvent) => {
  dragStartY.current = e.clientY;
  setIsDragging(true);
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
};

const handleDragMove = (e: React.PointerEvent) => {
  if (!isDragging) return;
  const delta = e.clientY - dragStartY.current;
  if (delta > 0) setDragOffset(delta); // 下方向のみ許可
};

const handleDragEnd = () => {
  setIsDragging(false);
  if (dragOffset >= DISMISS_THRESHOLD) {
    closeSheet(); // 閾値超え → 閉じる
  } else {
    setDragOffset(0); // 未達 → 元の位置にスナップバック
  }
};
```

`setPointerCapture` はポインターが要素の外に出てもイベントを受け続けるようにします。
マウスを素早く動かしてもドラッグが途切れません。
上方向（delta < 0）は無視してシートをさらに上に持ち上げる動作を防ぎます。

---

## 8. iOS Pull-to-Refresh防止

```tsx
useEffect(() => {
  if (!selectedCategory) return;

  // iOS SafariのPull-to-Refreshを無効化
  document.body.style.overscrollBehavior = 'none';

  // シート外のtouchmoveは防ぎ、シート内は許可
  const prevent = (e: TouchEvent) => {
    if (sheetRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', prevent, { passive: false });

  return () => {
    document.body.style.overscrollBehavior = '';
    document.removeEventListener('touchmove', prevent);
  };
}, [selectedCategory]);
```

`overscrollBehavior = 'none'` だけではiOS Safariで完全に防げないため、
`touchmove preventDefault` を合わせて使用します。
クリーンアップ関数で2つの設定を両方復元しないと、他のシートで通常のスクロールができなくなります。

---

## 9. メモの表示条件

```tsx
{/* メモがカテゴリー名と異なる場合のみ表示 */}
{tx.memo && tx.memo !== tx.category && (
  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
    {tx.memo}
  </span>
)}
```

「食費」というカテゴリーにメモも「食費」と入力した場合の重複表示を避けるため、
メモの値がカテゴリー名と異なる場合のみレンダリングします。

---

## まとめ

| 実装ポイント | 核心 |
|---|---|
| 状態管理 | `selectedCategory: string \| null` — CalendarTabの `selectedDate` と同じパターン |
| タブ切り替え自動閉じ | `useEffect(() => setSelectedCategory(null), [activeTab])` |
| z-index階層 | タブトグル `z-[60]` > シート `z-50` > オーバーレイ `z-40` |
| 日付パース | `new Date(str + 'T00:00:00')` — タイムゾーンのずれ防止 |
| ドラッグで閉じる | `setPointerCapture` + DISMISS_THRESHOLD 100px |
| iOSスクロール防止 | `overscrollBehavior + touchmove preventDefault` セットで使用 |
