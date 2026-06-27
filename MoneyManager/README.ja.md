# MoneyManager — 日本生活費管理サービス

> **[한국어](./README.md)** · **[English](./README.en.md)**

Claude AIを開発パートナーとして活用し、企画から本番運用まで一人で設計・デプロイしたフルスタック家計簿Webサービスです。

---

## 主な機能

| 機能 | 説明 |
|------|------|
| 🔐 PIN認証 | 4桁PINによるアクセス制御 — 権限を持つユーザー間でデータ共有可能 |
| 📝 取引入力 | 収入・支出の登録 / 編集 / 削除、カテゴリ・メモ対応 |
| 🏠 ホームタブ | 月別取引一覧を日付ごとにグループ表示、日別小計・純収益を表示 |
| 📅 カレンダータブ | 月間カレンダーに収入・支出を可視化、日付タップで詳細表示 |
| 📊 統計タブ | カテゴリ別支出・収入の内訳、予算対比の進捗バー |
| ⚙️ その他タブ | PIN変更、月次予算設定、カテゴリ管理、LINE通知設定 |
| 🔔 LINE通知 | 取引登録時にLINE Messaging APIで共同受信者へリアルタイム通知（Multicast対応、WebhookでパートナーのUser IDを自動登録） |
| 🗑️ データ初期化 | PIN再認証後に全取引履歴を削除（2段階確認で誤操作防止） |

---

## 技術スタック

**フロントエンド**
- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Vercelデプロイ

**バックエンド**
- Node.js · Express · TypeScript
- Google Cloud Run デプロイ（ソウルリージョン）

**データベース・インフラ**
- Google Cloud Firestore (Native Mode)
- Artifact Registry · Secret Manager · IAM

**開発ツール**
- Playwright（E2Eテスト 454件）
- GitHub Actions（CI/CD 自動デプロイ）

---

## システム構成

```
ブラウザ / モバイル
     │
     ▼
Next.js フロントエンド (Vercel)
     │  REST API
     ▼
Express バックエンド (Cloud Run)
     │
     ▼
Firestore          LINE Messaging API
```

---

## ローカル実行

```bash
# バックエンド（MoneyManager/ ルート）
gcloud auth application-default login
npm install
npm run dev          # → http://localhost:8080

# フロントエンド（MoneyManager/frontend/）
npm install
npm run dev          # → http://localhost:3000
```

---

## デプロイ

`main`ブランチへのプッシュでGitHub Actionsが自動ビルド・デプロイを実行します。

```
git push origin main
→ バックエンド: Dockerビルド → Artifact Registry → Cloud Run デプロイ
→ フロントエンド: Vercel 自動デプロイ
```

---

## LINE通知の設定

取引を保存すると、本人とパートナーの両方にLINE通知が同時に届きます。

パートナー追加を含む詳細な設定手順は以下のドキュメントを参照してください。

→ [Documents/JP/27-line-partner-setup.md](./Documents/JP/27-line-partner-setup.md)
