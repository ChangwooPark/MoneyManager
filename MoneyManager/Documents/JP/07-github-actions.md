# GitHub Actions 自動デプロイ（CI/CD）

## CI/CDとは？

| 用語 | 意味 |
|------|------|
| CI (Continuous Integration) | コードをpushするたびに自動でビルド/テスト |
| CD (Continuous Deployment) | ビルド成功時に自動でデプロイ |

このプロジェクトはmainブランチにpushすると自動的にCloud Runにデプロイされます。

## 自動デプロイの全体フロー

```
git push（mainブランチ）
  ↓
GitHubがpushイベントを検知
  ↓
.github/workflows/deploy.yml を実行
  ↓
  1. コードチェックアウト
  2. GCP認証
  3. Cloud SDK設定
  4. Docker認証
  5. DockerイメージビルドおよびArtifact Registryプッシュ
  6. Cloud Run再デプロイ
  ↓
サービスURLに新バージョンが反映（約1〜2分）
```

## ワークフローファイルの説明

`.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main          # mainブランチにpushされた時のみ実行
```

**on.push.branches: [main]** の意味：
他のブランチ（feature/xxx、developなど）にpushしてもデプロイが実行されません。
実験的な作業は別ブランチで安全に行うことができます。

```yaml
    steps:
      - name: Build and push image
        run: |
          IMAGE=asia-northeast3-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/money-manager/account-book:${{ github.sha }}
          docker build -t $IMAGE MoneyManager/
          docker push $IMAGE
```

**`${{ github.sha }}`** とは？
各コミットの固有ハッシュ値（例：`bcbd826...`）でイメージタグを付けます。
これによりデプロイ履歴を追跡し、問題が発生した際に以前のバージョンへロールバックできます。

## GitHub Secrets

GitHub ActionsがGCPにアクセスするには認証情報が必要です。
コードに直接キーを書くとセキュリティリスクがあるため、**GitHub Secrets**に暗号化して保存します。

| Secret名 | 内容 |
|------------|------|
| `GCP_SA_KEY` | GitHub Actions用サービスアカウントのJSONキー |
| `GCP_PROJECT_ID` | GCPプロジェクトID（`money-manager-499703`） |

ワークフロー内で`${{ secrets.GCP_SA_KEY }}`の形式で参照します。

**Secretsの確認場所：**
GitHub リポジトリ → Settings → Secrets and variables → Actions

## デプロイ結果の確認

```
GitHub リポジトリ → Actions タブ
```

各pushごとにワークフローの実行結果を確認できます。
- 緑のチェックマーク：デプロイ成功
- 赤いX：デプロイ失敗（ログから原因を確認可能）

## ブランチ戦略（推奨）

```bash
# 新機能開発時
git checkout -b feature/カテゴリー追加
# ... 開発 ...
git push origin feature/カテゴリー追加
# → デプロイされない（安全）

# 開発完了後にデプロイ
git checkout main
git merge feature/カテゴリー追加
git push origin main
# → 自動デプロイ実行
```

こうすることで、未完成のコードが誤ってデプロイされることを防ぐことができます。
