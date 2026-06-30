# MoneyManager — 日本生活費管理サービス

> **[한국어](./README.md)** · **[English](./README.en.md)**

Claude AIを開発パートナーとして活用し、企画から本番運用まで一人で設計・デプロイしたフルスタック家計簿Webサービスです。

---

## 主な機能

| 機能 | 説明 |
|------|------|
| 🔐 PIN認証 | 4桁PINによるアクセス制御 — 権限を持つユーザー間でデータ共有可能 |
| 📝 取引入力 | 収入・支出の登録 / 編集 / 削除、カテゴリ・メモ対応 |
| 🏠 ホームタブ | 月別取引一覧を日付ごとにグループ表示、日別小計・純収益、取引タップで詳細/編集/削除 |
| 📅 カレンダータブ | 月間カレンダーに収入・支出を可視化、日付タップで詳細内訳、取引の編集/削除対応 |
| 📊 統計タブ | カテゴリ別支出・収入の内訳、予算対比の進捗バー、取引タップで詳細/編集/削除 |
| ⚙️ その他タブ | PIN変更、月次予算設定、カテゴリ管理、言語設定、LINE通知設定 |
| 🌐 多言語対応 | 韓国語 ↔ 日本語の即時切り替え、Firestoreに言語設定を保存（再接続時も維持） |
| 🔔 LINE通知 | 取引登録時にLINE Messaging APIで共同受信者へリアルタイム通知（Multicast対応、WebhookでパートナーのUser IDを自動登録） |
| 🗑️ データ初期化 | PIN再認証後に全取引履歴を削除（2段階確認で誤操作防止） |

---

## 技術スタック

**フロントエンド**
- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Vercelデプロイ

**バックエンド**
- Node.js · Express · TypeScript
- Google Cloud Runデプロイ（ソウルリージョン）

**データベース・インフラ**
- Google Cloud Firestore (Native Mode)
- Artifact Registry · Secret Manager · IAM

**開発ツール**
- Playwright（E2Eテスト）
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

## 開発環境構成

本番（Production）と開発（Development）の環境が完全に分離されています。

| 項目 | 本番 | 開発 |
|------|------|------|
| GitHubブランチ | `main` | `develop` |
| GCPプロジェクト | `money-manager-499703` | `money-manager-dev-001` |
| Cloud Run | `money-manager` | `money-manager-dev` |
| Firestore | 本番DB | 開発DB（完全分離） |
| フロントエンドURL | `frontend-changwoo-park.vercel.app` | `frontend-dev-changwoo-park.vercel.app` |

```
developブランチへpush → GitHub Actions → 開発サーバー自動デプロイ → 確認
develop → main PRを作成してマージ → GitHub Actions → 本番サーバー自動デプロイ
```

> **`main`ブランチ保護ルール**: 直接pushは不可。`develop`ブランチからPRを通じてのみ反映されます。

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

開発確認後、PRを通じて本番に反映するフローで運用します。

```
# 1. 開発環境へデプロイして確認
git push origin develop
→ バックエンド: Dockerビルド → Artifact Registry(dev) → Cloud Run(money-manager-dev)
→ フロントエンド: Vercel開発固定URL (frontend-dev-changwoo-park.vercel.app)

# 2. 開発サーバーで確認後、本番へ反映
gh pr create --base main --head develop  # PR作成
gh pr merge <PR番号> --merge             # PRマージ → 本番自動デプロイ
→ バックエンド: Dockerビルド → Artifact Registry → Cloud Run(money-manager)
→ フロントエンド: Vercel本番URL (frontend-changwoo-park.vercel.app)
```

---

## LINE通知の設定

取引を保存すると、本人とパートナーの両方にLINE通知が同時に届きます。

パートナー追加を含む詳細な設定手順は以下のドキュメントを参照してください。

→ [Documents/JP/27-line-partner-setup.md](./Documents/JP/27-line-partner-setup.md)
