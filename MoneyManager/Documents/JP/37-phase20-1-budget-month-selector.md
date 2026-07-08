# Phase 20-1 — 予算年月セレクター 学習ドキュメント

## 概要

「その他」タブの予算設定セクションに**年月セレクター（‹ ›）**を追加し、今月だけでなく他の月の予算も照会・保存できるようにします。

**変更前:**
```
その他 → 予算設定（今月固定）
  → 金額入力 → 保存
```

**変更後:**
```
その他 → 予算設定（2026年7月）
  → ‹ 前の月  2026年7月  次の月 ›  ← 年月セレクター追加
  → 金額入力 → 保存（選択した月基準）
```

---

## 1. ファイル構成

```
フロントエンドのみ修正（バックエンド変更なし）
  frontend/src/components/features/more/MoreTab.tsx
    ├── prevMonth() / nextMonth() ヘルパー関数追加
    ├── yearMonth（定数）→ budgetYearMonth（状態）に変更
    ├── useEffect 依存配列の修正
    ├── 年月セレクター UI追加
    └── 保存時に選択した年月を渡す

  frontend/tests/more-tab.spec.ts
    └── Phase 20-1 テスト7件追加
```

---

## 2. 核心概念 1 — 純粋関数（Pure Function）

### 純粋関数とは？

- **同じ入力 → 常に同じ出力**
- **外部の状態を読んだり変えたりしない**

前月・翌月の計算を純粋関数で書くと、どこで呼んでも期待通りの結果が保証されます。

```typescript
// Dateオブジェクトを使わず文字列演算のみで処理
// → タイムゾーンの影響を受けない
function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;           // 1月 → 前年12月
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;          // 12月 → 翌年1月
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
```

**Dateオブジェクトを使わない理由:**
```typescript
// 危険な方法 — new Date("2026-01-01") はUTC基準のため
// システムのタイムゾーンによっては12月31日になることがある
const d = new Date("2026-01-01");
d.setMonth(d.getMonth() - 1); // 期待: 2025-12, 実際: 環境次第
```

---

## 3. 核心概念 2 — useStateで状態管理

### 既存コードの問題

```typescript
// 定数: コンポーネントのレンダリング時に一度だけ計算され、以降は変わらない
const yearMonth = getCurrentYearMonth(); // "2026-07" 固定
```

### 変更後

```typescript
// 状態: ‹ › ボタンをクリックするたびに値が変わり
//       Reactが自動的に画面を再描画する
const [budgetYearMonth, setBudgetYearMonth] = useState(getCurrentYearMonth);
//                                                      ↑ 関数参照を渡す
// () => getCurrentYearMonth() と同じだが、より効率的
// — 初期レンダリング時のみ一度呼ばれ、以降は再呼び出しなし
```

**`useState(fn)` vs `useState(fn())`:**

| 形式 | 動作 |
|------|------|
| `useState(fn)` | 初期レンダリング時のみfnを呼ぶ（遅延初期化） |
| `useState(fn())` | 毎レンダリングごとにfnを呼ぶ（無駄なDate生成） |

---

## 4. 核心概念 3 — useEffectの依存配列

### 依存配列とは？

`useEffect`の第2引数。**この配列の値が変わるたびにEffectが再実行**されます。

```typescript
// 変更前: yearMonthは定数なのでマウント時に1回だけ実行
useEffect(() => {
  getBudget(yearMonth)
    .then(b => setCurrentBudget(b.amount))
    .catch(() => setCurrentBudget(null));
}, [yearMonth]);

// 変更後: budgetYearMonthが変わるたびに（‹ › クリック時）自動再実行
useEffect(() => {
  setCurrentBudget(null); // 前月の金額が一瞬表示される現象を防ぐ
  getBudget(budgetYearMonth)
    .then(b => setCurrentBudget(b.amount))
    .catch(() => setCurrentBudget(null));
}, [budgetYearMonth]);
//   ↑ この値が変わるとEffectが再実行される
```

**先に`setCurrentBudget(null)`を呼ぶ理由:**
- 6月(¥7,000) → 7月に移動する際、API応答前に「現在: ¥7,000」が一瞬表示される
- 先に`null`でリセットすることで、前月の金額が表示されなくなる

---

## 5. 核心概念 4 — イベントバブリングと配置位置

### イベントバブリングとは？

ボタンクリック → イベントが親要素へ伝播（bubble up）します。

```
[アコーディオンヘッダー button]  ← クリックで開閉
  └── [‹ button]               ← クリックで前月移動
```

もし`‹`ボタンがアコーディオンヘッダーの`<button>`の中にあると:
- `‹` クリック → 前月移動 **+ アコーディオンも閉じる**（バブリングのため）

**解決策A:** `e.stopPropagation()`でバブリングを遮断  
**解決策B（採用）:** 年月セレクターをアコーディオンの**本体(body)内**に配置

```tsx
{/* ヘッダー: クリックで開閉のみ */}
<button onClick={() => toggleSection('budget')}>
  予算設定（2026年7月）
</button>

{/* 本体: ヘッダーの外にあるのでバブリング問題なし */}
{openSection === 'budget' && (
  <div>
    <div className="flex items-center justify-between">
      <button onClick={() => setBudgetYearMonth(prev => prevMonth(prev))}>‹</button>
      <span>2026年7月</span>
      <button onClick={() => setBudgetYearMonth(prev => nextMonth(prev))}>›</button>
    </div>
    {/* 入力欄、保存ボタン */}
  </div>
)}
```

---

## 6. セクションを閉じた時のリセット

```typescript
useEffect(() => {
  if (openSection !== 'budget') {
    setBudgetInput('');
    setBudgetError('');
    setBudgetSuccess('');
    // 閉じた時に今月にリセット → 再度開くと今月から始まる
    setBudgetYearMonth(getCurrentYearMonth());
  }
}, [openSection]);
```

---

## 7. UIレイアウト最適化

### 問題

アコーディオンを開いたとき、保存ボタンがビューポートの下に隠れていました。

### 解決 — 間隔・パディング縮小

| 場所 | 変更前 | 変更後 | 節約 |
|------|--------|--------|------|
| MoreTabコンテナ下部パディング | `pb-8` (32px) | `pb-4` (16px) | −16px |
| カード間隔 | `gap-3` (60px) | `gap-2` (40px) | −20px |
| 予算ボディ下部パディング | `pb-4` (16px) | `pb-3` (12px) | −4px |
| 予算ボディ内部間隔 | `gap-3` (24px) | `gap-2` (16px) | −8px |
| **合計節約** | | | **−48px** |

---

## 8. E2Eテスト（Playwright）

`tests/more-tab.spec.ts`に7件のテスト追加。

### mockの方針 — 年月ごとに異なる予算を返す

```typescript
await page.route('**/budgets/**', route => {
  const url = route.request().url();
  if (route.request().method() === 'GET') {
    if (url.includes(PREV_YM))  // 前月 → ¥180,000
      return route.fulfill({ status: 200, body: JSON.stringify({ amount: 180000 }) });
    if (url.includes(NEXT_YM))  // 翌月 → 予算なし（404）
      return route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
    // 今月 → ¥300,000
    return route.fulfill({ status: 200, body: JSON.stringify({ amount: 300000 }) });
  }
  ...
});
```

**`amount: 0`ではなく404を返す理由:**
- `amount: 0`（200 OK）だと「現在: ¥0」が表示されてしまい、「未設定」と区別できない
- 404を返すとAPIが`throw`し、`.catch`で`currentBudget = null`になり、金額が非表示になる

---

## 9. 開発環境のPIN管理

PINはFirestore `settings/app_settings`ドキュメントの`pin`フィールドに平文で保存されます。

```
コレクション: settings
ドキュメント: app_settings
フィールド:   pin (string) — 4桁の数字
```

開発環境に`pin`フィールドがないと`getPin()`が`undefined`を返してログイン不可になります。Firestore REST APIで直接設定できます。

```bash
curl -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token --project=money-manager-dev-001)" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/money-manager-dev-001/databases/(default)/documents/settings/app_settings?updateMask.fieldPaths=pin" \
  -d '{"fields": {"pin": {"stringValue": "0914"}}}'
```
