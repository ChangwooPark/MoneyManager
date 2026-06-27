# Phase 5: IAMセキュリティ設定

## IAMとは？

IAM（Identity and Access Management）はGCPにおいて**「誰が何をできるか」**を管理するシステムです。

```
IAM = 入退室管理システム
  - 誰が: 人またはサービスアカウント
  - 何を: 特定のGCPサービス（Firestore、Cloud Runなど）
  - どのように: 読み取り、書き込み、削除など
```

## サービスアカウントとは？

人がGoogleアカウントでGCPにログインするように、**アプリケーション（コンテナ）もGCP内で自身を証明するアカウント**が必要です。これがサービスアカウントです。

```
人             →  Googleアカウント (pcwjapan@gmail.com)
Cloud Runアプリ →  サービスアカウント (1094294666571-compute@developer.gserviceaccount.com)
```

Cloud Runはデプロイ時に**デフォルトのComputeサービスアカウント**を自動的に割り当てます。

## なぜ権限設定が必要だったか？

Cloud RunコンテナがFirestoreにアクセスするためには、明示的に許可する必要があります。

```
権限設定前：
  Cloud Run → Firestoreへのアクセス試行
  GCP IAM: 「このサービスアカウントはFirestoreの権限なし」→ 403エラー

権限設定後：
  Cloud Run → Firestoreへのアクセス試行
  GCP IAM: 「roles/datastore.userロールあり」→ 正常動作
```

## 実行したコマンド

```bash
gcloud projects add-iam-policy-binding money-manager-499703 \
  --member="serviceAccount:1094294666571-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

| パラメータ | 意味 |
|---------|------|
| `money-manager-499703` | 権限を付与するGCPプロジェクト |
| `--member` | 権限を受け取る対象（Cloud RunのサービスアカウントID） |
| `--role="roles/datastore.user"` | 付与するロール |

## roles/datastore.userとは？

Firestoreは内部的にGoogle Cloud Datastoreの技術基盤を使用しているため、権限名が`datastore.user`になっています。

| 操作 | 許可状況 |
|------|----------|
| ドキュメント読み取り | 許可 |
| ドキュメント書き込み | 許可 |
| ドキュメント更新 | 許可 |
| ドキュメント削除 | 許可 |
| DB構造変更 | 不可（ownerのみ可能） |

## 全体リクエストフロー

```
ユーザーHTTPリクエスト
  ↓
Cloud Runコンテナ
  （サービスアカウント所持）
  ↓
GCP IAM検証
  （roles/datastore.userロール確認）
  ↓
Firestore
  ↓
データ返却
  ↓
HTTPレスポンス
```

一言で言えば：**Cloud RunサーバーがFirestoreにアクセスできる入場証を発行した作業**です。

## GitHub Actions用サービスアカウント

自動デプロイのために別途サービスアカウントも作成しました。

```bash
# GitHub Actions専用サービスアカウントの作成
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions" \
  --project=money-manager-499703

# 必要な権限の付与
roles/run.admin              # Cloud Runデプロイ権限
roles/storage.admin          # Cloud Buildソースアップロード権限
roles/artifactregistry.writer # Dockerイメージプッシュ権限
roles/iam.serviceAccountUser # サービスアカウント使用権限
```

このサービスアカウントのキーをGitHub Secretsに登録して、GitHub ActionsがGCPにアクセスできるようにしました。
