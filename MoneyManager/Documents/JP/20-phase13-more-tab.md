# Phase 13 学習文書 — もっとみるタブ（MoreTab）

## 1. 概要

もっとみるタブはアプリの設定画面です。
単一コンポーネント（`MoreTab.tsx`）の中で2つの画面をビュー状態で切り替えます。

```
MoreView = 'main'       → メインメニュー（PIN・予算・カテゴリーへの入口）
MoreView = 'categories' → カテゴリー管理画面
```

---

## 2. 核心パターン — ビュー切り替え（View Switching）

```typescript
// 単一コンポーネント内で画面を切り替え
type MoreView = 'main' | 'categories';
const [view, setView] = useState<MoreView>('main');

if (view === 'categories') {
  return <カテゴリー画面 />;
}
return <メインメニュー />;
```

**なぜこのようにするのか？**
別のRoute（ページ）に分離するとURLが変わり、ブラウザの戻る動作が変わります。
アプリ内の切り替え（ナビゲーションなし）は状態で処理する方が自然です。

---

## 3. アコーディオンパターン（Accordion）

```typescript
const [pinOpen, setPinOpen] = useState(false);

// ヘッダーボタンクリック → トグル
onClick={() => setPinOpen(o => !o)}

// 展開エリア：状態に応じて条件付きレンダリング
{pinOpen && <フォームエリア />}
```

**ポイント**：`setPinOpen(o => !o)` — 関数型更新で前の値を基にトグル
（前のStateを直接参照しないためクロージャ問題を防ぐ）

---

## 4. Firestoreカテゴリーの CRUD

### 4-1. バックエンドサービス（`src/services/firestore.ts`）

```typescript
export interface Category {
  id?: string;
  type: 'income' | 'expense';
  name: string;
  order: number;
}

// 空の場合は自動seed → 再取得 → 返却
export async function getCategories(type: 'income' | 'expense'): Promise<Category[]> {
  const snapshot = await db.collection('categories').where('type', '==', type).get();
  if (snapshot.empty) {
    await seedCategories(type);           // デフォルト値を登録
    return getCategories(type);           // 再取得（再帰）
  }
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
}
```

**Firestore複合インデックス回避戦略**：
`where('type', '==', type)` — 単一フィールドフィルターのみ使用
→ Firestoreインデックスの作成なしでも動作
→ ソート（`order`基準）はJSの配列`.sort()`で処理

### 4-2. APIルート（`src/routes/categories.ts`）

```typescript
// GET /categories?type=expense|income
router.get('/', async (req, res) => {
  const type = req.query.type as 'income' | 'expense';
  const list = await getCategories(type);
  res.json(list);
});

// POST /categories { type, name }
router.post('/', async (req, res) => {
  const { type, name } = req.body;
  const cat = await addCategory(type, name);
  res.status(201).json(cat);
});

// DELETE /categories/:id
router.delete('/:id', async (req, res) => {
  // TypeScript: req.params.id の型が string | string[] のため処理が必要
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await deleteCategoryById(id);
  res.status(204).send();
});
```

---

## 5. フォールバック（Fallback）戦略 — TransactionForm

```typescript
// 初期値：ハードコードされたリスト（APIロード前に空画面を防ぐ）
const [apiCategories, setApiCategories] = useState<Record<...>>(FALLBACK_CATEGORIES);

useEffect(() => {
  Promise.all([getCategories('expense'), getCategories('income')])
    .then(([exp, inc]) => {
      setApiCategories({
        expense: exp.map(c => c.name),
        income:  inc.map(c => c.name),
      });
    })
    .catch(() => {}); // 失敗時はフォールバックを維持
}, []);
```

**核心**：APIが遅かったり失敗しても画面が空のチップリストになって見えることがない
→ FALLBACK → API成功 → 置き換え のパターン

---

## 6. PIN入力処理

```typescript
// 数字のみ許可、最大4桁
<input
  type="password"        // 入力中 ● マスキング
  inputMode="numeric"    // モバイル：数字キーパッドを表示
  maxLength={4}
  onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 4))}
  placeholder="••••"
/>
```

**`replace(/\D/g, '')`**：数字以外の文字を除去
**`.slice(0, 4)`**：4桁超えを防ぐ（maxLengthの補強）

---

## 7. 成功メッセージの自動非表示パターン

```typescript
setPinSuccess(true);
setTimeout(() => {
  setPinSuccess(false);  // メッセージを非表示
  setPinOpen(false);     // アコーディオンを閉じる
}, 1500);
```

→ ユーザーがボタンを再度クリックする必要なく、1.5秒後に自動で閉じる

---

## 8. E2Eテストの主要技法（`tests/more-tab.spec.ts`）

### 8-1. sessionStorageでPIN画面をバイパス

```typescript
// page.goto() 前に登録しないと適用されない！
await page.addInitScript(() => {
  sessionStorage.setItem('mm_verified', 'true');
});
await page.goto('/');
```

`addInitScript` — ページのスクリプトが実行される前に注入されます。
`goto()` の後で行うと既にPIN画面がレンダリングされた後なので効果がありません。

### 8-2. exact: true でボタンの重複マッチを回避

```typescript
// FABボタン（aria-label="取引を追加"）との重複マッチを防ぐ
await page.getByRole('button', { name: '追加', exact: true }).click();
```

### 8-3. XPath親選択で行（row）を特定

```typescript
// spanの直接の親（行div）に移動して削除ボタンをクリック
await page.locator('span', { hasText: '食費' }).first()
  .locator('xpath=..')     // 親要素に移動
  .getByRole('button', { name: '削除' })
  .click();
```

**`xpath=..`**：Playwrightロケーターで直接の親を選択するXPath軸（axis）

### 8-4. PUTメソッド別のルートモッキング

```typescript
await page.route('**/settings/pin', route => {
  if (route.request().method() === 'PUT') {
    return route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
  }
  route.continue(); // 他のメソッドは実際のリクエストを通す
});
```

---

## 9. デプロイフロー

```bash
# バックエンドのビルドとCloud Runデプロイ
cd /Users/cw-park/private-project/MoneyManager
npx tsc
gcloud run deploy money-manager --source . --region asia-northeast3

# フロントエンドのVercel自動デプロイ（git push → Vercel CI）
```

---

## 10. まとめ：Phase 13で学んだこと

| 概念 | 核心ポイント |
|------|-------------|
| ビュー切り替え | `MoreView`型 + 条件付きreturnでSPA内の画面切り替え |
| アコーディオン | `useState(false)` + `o => !o` 関数型トグル |
| Firestore CRUD | 単一フィールドフィルターで複合インデックス回避、auto-seedパターン |
| フォールバック戦略 | FALLBACK → API置き換え（ローディング中の空画面を防ぐ） |
| PIN入力 | `type="password"` + `inputMode="numeric"` + `replace(/\D/g, '')` |
| E2Eセッションバイパス | `addInitScript` + `sessionStorage.setItem` |
| E2Eボタン特定 | `exact: true` + `xpath=..` 親選択 |
