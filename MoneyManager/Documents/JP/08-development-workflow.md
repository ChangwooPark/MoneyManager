# 開発ワークフロー

## 日常的な開発サイクル

```
1. ローカルでコード修正
2. ローカルサーバーで動作確認
3. git commit & push
4. GitHub Actionsが自動デプロイ
5. サービスURLで最終確認
```

---

## ローカル開発環境の準備（初回のみ）

### バックエンド依存関係のインストール

```bash
# MoneyManager/ フォルダで
npm install
```

### フロントエンド依存関係のインストール

```bash
# MoneyManager/frontend/ フォルダで
npm install
```

### GCPローカル認証

バックエンドがローカルでFirestoreにアクセスするには、GCP認証が必要です。
**初回のみ実行すれば大丈夫です。**

```bash
gcloud auth application-default login
# → ブラウザが開き、Googleアカウントでログイン
```

---

## ローカルサーバーの起動

フロントエンドとバックエンドは**それぞれ別のターミナル**で起動する必要があります。

### ターミナル1 — バックエンド（Express）

```bash
# MoneyManager/ フォルダで
npm run dev
# → http://localhost:8080 で実行
```

### ターミナル2 — フロントエンド（Next.js）

```bash
# MoneyManager/frontend/ フォルダで
npm run dev
# → http://localhost:3000 で実行
```

ブラウザで`http://localhost:3000`にアクセスするとPIN画面が表示されます。

---

## ローカルサーバーの停止

各ターミナルで以下のショートカットキーを押します：

```
Ctrl + C
```

| ターミナル | 停止方法 |
|--------|---------|
| バックエンドターミナル | `Ctrl + C` |
| フロントエンドターミナル | `Ctrl + C` |

### 停止確認方法

```bash
# 8080ポート（バックエンド）が空いているか確認
lsof -i :8080

# 3000ポート（フロントエンド）が空いているか確認
lsof -i :3000
# → 何も表示されなければ正常終了
```

### ポートが占有されたまま残っている場合

`Ctrl+C`が効かなかった場合は以下のコマンドで強制終了します：

```bash
# 8080ポートを強制終了
lsof -ti :8080 | xargs kill -9

# 3000ポートを強制終了
lsof -ti :3000 | xargs kill -9
```

---

## ローカル接続構成

```
ブラウザ（http://localhost:3000）
  ↓ APIリクエスト
Next.jsフロントエンド（localhost:3000）
  ↓ HTTP fetch
Expressバックエンド（localhost:8080）
  ↓ SDKアクセス
Firestore（実際のGCP — asia-northeast3）
```

ローカルでも実際のGCP Firestoreに接続されます。
ローカルでデータを変更すると実際のDBに反映されます。

---

## 新機能開発の例

### 例：月別合計APIの追加

**1. ブランチ作成**
```bash
git checkout -b feature/monthly-summary
```

**2. コード修正**
`src/routes/transactions.ts`または`src/services/firestore.ts`を修正

**3. ローカル確認**
```bash
# バックエンド起動後
curl http://localhost:8080/transactions?yearMonth=2026-06
```

**4. コミット＆プッシュ**
```bash
git add .
git commit -m "Add monthly summary API"
git push origin feature/monthly-summary
# → この時点ではデプロイされない
```

**5. mainにマージ → 自動デプロイ**
```bash
git checkout main
git merge feature/monthly-summary
git push origin main
# → GitHub Actions自動実行 → Cloud Runデプロイ
```

---

## API使用例（デプロイ済みサーバー）

### 取引履歴作成

```bash
curl -X POST https://money-manager-1094294666571.asia-northeast3.run.app/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount": 12000,
    "category": "食費",
    "description": "夕食",
    "date": "2026-06-17"
  }'
```

### 特定月の履歴取得

```bash
curl https://money-manager-1094294666571.asia-northeast3.run.app/transactions?yearMonth=2026-06
```

### 履歴の更新

```bash
curl -X PUT https://money-manager-1094294666571.asia-northeast3.run.app/transactions/{id} \
  -H "Content-Type: application/json" \
  -d '{"amount": 15000}'
```

### 履歴の削除

```bash
curl -X DELETE https://money-manager-1094294666571.asia-northeast3.run.app/transactions/{id}
```

### PIN検証

```bash
curl -X POST https://money-manager-1094294666571.asia-northeast3.run.app/settings/pin/verify \
  -H "Content-Type: application/json" \
  -d '{"pin": "8907"}'
```

### 予算設定

```bash
curl -X PUT https://money-manager-1094294666571.asia-northeast3.run.app/budgets/2026-06 \
  -H "Content-Type: application/json" \
  -d '{"amount": 200000}'
```

---

## 便利なコマンド集

```bash
# GitHub Actions実行リストの確認
gh run list --repo ChangwooPark/MoneyManager

# Cloud Runサービス状態確認
gcloud run services describe money-manager \
  --region=asia-northeast3 \
  --project=money-manager-499703

# Cloud Runログの確認
gcloud logging read "resource.type=cloud_run_revision" \
  --project=money-manager-499703 \
  --limit=50

# Artifact Registryイメージリスト
gcloud artifacts docker images list \
  asia-northeast3-docker.pkg.dev/money-manager-499703/money-manager
```

---

## 問題発生時の確認手順

```
1. PINエラーが出るとき
   → バックエンドサーバーが実行中か確認（localhost:8080）
   → ターミナル1でnpm run devが実行されているか確認

2. 画面が表示されないとき
   → フロントエンドサーバーが実行中か確認（localhost:3000）
   → ターミナル2でnpm run devが実行されているか確認

3. GitHub Actionsデプロイ失敗時
   → GitHub リポジトリ → Actions タブでログを確認

4. デプロイ済みサーバーエラー時
   → Cloud Runログを確認
   → /health エンドポイントのレスポンスを確認
```
