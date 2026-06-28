# Phase Dev-5 — Vercel開発固定URL設定 学習ドキュメント

## 概要

開発環境のフロントエンドデプロイ時に毎回異なる一時URLが生成される問題を解決し、
`vercel alias` コマンドで常に同じ固定URLを維持する方式を構成した過程を説明します。

---

## 1. 問題 — 一時的なPreview URL

Vercelは `--prod` なしでデプロイすると、コミットごとに新しい固有URLを生成します。

```
develop 1回目のpush → https://frontend-abc123-changwoo-park.vercel.app
develop 2回目のpush → https://frontend-def456-changwoo-park.vercel.app
develop 3回目のpush → https://frontend-ghi789-changwoo-park.vercel.app
```

チーム開発ではPRごとの独立URLが便利ですが、一人で開発する環境では
**毎回新しいURLをActionsログから探す手間**が発生します。

---

## 2. 解決策 — vercel alias

`vercel alias set` コマンドは、特定のデプロイURLに固定の別名（alias）を付けます。
`develop`にpushするたびに新しいデプロイURLが生成されますが、aliasは常に最新のデプロイを指します。

```
develop 1回目のpush → frontend-abc123-changwoo-park.vercel.app ← frontend-dev-changwoo-park.vercel.app
develop 2回目のpush → frontend-def456-changwoo-park.vercel.app ← frontend-dev-changwoo-park.vercel.app (更新)
develop 3回目のpush → frontend-ghi789-changwoo-park.vercel.app ← frontend-dev-changwoo-park.vercel.app (更新)
```

固定URLは常に最新のデプロイを指します。

---

## 3. deploy-dev.yml の修正内容

### 修正前

```yaml
# --prod なしでデプロイ → 一時的なPreview URLが生成される
- name: Deploy to Vercel Preview
  run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
```

### 修正後

```yaml
# デプロイ後に固定alias適用 — developへのpushごとに同じURLが最新ビルドを指す
- name: Deploy and alias to fixed dev URL
  run: |
    DEPLOY_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
    vercel alias set $DEPLOY_URL frontend-dev-changwoo-park.vercel.app --token=${{ secrets.VERCEL_TOKEN }}
```

### 主な変更点

| 項目 | 説明 |
|------|------|
| `DEPLOY_URL=$(...)` | `vercel deploy`の出力（デプロイされた固有URL）を変数に保存 |
| `vercel alias set A B` | A（固有デプロイURL）にB（固定alias）を紐付けるコマンド |
| `--token=` | CI環境でVercel CLIの認証に使用するアクセストークン |

---

## 4. 最終URL構成

| 環境 | 固定URL | デプロイトリガー |
|------|---------|----------------|
| 本番 | `https://frontend-changwoo-park.vercel.app` | `main`ブランチへのpush |
| 開発 | `https://frontend-dev-changwoo-park.vercel.app` | `develop`ブランチへのpush |

---

## 5. vercel alias の動作原理

```
vercel deploy --prebuilt
  → Vercelサーバーにビルド成果物をアップロード
  → 固有URLを生成: frontend-xxx-changwoo-park.vercel.app
  → このURLをDEPLOY_URL変数に保存

vercel alias set $DEPLOY_URL frontend-dev-changwoo-park.vercel.app
  → VercelのDNSテーブルで frontend-dev-changwoo-park.vercel.app → frontend-xxx-changwoo-park.vercel.app に更新
  → ブラウザで固定URLにアクセスすると最新デプロイにルーティング
```

aliasは即座に反映され、追加のDNS伝播待ちは不要です。

---

## 6. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| Vercel Preview URL | `--prod`なしのデプロイ時にコミットごと自動生成される固有URL |
| `vercel alias set` | 特定のデプロイURLに固定別名を紐付けるVercel CLIコマンド |
| `$(コマンド)` | シェルでコマンドの出力値を変数に保存する構文（コマンド置換） |
| aliasの更新 | 同じaliasを`set`すると前の接続が上書きされ、常に最新デプロイを指す |
