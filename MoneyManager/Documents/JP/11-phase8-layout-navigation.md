# Phase 8: 共通レイアウトとナビゲーション

## このフェーズで行ったこと

アプリ全体の骨格となるレイアウトを構成しました。
PIN認証通過後に表示されるメイン画面の構造（タブバー、年月セレクター、タブコンテンツ）を完成させました。

---

## 全体画面構成

```
┌─────────────────────────┐
│      MonthSelector       │  ← ホーム・カレンダー・統計タブでのみ表示
│   ‹  2026年 6月  ›      │    もっとみるタブでは非表示
├─────────────────────────┤
│                         │
│      タブコンテンツ領域  │  ← スクロール可能
│   (HomeTab /            │
│    CalendarTab /        │
│    StatsTab /           │
│    MoreTab)             │
│                         │
├─────────────────────────┤
│  🏠    📅    📊    ⋯   │  ← BottomNav（常に下部固定）
│  ホーム カレンダー 統計 もっとみる │
└─────────────────────────┘
```

---

## 作成されたファイル

### `src/components/layout/BottomNav.tsx`

画面最下部に常に固定されるタブナビゲーションバーです。

**核心実装ポイント：**

```typescript
// タブリストを配列で管理 — 順序変更やタブ追加が容易
const TABS = [
  { id: 'home',     label: 'ホーム',      icon: '🏠' },
  { id: 'calendar', label: 'カレンダー',  icon: '📅' },
  { id: 'stats',    label: '統計',        icon: '📊' },
  { id: 'more',     label: 'もっとみる',  icon: '⋯' },
];
```

**タブバーが常に下部に固定される仕組み：**

```
MainApp (flex flex-col, h-full)
  ├─ MonthSelector      → 固定高さ
  ├─ main (flex-1)      → 残りのスペースを全て占有（伸びる）
  └─ BottomNav          → flexShrink:0（縮まない）
```

`flex-col`レイアウトで`flex-1`を持つ中間エリアが伸び、
`flexShrink:0`を持つBottomNavは常に固定高さを維持します。
この構造でタブバーが自然に最下部に配置されます。

**アクティブタブの表示：**

```typescript
const isActive = activeTab === tab.id;

color: isActive ? 'var(--accent)' : 'var(--text-secondary)'
// アクティブ: 紫色  /  非アクティブ: グレー
```

**タッチターゲットのサイズ：**
- タブバー全体の高さ：`64px`
- 各タブボタン：`flex-1 h-full` → タブバー全高さを占有
- モバイル推奨タッチターゲット最小値（44px）を超えて確保

---

### `src/components/layout/MonthSelector.tsx`

`‹ 2026年 6月 ›` 形式の年月切り替えコンポーネントです。

**月計算ロジック（年またぎ自動処理）：**

```typescript
function addMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number); // "2026-06" → [2026, 6]
  const date = new Date(y, m - 1 + delta, 1);
  // JavaScriptのDateは月を0から始めるため -1 補正
  // delta を足すと年またぎが自動処理される:
  //   new Date(2026, 11 + 1, 1) → 2027年1月
  //   new Date(2026,  0 - 1, 1) → 2025年12月
  ...
}
```

**表示フォーマット：**

```typescript
const [year, month] = yearMonth.split('-');
// "2026年 6月" — Number(month)で先頭の0を除去（"06" → 6）
{year}年 {Number(month)}月
```

**表示対象タブの制御：**

```typescript
// MainAppで管理 — もっとみるタブではMonthSelector自体をレンダリングしない
const TABS_WITH_MONTH_SELECTOR: TabType[] = ['home', 'calendar', 'stats'];
const showMonthSelector = TABS_WITH_MONTH_SELECTOR.includes(activeTab);
{showMonthSelector && <MonthSelector ... />}
```

---

### `src/components/MainApp.tsx`

PIN認証後に表示されるメイン画面の中央状態管理コンポーネントです。

**管理するState 2つ：**

| State | 型 | 初期値 | 役割 |
|------|------|--------|------|
| `activeTab` | `TabType` | `'home'` | 現在アクティブなタブ |
| `yearMonth` | `string` | 今日の年月 | 参照する年月 |

**StateをMainAppで中央管理する理由：**

```
MainApp（State保有）
  ├─ MonthSelector ← yearMonth、setYearMonth を渡す
  ├─ HomeTab       ← yearMonth を渡す（該当月データ参照用）
  ├─ CalendarTab   ← yearMonth を渡す
  ├─ StatsTab      ← yearMonth を渡す
  └─ BottomNav     ← activeTab、setActiveTab を渡す
```

カレンダータブで月を変えると、ホームタブも同じ月を表示する必要があります。
2つのコンポーネントが同じStateを共有するため、共通の親であるMainAppでStateを管理します。
これを**State Lifting（状態の引き上げ）**と言います。

**タブコンテンツの条件付きレンダリング：**

```typescript
// アクティブなタブに対応するコンポーネントのみレンダリング
{activeTab === 'home'     && <HomeTab     yearMonth={yearMonth} />}
{activeTab === 'calendar' && <CalendarTab yearMonth={yearMonth} />}
{activeTab === 'stats'    && <StatsTab    yearMonth={yearMonth} />}
{activeTab === 'more'     && <MoreTab />}
```

---

### タブのプレースホルダーコンポーネント

各タブの実際のUIはこれ以降のフェーズで実装されます。
ここではレイアウトが正常に動作するか確認するための空画面を配置しました。

| コンポーネント | ファイル | 実装予定フェーズ |
|---------|------|---------------|
| `HomeTab` | `features/home/HomeTab.tsx` | Phase 10 |
| `CalendarTab` | `features/calendar/CalendarTab.tsx` | Phase 11 |
| `StatsTab` | `features/stats/StatsTab.tsx` | Phase 12 |
| `MoreTab` | `features/more/MoreTab.tsx` | Phase 13 |

---

## モバイルファーストレイアウト

### PCでモバイルビューに見える仕組み

```typescript
// layout.tsx
<body className="h-full flex flex-col max-w-md mx-auto relative">
```

- `max-w-md`：最大幅448pxに制限
- `mx-auto`：左右中央揃え
- PCでは電話画面のように中央に縦長のエリアが表示される

### 全体の高さを埋める仕組み

```
html (h-full)
  └─ body (h-full, flex flex-col)
       └─ MainApp (h-full, flex flex-col)
            ├─ MonthSelector（固定高さ）
            ├─ main (flex-1 = 残りのスペース全て)
            └─ BottomNav (flexShrink:0 = 固定高さ)
```

`h-full`を親から子へチェーンのように連結しないと全画面を埋めることができません。
一つでも欠けると、画面がコンテンツの高さ分しか占有しなくなります。

---

## Reactの核心概念まとめ

### Props（プロップス）

親コンポーネントから子コンポーネントへデータを渡す方法です。

```typescript
// 親（MainApp） — yearMonth StateをChildに渡す
<HomeTab yearMonth={yearMonth} />

// 子（HomeTab） — propsとして受け取って使用
export default function HomeTab({ yearMonth }: HomeTabProps) {
  // yearMonthを使って該当月のデータを参照
}
```

### State Lifting（状態の引き上げ）

複数のコンポーネントが同じデータを必要とする場合、
そのStateを**共通の親コンポーネント**に引き上げて管理するパターンです。

```
yearMonth Stateを各タブ内で別々に管理すると？
  → MonthSelectorで変えてもHomeTabが知らない（各自で異なるState）

yearMonth StateをMainAppで管理すると？
  → MonthSelectorが変えると全タブが同じ値を受け取る ✅
```

### 条件付きレンダリング

JavaScriptの`&&`演算子で条件に応じてコンポーネントをレンダリングします。

```typescript
{showMonthSelector && <MonthSelector ... />}
// showMonthSelector が true のときのみ MonthSelector をレンダリング
// false の場合は何もレンダリングしない
```
