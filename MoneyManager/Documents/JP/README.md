# MoneyManager ドキュメント

TypeScript + GCP ベースの家計簿プロジェクト全体ドキュメントです。

## バックエンドドキュメント (Express + Cloud Run)

| ファイル | 内容 |
|------|------|
| [01-architecture.md](./01-architecture.md) | システム全体構成、技術スタック、APIリスト |
| [02-local-development.md](./02-local-development.md) | ローカル開発環境の構成、ファイル構造、主要コード説明 |
| [03-docker.md](./03-docker.md) | Dockerの概念、Dockerfileの説明、マルチステージビルド |
| [04-gcp-infrastructure.md](./04-gcp-infrastructure.md) | Firestore、Artifact Registryの構成、GCP無料枠 |
| [05-cloud-run-deployment.md](./05-cloud-run-deployment.md) | Cloud Runデプロイ方法、コスト管理、サーバーレスの概念 |
| [06-iam-security.md](./06-iam-security.md) | IAM権限、サービスアカウント、セキュリティ設定 |
| [07-github-actions.md](./07-github-actions.md) | 自動デプロイCI/CD、ワークフローファイルの説明 |
| [08-development-workflow.md](./08-development-workflow.md) | 日常的な開発フロー、API使用例、便利なコマンド |

## フロントエンドドキュメント (Next.js)

| ファイル | 内容 |
|------|------|
| [09-phase6-frontend-setup.md](./09-phase6-frontend-setup.md) | アーキテクチャの決定（役割分離）、Next.js初期設定、APIクライアント、CORS |
| [10-phase7-pin-auth.md](./10-phase7-pin-auth.md) | PIN認証画面、AppShellセッション管理、sessionStorage、'use client'の概念 |
| [11-phase8-layout-navigation.md](./11-phase8-layout-navigation.md) | 共通レイアウト、下部タブバー、年月セレクター、State Lifting、Propsの概念 |
| [12-vercel-deployment.md](./12-vercel-deployment.md) | Vercelの概念、デプロイ過程、CORS設定、CDN、自動デプロイフロー |
| [13-phase9-transaction-form.md](./13-phase9-transaction-form.md) | FABボタン、ボトムシート入力フォーム、収入/支出トグル、Firestoreへの保存フロー |
| [14-cicd-vercel-github-actions.md](./14-cicd-vercel-github-actions.md) | Vercel自動デプロイの問題原因、トークン発行、GitHub ActionsにVercel jobを追加 |
| [15-debug-env-var-empty.md](./15-debug-env-var-empty.md) | トラブルシューティング：本番PIN認証失敗 — 暗号化環境変数が空になる問題、curl分析、?? vs \|\| |

## クイックリファレンス

**バックエンドサービスURL**
```
https://money-manager-1094294666571.asia-northeast3.run.app
```

**バックエンドローカル実行**
```bash
# MoneyManager/ フォルダで
gcloud auth application-default login
npm run dev
```

**フロントエンドローカル実行**
```bash
# MoneyManager/frontend/ フォルダで
npm run dev
# → http://localhost:3000
```

**デプロイ方法**
```bash
git add .
git commit -m "変更内容"
git push origin main
# → GitHub Actionsが自動的にデプロイ
```
