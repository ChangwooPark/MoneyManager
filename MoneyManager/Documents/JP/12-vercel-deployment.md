# Vercelデプロイ

## Vercelとは？

VercelはNext.jsを作った会社が運営する**フロントエンド専用クラウドプラットフォーム**です。
Next.jsアプリを最も簡単・高速にデプロイできる公式プラットフォームです。

```
開発者がすること: git push 一回
Vercelが自動でやること:
  - コード検知
  - npm install
  - next build
  - 世界中のCDNにデプロイ
  - HTTPS URL発行
```

---

## Vercel vs Cloud Runの比較

| 項目 | Vercel | Cloud Run |
|------|--------|-----------|
| 用途 | フロントエンド（Next.js特化） | バックエンド/フロントエンドの両方に対応 |
| 設定難易度 | とても簡単 | 普通（Dockerfileが必要） |
| Next.js最適化 | 完全サポート | 直接設定が必要 |
| 無料枠 | 充実（個人プロジェクトに十分） | 制限あり |
| 自動デプロイ | GitHub連携時にpushだけ | GitHub Actionsが必要 |
| CDN | 世界中に自動適用 | リージョン選択が必要 |

このプロジェクトでは**フロントエンドはVercel**、**バックエンドはCloud Run**と役割を分担しました。

---

## プロジェクト構成

```
GitHub (ChangwooPark/MoneyManager)
  │
  ├─ MoneyManager/          → Cloud Run（バックエンドExpress API）
  │    └─ src/
  │
  └─ MoneyManager/frontend/ → Vercel（フロントエンドNext.js）
       └─ src/
```

VercelはGitHubリポジトリの`MoneyManager/frontend/`フォルダのみを参照してビルドします。

---

## デプロイ過程

### 1. Vercel CLIのインストール

```bash
npm install -g vercel
```

### 2. Vercelログイン

```bash
vercel login
# ブラウザでGoogleまたはGitHubアカウントで認証
```

### 3. 初回デプロイ

```bash
cd MoneyManager/frontend
vercel --yes
# Next.jsを自動検知 → ビルド → デプロイ
# デプロイURL発行: https://frontend-dusky-tau-46.vercel.app
```

### 4. 環境変数の登録

フロントエンドがバックエンドAPIのURLを知る必要があるため、Vercelに環境変数を登録します。

```bash
vercel env add NEXT_PUBLIC_API_URL production
# 値を入力: https://money-manager-1094294666571.asia-northeast3.run.app
```

### 5. Cloud RunバックエンドのCORS設定

バックエンドがVercelドメインからのリクエストを許可するよう設定します。

```bash
gcloud run services update money-manager \
  --region=asia-northeast3 \
  --set-env-vars="FRONTEND_URL=https://frontend-dusky-tau-46.vercel.app" \
  --project=money-manager-499703
```

### 6. 環境変数反映のための再デプロイ

```bash
vercel --prod --yes
```

---

## CORS設定が必要な理由

ブラウザは**異なるドメイン**へのAPIリクエストを送る際にセキュリティチェックを行います。

```
Vercel (frontend-dusky-tau-46.vercel.app)
  → Cloud Run (money-manager-....run.app) へAPIリクエスト

ブラウザ: 「別のドメインだね？サーバーが許可しているか確認するよ」
Cloud Run: 「FRONTEND_URLに登録されているドメインなら許可」
```

バックエンドコードで許可ドメインを管理します：

```typescript
// src/index.ts
const allowedOrigins = [
  process.env.FRONTEND_URL,    // Vercelデプロイ URL（環境変数で注入）
  'http://localhost:3000',     // ローカル開発環境
].filter(Boolean) as string[];
```

---

## デプロイURL情報

| 項目 | URL |
|------|-----|
| Vercelフロントエンド | `https://frontend-dusky-tau-46.vercel.app` |
| Cloud Runバックエンド | `https://money-manager-1094294666571.asia-northeast3.run.app` |

---

## 自動デプロイの動作方式

GitHubリポジトリにpushするとVercelが自動的に変更を検知して再デプロイします。

```
ローカルでコード修正
  ↓
git push origin main
  ↓
Vercel: 「frontend/ フォルダに変更を検知」
  ↓
自動ビルド＆デプロイ（約1〜2分）
  ↓
https://frontend-dusky-tau-46.vercel.app に反映
```

> **参考：** Cloud Runバックエンドも同じpushでGitHub Actionsが自動デプロイします。
> mainブランチへのpush一回でフロントエンドとバックエンドが同時に更新されます。

---

## 今後の開発フロー

Phase 9〜13の作業をするたびに：

```bash
git add .
git commit -m "作業内容"
git push origin main
# → Vercel自動デプロイ → スマートフォンですぐに確認可能
```

Vercelのデプロイ状況は[vercel.com/dashboard](https://vercel.com/dashboard)で確認できます。

---

## CDNとは？

Vercelはデプロイ時に世界中の**CDN（Content Delivery Network）**に自動的にファイルをアップロードします。

```
CDNなし：
  日本のユーザー → アメリカのサーバーにリクエスト → 遅い（100〜200ms）

CDNあり（Vercel）：
  日本のユーザー → 最も近いサーバー（例：東京）→ 速い（10〜30ms）
```

Vercelは世界100カ所以上のエッジサーバーを運営しているため、
どこからアクセスしても高速にロードされます。
