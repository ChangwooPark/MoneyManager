# トラブルシューティング：本番PIN認証失敗

## 現象

ローカル環境ではPIN `8907`が正常に動作しているのに、
Vercel本番URLでは同じPINを入力しても「PINが間違っています」と表示されてログインできない問題。

---

## 分析過程

### ステップ1：バックエンドに問題があるのか？

まずバックエンドAPIが正しくレスポンスしているか`curl`で直接テストしました。

```bash
curl -X POST \
  https://money-manager-1094294666571.asia-northeast3.run.app/settings/pin/verify \
  -H "Content-Type: application/json" \
  -H "Origin: https://frontend-dusky-tau-46.vercel.app" \
  -d '{"pin":"8907"}'

# レスポンス：
{"success":true}
```

**結論：** バックエンドは正常です。`8907`に対して`success: true`を返します。

---

### ステップ2：フロントエンドコードに問題があるのか？

`PinScreen.tsx`のエラー処理コードを確認しました。

```typescript
try {
  const { success } = await verifyPin(next);
  if (success) {
    onSuccess();        // 認証成功
  } else {
    setError(true);     // ← バックエンドが false を返した場合このパス
    setTimeout(() => { setPin(''); setError(false); }, 600);
  }
} catch {
  setError(true);       // ← fetch自体が失敗した場合もこのパス（同じUI）
  setTimeout(() => { setPin(''); setError(false); }, 600);
}
```

**核心発見：** `success: false`を受け取った場合と`fetch自体が失敗した場合`で、画面に表示されるエラーメッセージが同じです。
つまり「PINが間違っています」は実際にPINが間違っているのではなく、**ネットワークエラーの可能性もある**ということです。

---

### ステップ3：環境変数は正しく設定されているか？

Vercelに保存された環境変数一覧を確認しました。

```bash
vercel env ls production

# 結果：
# name                  value       environments   created
# NEXT_PUBLIC_API_URL   Encrypted   Production     1h ago
```

環境変数は存在します。しかし値が**Encrypted（暗号化）**として表示されています。

---

### ステップ4：GitHub Actionsで環境変数が正しく取得されているか？

`vercel pull`が実際にダウンロードする値を直接確認しました。

```bash
vercel env pull .env.verify --environment=production --yes
cat .env.verify
```

```dotenv
# 結果：
NEXT_PUBLIC_API_URL=""       ← 空文字列！
VERCEL="1"
VERCEL_ENV="production"
...
```

**原因発見：** `NEXT_PUBLIC_API_URL`が空文字列（`""`）として取得されていました。

---

## 根本原因

### Vercel暗号化変数の動作方式

Vercelは環境変数を2つのタイプで保存します。

| タイプ | 説明 | vercel pull の結果 |
|------|------|-----------------|
| 通常（Plain） | 平文で保存 | 実際の値がダウンロードされる |
| 暗号化（Sensitive/Encrypted） | 暗号化して保存 | **空文字列（`""`）としてダウンロードされる** |

`NEXT_PUBLIC_API_URL`が暗号化タイプで保存されていたため、
GitHub Actionsの`vercel pull`ステップで実際のURLの代わりに空文字列を受け取りました。

### ビルド過程での連鎖問題

```
vercel pull → NEXT_PUBLIC_API_URL = ""
     ↓
vercel build → next build を実行
     ↓
api.ts: const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
        "" ?? 'http://localhost:8080' = ""   ← ?? は null/undefined のみ検知、空文字列は通過！
     ↓
BASE_URL = ""  （空文字列）
     ↓
fetch(`${BASE_URL}/settings/pin/verify`) = fetch("/settings/pin/verify")
     ↓
Vercelサーバーで /settings/pin/verify パスを検索 → 存在しない → 404エラー
     ↓
catch ブロック実行 → 「PINが間違っています」と表示
```

### `??` と `||` の違い

この問題の核心となったJavaScript演算子の違いです。

```javascript
// Nullish Coalescing (??) — null と undefined のみ検知
"" ?? "デフォルト値"   // = ""        ← 空文字列はそのまま通過！
null ?? "デフォルト値" // = "デフォルト値"
undefined ?? "デフォルト値" // = "デフォルト値"

// OR (||) — falsy 値全体を検知（null、undefined、""、0、false）
"" || "デフォルト値"   // = "デフォルト値"  ← 空文字列もデフォルト値に置換
null || "デフォルト値" // = "デフォルト値"
undefined || "デフォルト値" // = "デフォルト値"
```

`NEXT_PUBLIC_API_URL`が`""`（空文字列）のとき`??`はそのまま通過させてしまい、
その結果`BASE_URL`が空文字列になりました。

---

## 解決方法

### 修正1：`api.ts` — `??` → `||` に変更

```typescript
// 修正前
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// 修正後
// || を使用：空文字列（""）もフォールバックとして処理
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
```

これだけでも空文字列問題を防御できます。
しかし根本原因（環境変数が空で来る問題）も合わせて修正しました。

---

### 修正2：GitHub Actionsワークフロー — ビルド時に環境変数を直接注入

```yaml
- name: Build project
  working-directory: MoneyManager/frontend
  run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
  env:
    VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
    VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g
    NEXT_PUBLIC_API_URL: https://money-manager-1094294666571.asia-northeast3.run.app  # ← 追加
```

`vercel build`を実行する環境に直接`NEXT_PUBLIC_API_URL`を注入します。
システム環境変数は`vercel pull`で受け取った値より優先適用されるため、
暗号化変数の問題と無関係に常に正しいURLでビルドされます。

> **なぜハードコードしても問題ないのか？**
> `NEXT_PUBLIC_API_URL`はCloud Runバックエンドの公開URLです。
> 秘密情報（Secret）ではないため、ワークフローファイルに直接記述してもセキュリティ上問題ありません。

---

## 最終的な修正フロー

```
git push origin main
     ↓
GitHub Actions実行
     ↓
vercel pull → NEXT_PUBLIC_API_URL = ""（依然として空）
     ↓
vercel build（環境変数 NEXT_PUBLIC_API_URL=https://...run.app を直接注入）
     ↓
next build → process.env.NEXT_PUBLIC_API_URL = "https://...run.app"  ✅
     ↓
BASE_URL = "https://money-manager-1094294666571.asia-northeast3.run.app"
     ↓
fetch("https://...run.app/settings/pin/verify")  ✅
     ↓
{"success": true}  ✅
     ↓
PIN認証成功  ✅
```

---

## 学んだこと

### 1. エラーメッセージだけを見てはいけない

「PINが間違っています」というUIメッセージは実際には2つの原因がありました。
- 実際にPINが間違っている場合
- **ネットワーク/APIエラーでfetchが失敗した場合**

このように同じUIメッセージが異なる原因から発生する可能性があるため、
**バックエンドを直接テスト（curl）**して疑いの範囲を絞り込むことが重要です。

### 2. 環境変数はデプロイ方法によって動作が異なる

| デプロイ方法 | 環境変数の処理方式 |
|-----------|-----------------|
| `vercel --prod`（CLI直接実行） | Vercelサーバーが直接ビルドするため暗号化変数も正常に使用される |
| GitHub Actions + `vercel pull/build/deploy` | `vercel pull`が暗号化変数を空値で返す |

以前はCLIで直接デプロイしていたため問題がありませんでしたが、
GitHub Actions方式に切り替えたことでこの違いが露見しました。

### 3. `??` と `||` は用途が異なる

環境変数のように「設定されていないか空になる可能性がある」値には`||`を使用するのが安全です。
`??`は`null`/`undefined`のみを検知するため、空文字列の状況では機能しません。

---

## 関連ファイル

| ファイル | 修正内容 |
|------|----------|
| `frontend/src/lib/api.ts` | `??` → `||` に変更 |
| `.github/workflows/deploy.yml` | `vercel build`ステップに`NEXT_PUBLIC_API_URL`を直接注入 |
