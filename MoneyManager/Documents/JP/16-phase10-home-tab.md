# Phase 10: ホーム画面 — 日別履歴タブ

## このフェーズで行ったこと

ホームタブ画面を実際に実装しました。
Phase 9までは取引履歴を保存する機能のみあり、ホームタブは空のプレースホルダーでした。
このフェーズで保存された履歴を日付別に読み込んで画面に表示し、
上部に予算状況ダッシュボードを追加しました。

---

## 実装画面構成

```
┌─────────────────────────────┐
│         2026年 6月   ‹  ›   │  ← MonthSelector（年月セレクター）
├─────────────────────────────┤
│  予算        支出      残余  │
│  未設定    ¥14,720     ¥0   │  ← 予算ダッシュボードカード
│  ██████████████░░░ 80% 消費 │  ← 消費進行バー
├─────────────────────────────┤
│  6月18日（木）    -¥1,500   │  ← 日付ヘッダー + 日別小計
│ ┌───────────────────────── ┐│
│ │ [その他]          -¥1,500 ││  ← 取引項目カード
│ └─────────────────────────┘│
│                             │
│  6月17日（水）   -¥13,220   │
│ ┌───────────────────────── ┐│
│ │ [食費]  昼食      -¥5,000 ││
│ │──────────────────────────││
│ │ [交通費]          -¥1,500 ││
│ │──────────────────────────││
│ │ [パン]            -¥1,420 ││
│ └─────────────────────────┘│
├─────────────────────────────┤
│  🏠    📅    📊    ⋯    [+] │
└─────────────────────────────┘
```

---

## 核心概念1：useEffectでデータを取得する

コンポーネントが画面に表示される際にサーバーからデータを取得するパターンです。

```tsx
useEffect(() => {
  let cancelled = false; // クリーンアップフラグ（重要！）

  async function fetchData() {
    setLoading(true);
    try {
      const [txList, budgetData] = await Promise.all([
        getTransactions(yearMonth),          // 取引履歴取得
        getBudget(yearMonth).catch(() => null), // 予算取得（なければnull）
      ]);
      if (!cancelled) {
        setTransactions(txList);
        setBudget(budgetData);
      }
    } catch {
      if (!cancelled) setError('データの読み込みに失敗しました。');
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  fetchData();
  return () => { cancelled = true; }; // アンマウント時にクリーンアップ
}, [yearMonth, refreshKey]); // 年月変更または保存完了時に再取得
```

### `cancelled` フラグが必要な理由

```
1. ユーザーが「6月」を選択 → APIリクエストA開始
2. ユーザーが「5月」に素早く切り替え → APIリクエストB開始
3. リクエストBが先に完了 → 5月のデータをセット
4. リクエストAが後から完了 → 6月のデータで上書き！（バグ）
```

`cancelled = true`で以前のリクエストのレスポンスを無視すればこの問題を防げます。
Reactの`useEffect`クリーンアップ関数（`return () => {...}`）は依存関係が変わるかコンポーネントが消える際に呼び出されます。

---

### `Promise.all`で並列リクエスト

```tsx
// ❌ 順次リクエスト — 合計待機時間 = リクエストA時間 + リクエストB時間
const txList     = await getTransactions(yearMonth); // 500ms待機
const budgetData = await getBudget(yearMonth);       // 300ms待機
// 合計800ms

// ✅ 並列リクエスト — 合計待機時間 = max(リクエストA時間, リクエストB時間)
const [txList, budgetData] = await Promise.all([
  getTransactions(yearMonth), // ┐
  getBudget(yearMonth),       // ┘ 同時に開始
]);
// 合計500ms（長い方が基準）
```

予算APIに`.catch(() => null)`を付ける理由：
予算を一度も設定していない月はバックエンドが404を返します。
このとき`Promise.all`全体が失敗しないよう、エラーを`null`で吸収します。

---

## 核心概念2：`refreshKey` — 親から子の再取得をトリガー

Phase 9で予告した`refreshKey`パターンがここで実際に使用されます。

```
MainApp（親）
  └─ refreshKey: number  ← 保存完了時に +1
  └─ HomeTab（子）
       └─ useEffect([yearMonth, refreshKey])
            └─ refreshKey が変わると API を再取得
```

```tsx
// MainApp.tsx — 親
const [refreshKey, setRefreshKey] = useState(0);
const handleSaved = () => setRefreshKey((k) => k + 1); // 保存完了時に増加

<HomeTab yearMonth={yearMonth} refreshKey={refreshKey} />
<TransactionForm onSaved={handleSaved} />

// HomeTab.tsx — 子
useEffect(() => {
  fetchData();
}, [yearMonth, refreshKey]); // refreshKey が 1 → 2 に変わると再実行
```

この方式の利点：親子間で複雑なState共有なしに、シンプルな数値一つで同期できます。

---

## 核心概念3：データのグループ化 — 日付別にまとめる

サーバーから受け取った取引履歴配列を日付別にまとめる関数です。

```
入力（サーバーレスポンス）：
  [{ date: "2026-06-18", category: "その他",  amount: 1500 },
   { date: "2026-06-17", category: "食費",   amount: 5000 },
   { date: "2026-06-17", category: "交通費",  amount: 1500 }]

出力（グループ化結果）：
  [{ date: "2026-06-18", transactions: [...1件], totalExpense: 1500 },
   { date: "2026-06-17", transactions: [...2件], totalExpense: 6500 }]
```

```tsx
function groupByDate(transactions: Transaction[]): DayGroup[] {
  // ステップ1：日付 DESC、同一日付なら登録日時 DESC でソート
  const sorted = [...transactions].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return createdAtSeconds(b) - createdAtSeconds(a);
  });

  // ステップ2：Mapで日付別グループ化（挿入順序を保持）
  const map = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }

  // ステップ3：DayGroup配列に変換 + 合計計算
  return [...map.entries()].map(([date, txs]) => ({
    date,
    transactions: txs,
    totalIncome:  txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    totalExpense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }));
}
```

### `Map`を使う理由

`{ [date: string]: Transaction[] }` オブジェクトを使うこともできますが、
JavaScriptオブジェクトはキーの挿入順序が保証されない場合があります。
`Map`は挿入順序が常に保証されているため、日付を降順でソートしてからMapに入れると
取り出す際もその順序が維持されます。

---

## 核心概念4：Firestoreクエリと複合インデックス

### 問題：複合インデックスエラー

最初の実装時、バックエンドのクエリをこのように書きました：

```typescript
db.collection('transactions')
  .orderBy('date', 'desc')
  .orderBy('createdAt', 'desc')  // ← この行が問題
  .where('date', '>=', '2026-06-01')
  .where('date', '<=', '2026-06-31')
```

実行するとエラーが発生しました：
```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```

### なぜインデックスが必要なのか？

Firestoreはデータベースのテーブルのように全フィールドの組み合わせを自動インデックス化しません。
**範囲フィルター（`>=`、`<=`）**と**別フィールドのソート（`orderBy`）**を同時に使うと
Firestoreが効率的にクエリするための**複合インデックス（Composite Index）**が必要です。

```
単一フィールド orderBy + 同一フィールド範囲フィルター → インデックス不要 ✅
  .orderBy('date').where('date', '>=', ...).where('date', '<=', ...)

別フィールド orderBy を追加 → 複合インデックスが必要 ❌
  .orderBy('date').orderBy('createdAt')
  + .where('date', '>=', ...).where('date', '<=', ...)
```

### 解決方法：JavaScriptでソート処理

```typescript
// 修正前：Firestoreが2フィールドを同時にソート → インデックスが必要
.orderBy('date', 'desc').orderBy('createdAt', 'desc')

// 修正後：Firestoreは date のみソート、createdAt は JS で処理
.orderBy('date', 'desc')
// その後 JS で：
rows.sort((a, b) => {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return bTs - aTs; // createdAt 2次ソート
});
```

Firestore複合インデックスを作成する方法もあります：

```bash
gcloud firestore indexes composite create \
  --collection-group=transactions \
  --field-config=field-path=date,order=DESCENDING \
  --field-config=field-path=createdAt,order=DESCENDING
```

インデックス作成には数分かかり、本番稼動中のサービスならデータ規模によってはさらに時間がかかります。

---

## 核心概念5：予算ダッシュボードUIの計算

```tsx
// 当月収入/支出の集計（transactions配列から計算）
const totalIncome  = transactions.filter(t => t.type === 'income')
                                 .reduce((sum, t) => sum + t.amount, 0);
const totalExpense = transactions.filter(t => t.type === 'expense')
                                 .reduce((sum, t) => sum + t.amount, 0);

// 残余予算（予算設定時）
const remaining = budget ? budget.amount - totalExpense : null;

// 進行バー割合（0〜1の範囲にクランプ）
const budgetRatio = budget && budget.amount > 0
  ? Math.min(1, totalExpense / budget.amount)
  : 0;
```

### `Math.min(1, ...)` クランプが必要な理由

予算が¥100,000なのに支出が¥120,000なら、割合が1.2（120%）になります。
CSSの`width`に`120%`を指定すると進行バーがコンテナをはみ出して崩れます。
`Math.min(1, 1.2) = 1`で最大100%を超えないよう制限します。

```tsx
// 進行バーの色：90%以上消費なら赤い警告
backgroundColor: budgetRatio >= 0.9 ? 'var(--expense)' : 'var(--income)'
```

---

## 核心概念6：3段階画面状態（Loading / Error / Content）

外部からデータを取得する画面は常に3つの状態を処理する必要があります。

```tsx
// ローディング中
if (loading) {
  return <p>読み込み中...</p>;
}

// エラー発生
if (error) {
  return <p style={{ color: 'var(--expense)' }}>{error}</p>;
}

// 正常データ（空の状態も含む）
return (
  <div>
    {/* 予算ダッシュボード */}
    {dayGroups.length === 0 ? (
      <p>今月の取引履歴はありません。</p>
    ) : (
      dayGroups.map(group => <DayGroupCard ... />)
    )}
  </div>
);
```

このパターンを守らないと：
- ローディング中に空の画面が見える（UX不良）
- APIエラー時にアプリがクラッシュする（安定性不良）
- データがないときに何も表示されない（案内不良）

---

## 未実装項目：Firestoreリアルタイム連携（`onSnapshot`）

### `onSnapshot`とは？

> 「データベースが変わった瞬間に、サーバーに聞かなくても画面が自動で変わる。」

現在のアプリは**リクエスト（fetch）**方式でデータを取得します。
`onSnapshot`はFirestoreが提供する**リアルタイム購読（Subscribe）**機能です。

---

### 現在の方式 vs `onSnapshot`方式

**現在の方式 — fetch + refreshKey（リクエスト-レスポンス）**

```
ユーザー：保存ボタンをクリック
    │
    ▼
アプリ：refreshKey +1 → useEffect 再実行 → GET /transactions リクエスト
    │
    ▼
サーバー：データレスポンス
    │
    ▼
画面更新 ✅
```

- 自分が直接保存した場合のみ更新される
- 1回限りの通信（リクエスト → レスポンス → 終了）

---

**onSnapshot方式 — リアルタイム購読（持続接続）**

```
アプリ起動時：Firestoreに購読登録（「このデータを見続けるよ」）
    │
    ▼ （ソケット接続を維持中...）
    │
誰かがDBにデータを追加/更新/削除
    │
    ▼
Firestore：「変わったよ！」→ アプリに自動プッシュ（リクエストなし）
    │
    ▼
画面自動更新 ✅
```

- DBが変わるとFirestoreがアプリに通知する
- リクエストなしでも常に最新状態を維持

---

### 日常的な例え

| 方式 | 例え |
|---|---|
| **現在の方式（fetch）** | カフェで「私の飲み物できましたか？」とカウンターに直接確認しに行く |
| **onSnapshot** | 呼び出しベルを受け取って座っていて、鳴ったら取りに行く |

fetchは自分が動いて確認し、`onSnapshot`はFirestoreが勝手に知らせてくれます。

---

### コードで見る違い

```typescript
// ── 現在の方式（fetch）──────────────────────────────────────────
// 特定の時点で一度リクエストして、レスポンスを受け取れば終了
const data = await getTransactions(yearMonth);
setTransactions(data);

// ── onSnapshot方式 ────────────────────────────────────────────
// 購読を設定しておくと、DBが変わるたびにコールバックが自動で呼び出される
const unsubscribe = db.collection('transactions')
  .where('yearMonth', '==', yearMonth)
  .onSnapshot((snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setTransactions(data); // DB変更時に自動実行
  });

// コンポーネントのアンマウント時に購読を解除（メモリリーク防止）
return () => unsubscribe();
```

---

### このアプリで実際にどんな違いが生まれるか？

**今は不便でない理由：**

現在はユーザーが一人で使っており、保存すると`refreshKey`で即時更新されるため実質的な不便はありません。

**`onSnapshot`が有用になるシナリオ：**

| シナリオ | 現在の方式 | onSnapshot |
|---|---|---|
| スマホで保存 → PCのタブ | PCでリロードが必要 | PCの画面が自動で更新される |
| 家族と家計簿を共有 | 相手が保存しても自分の画面はそのまま | 相手が保存したら自分の画面もすぐに更新 |
| オフライン → オンライン復帰 | リロードが必要 | Firestoreが自動で積み残しの変更を同期 |

---

### 今実装が難しい理由

現在のアーキテクチャ構成：

```
フロントエンド（Vercel）→ バックエンドAPI（Cloud Run）→ Firestore
```

`onSnapshot`は**フロントエンドがFirestoreに直接接続したソケット**を維持する必要があります。
しかし現在のフロントエンドはFirestoreを直接見ることができず、バックエンドAPIを通じてのみアクセスします。

**実装の選択肢と問題点：**

| 方法 | 内容 | 問題 |
|---|---|---|
| **フロントエンドにFirebase SDKを直接追加** | フロントエンドからFirestoreに直接`onSnapshot`購読 | バックエンドが担当していたセキュリティ・認証分離の原則が崩れる。Firestoreの認証情報をフロントエンドの環境変数に露出する必要がある |
| **バックエンドでSSEを実装** | バックエンドが`onSnapshot`を購読してフロントエンドにイベントストリームを送信 | Vercelのサーバーレス関数は最大30秒タイムアウト → 長時間の接続維持が不可能 |

**結論：** 1人用家計簿アプリでは`refreshKey`方式で十分。複数デバイスの同時使用や家族共有機能が必要になる時点でFirebase直接連携方式への再設計を検討。

---

## ファイル変更まとめ

| ファイル | 変更内容 |
|------|-----------|
| `frontend/src/components/features/home/HomeTab.tsx` | 全面実装（Phase 10プレースホルダー → 実際の画面） |
| `src/services/firestore.ts` | `getTransactions`クエリから2重`orderBy`を削除、JSソートに置換 |
| `todo-architecture.md` | Phase 10完了を記録 |

---

## データフロー全体図

```
ユーザーが年月変更または取引保存
         │
         ▼
MainApp: yearMonth または refreshKey 変更
         │
         ▼
HomeTab: useEffect 再実行
         │
         ├─── Promise.all ──────────────────────────────────────────┐
         │       ├── GET /transactions?yearMonth=2026-06            │
         │       │       └── Firestore: date DESC ソート + 範囲フィルター │
         │       │           JS: createdAt 2次ソート                │
         │       └── GET /budgets/2026-06                          │
         │               └── Firestore: yearMonth 一致ドキュメント参照│
         └───────────────────────────────────────────────────────────┘
                  │
                  ▼
         groupByDate() で日付別グループ化
                  │
                  ▼
         画面レンダリング：
           - 予算ダッシュボード（予算/支出/残余 + 進行バー）
           - 日付別取引カードリスト
```
