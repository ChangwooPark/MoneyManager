# CI/CD: GitHub ActionsにVercel自動デプロイを追加

## 発生した問題

Phase 9の作業後に`git push`をしても、Vercelフロントエンドには変更が反映されませんでした。

**原因分析：**

Vercelダッシュボードでデプロイソースを見ると`>_ vercel deploy`と表示されていました。
これは以前に手動で`vercel --prod --yes` CLIコマンドを実行してデプロイしたことを意味します。

```
誤ったフロー（既存）：
  git push
    ↓
  GitHub Actions → Cloud Runデプロイのみ実行
  Vercel → 自動デプロイなし（連携されていない）

正しいフロー（修正後）：
  git push
    ↓
  GitHub Actions → Cloud Runデプロイ（バックエンド）
                → Vercelデプロイ（フロントエンド）← 新規追加
```

既存のワークフロー（`.github/workflows/deploy.yml`）はCloud Runデプロイのみを担当しており、
VercelのGitHub自動デプロイは連携されていない状態でした。

---

## 解決方法

GitHub Actionsワークフローに Vercelデプロイのジョブを追加しました。

---

## Vercelトークンの発行

GitHub ActionsがVercelにデプロイするためには**認証トークン**が必要です。

### トークンとは？

パスワードの代わりに使用する認証キーです。
GitHub ActionsサーバーがVercelに「私はChangwooParkです」と証明する際に使用します。

### 発行方法

1. `https://vercel.com/account/tokens` にアクセス
2. TOKEN NAME：`github-actions`
3. SCOPE：`Full Account`（デプロイ・ビルド・環境変数参照など全ての権限が必要）
4. EXPIRATION：No Expiration（CI/CDトークンは有効期限なしで設定 — 期限切れになると自動デプロイが突然失敗する）
5. **Create** クリック → トークン値が画面に表示される（この瞬間のみ表示、後から見ることはできない）

> **注意：** トークンは生成直後に一度だけ表示されます。
> ウィンドウを閉じる前に必ずコピーしてください。
> 紛失した場合は、そのトークンをRevoke（削除）して新たに発行してください。

### GitHub Secretに登録

発行したトークンをGitHubリポジトリのシークレットに保存します。

1. `https://github.com/ChangwooPark/MoneyManager/settings/secrets/actions` にアクセス
2. 「New repository secret」クリック
3. Name：`VERCEL_TOKEN`
4. Value：コピーしたトークン値
5. 「Add secret」クリック

GitHub Secretは暗号化して保存され、Actionsワークフローからのみ`${{ secrets.VERCEL_TOKEN }}`の形式で参照できます。保存後は値を再度確認することはできません。

---

## ワークフローファイルの修正

`.github/workflows/deploy.yml`を修正して2つのジョブに分割しました。

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  # バックエンド: Cloud Runデプロイ（既存と同様）
  deploy-backend:
    name: Deploy Backend to Cloud Run
    runs-on: ubuntu-latest
    steps:
      - ...

  # フロントエンド: Vercelデプロイ（新規追加）
  deploy-frontend:
    name: Deploy Frontend to Vercel
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel project settings
        working-directory: MoneyManager/frontend
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
          VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g

      - name: Build project
        working-directory: MoneyManager/frontend
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
          VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g

      - name: Deploy to Vercel Production
        working-directory: MoneyManager/frontend
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: team_C6F9p19SH8pOyJxy7x8OtS82
          VERCEL_PROJECT_ID: prj_5TOJOfymglx2pWt2aQXTDc0B909g
```

---

## Vercelデプロイの3ステップ説明

Vercel CLIでCI/CD環境からデプロイする際は3ステップに分けて実行します。

### ステップ1：`vercel pull`

```bash
vercel pull --yes --environment=production --token=...
```

VercelプロジェクトのSettingsファイルと環境変数をGitHub Actionsサーバーに取得します。
`NEXT_PUBLIC_API_URL`などの環境変数がこのステップでローカルに保存されます。

### ステップ2：`vercel build`

```bash
vercel build --prod --token=...
```

`next build`を実行して本番用ビルド結果物（`.vercel/output/`）を生成します。
Vercelの最適化設定（画像最適化、キャッシュ設定など）が自動適用されます。

### ステップ3：`vercel deploy --prebuilt`

```bash
vercel deploy --prebuilt --prod --token=...
```

ステップ2でビルドされた結果物をVercel CDNにアップロードしてProductionにデプロイします。
`--prebuilt`：ビルドをVercelサーバーで再実行せず、既にビルドされたファイルをそのまま使用します。

---

## VERCEL_ORG_ID / VERCEL_PROJECT_ID

ワークフローにハードコードされた2つの値は`MoneyManager/frontend/.vercel/project.json`ファイルで確認した値です。

```json
{
  "projectId": "prj_5TOJOfymglx2pWt2aQXTDc0B909g",
  "orgId": "team_C6F9p19SH8pOyJxy7x8OtS82",
  "projectName": "frontend"
}
```

これらの値は、どのVercelプロジェクトにデプロイするかを指定します。
パスワードではなく識別子なので、ワークフローに直接記載しても問題ありません。

---

## 修正後のデプロイフロー

```
ローカルでコード修正
  ↓
git add . && git commit -m "..."
  ↓
git push origin main
  ↓
GitHub Actionsトリガー（2つのジョブが並列実行）
  ├─ Deploy Backend to Cloud Run  （約3〜5分）
  │    Dockerビルド → Artifact Registryプッシュ → Cloud Runデプロイ
  │
  └─ Deploy Frontend to Vercel    （約1〜2分）
       vercel pull → vercel build → vercel deploy
  ↓
https://frontend-dusky-tau-46.vercel.app に最新コードが反映
https://money-manager-1094294666571.asia-northeast3.run.app に最新APIが反映
```

2つのジョブは**並列**で実行されるため、全体のデプロイ時間は長い方（Cloud Run、約3〜5分）に合わせられます。

---

## デプロイ確認方法

GitHub Actionsの進行状況：
`https://github.com/ChangwooPark/MoneyManager/actions`

両方のジョブが ✅ 緑のチェックマークになればデプロイ完了です。

| ジョブ | 確認URL |
|-----|---------|
| フロントエンド | `https://frontend-dusky-tau-46.vercel.app` |
| バックエンド | `https://money-manager-1094294666571.asia-northeast3.run.app/health` |
