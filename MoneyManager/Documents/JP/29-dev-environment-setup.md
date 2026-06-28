# Phase Dev-1/Dev-2 — 開発環境構築 学習ドキュメント

## 概要

本番(Production)と完全に分離した開発(Development)環境をGCPに構築した過程を説明します。

**目標**: 新機能を開発サーバーで検証してから本番へ昇格する、安全なワークフローの確立

---

## 1. なぜ開発環境を分離するのか

### 現状（分離前）の問題点

```
機能開発コード
  → main ブランチへpush
  → そのまま本番デプロイ
  → 実データに影響が出る可能性
```

### 分離後の目標フロー

```
機能開発
  → develop ブランチへpush
  → 開発サーバー(dev)に自動デプロイ
  → 開発DBでテスト・動作確認
  → 問題なければ main ブランチへPR
  → 本番(prod)に自動デプロイ
```

---

## 2. 環境構成の比較

| 項目 | 本番(Production) | 開発(Development) |
|------|------|------|
| GitHub ブランチ | `main` | `develop` |
| GCP プロジェクト | `money-manager-499703` | `money-manager-dev-001` |
| Firestore DB | 本番データ | 開発/テストデータ（完全分離） |
| Cloud Run | `money-manager` | `money-manager-dev` |
| Artifact Registry | `money-manager` | `money-manager-dev` |
| バックエンドURL | `money-manager-1094294666571.asia-northeast3.run.app` | `money-manager-dev-576447610294.asia-northeast3.run.app` |

### 別GCPプロジェクトを作成する理由

GCPの無料枠（Firestoreの読み書きクォータ、Cloud Runのリクエスト数、Artifact Registryのストレージ容量）は**プロジェクト単位**で適用されます。

同じプロジェクト内に2つ目のFirestoreデータベースを作ると有料になりますが、別のGCPプロジェクトを新規作成すれば、それぞれが独立した無料枠を受け取るため、**追加費用なしで完全な環境分離**が可能です。

---

## 3. GCP開発プロジェクト作成手順

### 3-1. プロジェクト作成

```bash
# 新しいGCPプロジェクト作成（全世界で一意なIDが必要）
gcloud projects create money-manager-dev-001 --name="MoneyManager Dev"
```

### 3-2. 請求アカウントの紐付け

Cloud Run・Artifact Registryを使用するには請求アカウントの紐付けが必要です。
無料枠内で運用すれば実際の請求は発生しません。

```bash
# 請求アカウントID確認
gcloud billing accounts list

# プロジェクトに紐付け
gcloud billing projects link money-manager-dev-001 \
  --billing-account=<ACCOUNT_ID>
```

### 3-3. 必要なAPIの有効化

```bash
gcloud services enable \
  run.googleapis.com \              # Cloud Run（バックエンド実行）
  firestore.googleapis.com \        # Firestore（データベース）
  artifactregistry.googleapis.com \ # Dockerイメージリポジトリ
  secretmanager.googleapis.com \    # シークレット（トークン・キー）管理
  --project=money-manager-dev-001
```

---

## 4. Firestore開発データベースの作成

```bash
gcloud firestore databases create \
  --location=asia-northeast3 \   # ソウルリージョン
  --project=money-manager-dev-001
```

作成結果に `freeTier: true` が表示されていれば無料枠が適用されています。

---

## 5. Artifact Registry開発リポジトリの作成

```bash
gcloud artifacts repositories create money-manager-dev \
  --repository-format=docker \
  --location=asia-northeast3 \
  --project=money-manager-dev-001
```

Dockerイメージを保存する場所です。本番用（`money-manager`）とは別に、開発用リポジトリを運用します。

---

## 6. GitHub Actions用Service Account構成

### 6-1. Service Accountとは

人間ではなく**プログラム（GitHub Actions）**がGCPリソースにアクセスする際に使用するアカウントです。
「この自動化処理はどこまでできるか」をロール（Role）で制限します。

### 6-2. SA作成とロール付与

```bash
# SA作成
gcloud iam service-accounts create github-actions-dev \
  --display-name="GitHub Actions Dev" \
  --project=money-manager-dev-001

# 必要なロール4つを付与（本番SAと同じ）
# roles/run.admin                   → Cloud Runサービスのデプロイ権限
# roles/artifactregistry.writer     → イメージのpush権限
# roles/iam.serviceAccountUser      → SAをCloud Runに割り当てる権限
# roles/secretmanager.secretAccessor → シークレットの読み取り権限
```

### 6-3. SAキー発行とGitHub Secretsへの登録

```bash
# JSONキーファイルを発行
gcloud iam service-accounts keys create /tmp/gcp-dev-sa-key.json \
  --iam-account=github-actions-dev@money-manager-dev-001.iam.gserviceaccount.com

# GitHub Secretsに登録
gh secret set GCP_DEV_SA_KEY < /tmp/gcp-dev-sa-key.json
gh secret set GCP_DEV_PROJECT_ID --body="money-manager-dev-001"

# ローカルのキーファイルを即削除（セキュリティ）
rm /tmp/gcp-dev-sa-key.json
```

---

## 7. Secret Manager構成

開発環境にも本番と**同じ名前**のシークレットを作成します。
値は開発用として再発行したトークンに置き換える必要があります。

```bash
for secret in LINE_CHANNEL_ACCESS_TOKEN LINE_USER_ID LINE_CHANNEL_SECRET; do
  echo -n "placeholder-dev" | gcloud secrets create "$secret" \
    --data-file=- \
    --project=money-manager-dev-001
done
```

> **注意**: プレースホルダーの状態ではLINE通知機能は動作しません。
> 開発用LINEチャンネルのトークンを発行後、以下のコマンドで置き換えてください。
>
> ```bash
> echo -n "実際のトークン値" | gcloud secrets versions add LINE_CHANNEL_ACCESS_TOKEN \
>   --data-file=- \
>   --project=money-manager-dev-001
> ```

---

## 8. Cloud Run開発サービスのデプロイ

### 8-1. イメージビルド時の注意 — linux/amd64

Mac（M1/M2/M3）はARMアーキテクチャですが、Cloud Runは**linux/amd64（Intel）**イメージのみサポートします。
`--platform=linux/amd64` フラグを必ず指定してください。

```bash
# 誤った方法（MacでそのままビルドするとARMイメージが生成される）
docker build -t <イメージパス> .  # ❌ Cloud Runで実行不可

# 正しい方法（プラットフォームを明示）
docker buildx build \
  --platform=linux/amd64 \
  --push \
  -t <イメージパス> .              # ✅
```

### 8-2. Cloud Runデプロイ

```bash
gcloud run deploy money-manager-dev \
  --image=asia-northeast3-docker.pkg.dev/money-manager-dev-001/money-manager-dev/account-book:latest \
  --region=asia-northeast3 \
  --project=money-manager-dev-001 \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=512Mi \
  --max-instances=1 \   # コスト管理 — インスタンス最大1台
  --timeout=300 \
  --cpu-boost \         # コールドスタートの高速化
  --set-env-vars="GCP_PROJECT_ID=money-manager-dev-001" \
  --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest,..."
```

### 8-3. Compute SAへの権限追加

Cloud RunコンテナがSecret Managerからシークレットを読み取るには、
**Cloud Runのデフォルト実行アカウント**（Compute Service Account）にも読み取り権限が必要です。

```bash
# デフォルトCompute SAの形式: {プロジェクト番号}-compute@developer.gserviceaccount.com
gcloud projects add-iam-policy-binding money-manager-dev-001 \
  --member="serviceAccount:576447610294-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

> この権限がないままデプロイすると `Permission denied on secret` エラーが発生します。

---

## 9. ヘルスチェック確認

```bash
curl https://money-manager-dev-576447610294.asia-northeast3.run.app/health
# → {"status":"ok"}
```

---

## 10. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| GCPプロジェクト | GCPリソース（Cloud Run、Firestoreなど）の分離単位。プロジェクトごとに無料枠が適用される |
| Service Account | 人間ではなくプログラム（GitHub Actions、Cloud Run）がGCPに認証する際に使うアカウント |
| IAMロール | SAが実行できる操作の範囲を定義。`roles/run.admin` = Cloud Runのデプロイが可能 |
| Secret Manager | APIキー・トークンなどの機密情報をコード外（GCP）で安全に保管するサービス |
| Artifact Registry | Dockerイメージを保存・管理するGCPのプライベートコンテナリポジトリ |
| `linux/amd64` | Cloud Runがサポートするアーキテクチャ。Mac（ARM）でビルドする際は必ず明示が必要 |
