# Phase 4: Cloud Runデプロイ

## Cloud Runとは？

コンテナ（Dockerイメージ）をサーバーレスで実行するGCPサービスです。

**サーバーレスの意味：**
- サーバーを直接管理する必要がない
- リクエストがないときはインスタンスが0に縮小されコストなし
- リクエストが来ると自動的にインスタンスを生成して応答

## デプロイ過程

### Step 1 - Docker認証設定

ローカルのDockerがGCP Artifact Registryにイメージをプッシュできるよう認証します。

```bash
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

### Step 2 - Cloud Buildでイメージビルド＆プッシュ

```bash
gcloud builds submit \
  --tag asia-northeast3-docker.pkg.dev/money-manager-499703/money-manager/account-book:v1
```

**ローカルビルドとの違い：**

| 項目 | ローカルビルド | Cloud Build |
|------|----------|-------------|
| ビルド場所 | 自分のPC | GCPサーバー |
| 速度 | インターネットアップロードが必要 | GCP内部ネットワーク |
| 自動プッシュ | 別途コマンドが必要 | ビルド後自動プッシュ |

### Step 3 - Cloud Runデプロイ

```bash
gcloud run deploy money-manager \
  --image=asia-northeast3-docker.pkg.dev/money-manager-499703/money-manager/account-book:v1 \
  --region=asia-northeast3 \
  --platform=managed \
  --allow-unauthenticated \
  --max-instances=1 \
  --port=8080 \
  --project=money-manager-499703
```

**主要オプションの説明：**

| オプション | 値 | 意味 |
|------|------|------|
| `--platform=managed` | managed | GCPがインフラ全体を管理 |
| `--allow-unauthenticated` | - | 認証なしで誰でもアクセス可能 |
| `--max-instances=1` | 1 | 最大インスタンス数を1に制限 |
| `--port=8080` | 8080 | コンテナがリッスンするポート |

## max-instances=1が重要な理由

Cloud Runはトラフィックが増えると自動的にインスタンスを増やします（オートスケーリング）。
インスタンスが増えるほどコストも増加します。

```
max-instances=1 設定なし：
  トラフィック急増 → インスタンス10台 → 予期しないコスト発生

max-instances=1 設定後：
  トラフィック急増 → インスタンス最大1台 → コスト予測可能
```

個人プロジェクトなので1台で十分であり、コスト管理に必須です。

## 無料枠

| 項目 | 無料上限（月） |
|------|--------------|
| リクエスト数 | 200万件 |
| CPU | 180,000 vCPU秒 |
| メモリ | 360,000 GB秒 |

個人の家計簿レベルでは無料上限を超えることは難しいです。

## デプロイ後の確認

```bash
# ヘルスチェック
curl https://money-manager-1094294666571.asia-northeast3.run.app/health
# → {"status":"ok"}

# 取引履歴作成テスト
curl -X POST https://money-manager-1094294666571.asia-northeast3.run.app/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":5000,"category":"食費","description":"昼食","date":"2026-06-17"}'
```
