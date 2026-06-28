# Phase Dev-4 — GitHub Actionsワークフロー分離 学習ドキュメント

## 概要

一つの `deploy.yml` を `deploy-prod.yml`（本番）と `deploy-dev.yml`（開発）に分離した過程を説明します。

---

## 1. GitHub Actionsとは

GitHubリポジトリで特定のイベント（push、PRなど）が発生したときに自動実行されるスクリプトです。
`.github/workflows/` フォルダ内のYAMLファイルで定義します。

```
開発者が git push
  → GitHubがイベントを検知
  → .github/workflows/*.yml ファイルを確認
  → 条件に合うワークフローを自動実行
  → ビルド → プッシュ → デプロイ
```

---

## 2. 分離前後の構造

**分離前**
```
.github/workflows/
  deploy.yml        ← mainブランチのみ対応
```

**分離後**
```
.github/workflows/
  deploy-prod.yml   ← mainブランチ → 本番サーバー
  deploy-dev.yml    ← developブランチ → 開発サーバー
```

---

## 3. 2つのファイルの違い

### トリガーブランチ

```yaml
# deploy-prod.yml
on:
  push:
    branches:
      - main      # mainにpushされたときのみ実行

# deploy-dev.yml
on:
  push:
    branches:
      - develop   # developにpushされたときのみ実行
```

### GCP認証（Secrets）

```yaml
# deploy-prod.yml — 本番プロジェクトのSAキー
credentials_json: ${{ secrets.GCP_SA_KEY }}

# deploy-dev.yml — 開発プロジェクトのSAキー
credentials_json: ${{ secrets.GCP_DEV_SA_KEY }}
```

`${{ secrets.名前 }}` はGitHub Secretsに保存された機密値を取り出す構文です。
実際のキー値がワークフローのコードに露出することはありません。

### Dockerイメージパス

```yaml
# deploy-prod.yml
IMAGE=asia-northeast3-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/money-manager/account-book:${{ github.sha }}

# deploy-dev.yml
IMAGE=asia-northeast3-docker.pkg.dev/${{ secrets.GCP_DEV_PROJECT_ID }}/money-manager-dev/account-book:${{ github.sha }}
```

`${{ github.sha }}` は現在のコミットの固有ハッシュ値（例: `a1b2c3d...`）です。
イメージにコミットハッシュをタグとして付けることで、**どのコードでビルドされたイメージかを追跡**できます。

### Cloud Runデプロイ対象

```yaml
# deploy-prod.yml
gcloud run deploy money-manager      # 本番サービス

# deploy-dev.yml
gcloud run deploy money-manager-dev  # 開発サービス
```

### Vercelデプロイ方式

```yaml
# deploy-prod.yml — 本番URLに固定反映
vercel build --prod
vercel deploy --prebuilt --prod

# deploy-dev.yml — 開発固定URLに反映（Dev-5で設定）
vercel build
vercel deploy --prebuilt
```

### バックエンドURL注入

```yaml
# deploy-prod.yml
NEXT_PUBLIC_API_URL: https://money-manager-1094294666571.asia-northeast3.run.app

# deploy-dev.yml
NEXT_PUBLIC_API_URL: https://money-manager-dev-576447610294.asia-northeast3.run.app
```

フロントエンドはビルド時にバックエンドURLがコード内にバンドル（組み込み）されます。
環境によって異なるURLを注入することで、それぞれのバックエンドと通信できます。

---

## 4. 全体ワークフロー図

```
developブランチに git push
  │
  ├─ deploy-dev.yml 実行
  │    ├─ GCP開発アカウントで認証 (GCP_DEV_SA_KEY)
  │    ├─ Dockerイメージビルド → 開発Artifact Registryにプッシュ
  │    ├─ 開発Cloud Run (money-manager-dev) デプロイ
  │    └─ Vercel開発URLにフロントエンドデプロイ
  │
  └─ deploy-prod.yml → 実行されない (mainのみトリガー)

mainブランチに git push
  │
  ├─ deploy-prod.yml 実行
  │    ├─ GCP本番アカウントで認証 (GCP_SA_KEY)
  │    ├─ Dockerイメージビルド → 本番Artifact Registryにプッシュ
  │    ├─ 本番Cloud Run (money-manager) デプロイ
  │    └─ Vercel本番URLにフロントエンドデプロイ
  │
  └─ deploy-dev.yml → 実行されない (developのみトリガー)
```

---

## 5. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| GitHub Actions | push・PRなどのイベントに反応して自動実行されるCI/CDツール |
| ワークフロー | `.github/workflows/*.yml` で定義する自動化作業の単位 |
| `on.push.branches` | どのブランチへのpush時にワークフローを実行するか指定するトリガー |
| `secrets.名前` | GitHub Secretsに保存された機密値を参照する構文（コードに露出しない） |
| `github.sha` | 現在のコミットの固有ハッシュ値。イメージタグに使うとデプロイの追跡が可能 |
| `NEXT_PUBLIC_API_URL` | フロントエンドビルド時にバックエンドURLを注入する環境変数 |
