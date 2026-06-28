# Phase Dev-6 — 本番/開発完全分離 最終検証 学習ドキュメント

## 概要

Dev-1〜5で構築した本番/開発分離環境が実際に正しく隔離されて動作しているかを検証した過程を説明します。

---

## 1. 検証項目と結果

| 項目 | 方法 | 結果 |
|------|------|------|
| 本番バックエンド正常動作 | `/health` エンドポイント応答確認 | ✅ `{"status":"ok"}` |
| 開発バックエンド正常動作 | `/health` エンドポイント応答確認 | ✅ `{"status":"ok"}` |
| 開発DB隔離 | 開発バックエンドに取引を追加して件数変化を確認 | ✅ 開発DBのみ増加 |
| 本番DB無結性 | 開発作業後に本番DB件数の変化を確認 | ✅ 変化なし |
| 開発自動デプロイ | `develop`へpush → GitHub Actions実行 | ✅ 正常実行 |
| 本番自動デプロイ | PRマージ → GitHub Actions実行 | ✅ 正常実行 |

---

## 2. DB隔離検証の詳細

### 検証前のベースライン確認

```bash
# 本番バックエンドの2026-06取引件数
curl "https://money-manager-1094294666571.asia-northeast3.run.app/transactions?yearMonth=2026-06"
# → 2件

# 開発バックエンドの2026-06取引件数
curl "https://money-manager-dev-576447610294.asia-northeast3.run.app/transactions?yearMonth=2026-06"
# → 0件
```

### 開発バックエンドに取引を追加

```bash
curl -X POST "https://money-manager-dev-576447610294.asia-northeast3.run.app/transactions" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-28","type":"expense","category":"検証","description":"Dev-6隔離検証","amount":1}'
# → {"id":"Et6i3Se5ZjEO047iXf60", ...}
```

### 隔離確認

```bash
# 開発DB: 1件に増加 ✅
curl ".../dev.../transactions?yearMonth=2026-06"   # → 1件

# 本番DB: 依然として2件 ✅（開発作業の影響を受けない）
curl ".../prod.../transactions?yearMonth=2026-06"  # → 2件
```

**2つのCloud RunサービスがそれぞれのGCPプロジェクトのFirestoreを参照するため、完全に分離されます。**

---

## 3. 隔離が保証される構造的な理由

```
開発フロントエンド (frontend-dev-changwoo-park.vercel.app)
  │  NEXT_PUBLIC_API_URL = 開発バックエンドURL
  ▼
開発バックエンド (money-manager-dev, Cloud Run)
  │  GCPプロジェクト: money-manager-dev-001
  ▼
開発Firestore (money-manager-dev-001プロジェクト)

──────────────────────────────────────────────

本番フロントエンド (frontend-changwoo-park.vercel.app)
  │  NEXT_PUBLIC_API_URL = 本番バックエンドURL
  ▼
本番バックエンド (money-manager, Cloud Run)
  │  GCPプロジェクト: money-manager-499703
  ▼
本番Firestore (money-manager-499703プロジェクト)
```

各環境が独立したGCPプロジェクトを使用するため、プログラムのミスがあっても相互アクセスは不可能です。

---

## 4. E2EテストURL環境変数化

### 変更前

```typescript
// playwright.config.ts
use: {
  baseURL: 'http://localhost:3000',  // ローカルサーバーのみ対応
}
```

### 変更後

```typescript
use: {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
}

// PLAYWRIGHT_BASE_URL指定時はローカルサーバーの自動起動を省略
webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : [...],
```

### 使用方法

```bash
# ローカル開発サーバー対象（従来と同じ）
npx playwright test

# 開発サーバー対象
PLAYWRIGHT_BASE_URL=https://frontend-dev-changwoo-park.vercel.app npx playwright test

# 本番サーバー対象
PLAYWRIGHT_BASE_URL=https://frontend-changwoo-park.vercel.app npx playwright test
```

### なぜ環境変数化が必要か

E2Eテストをローカルサーバーだけでなくデプロイ済みサーバーでも実行できるようにするためです。
環境変数の欠落、CORS設定、ビルド最適化の問題はデプロイ後にしか発見できないことがあります。
URLを環境変数で切り替えることで、同じテストコードでローカル・開発・本番すべてを検証できます。

---

## 5. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| GCPプロジェクト隔離 | GCPリソース（Firestore、Cloud Runなど）はプロジェクト単位で完全に分離。相互アクセス不可 |
| `NEXT_PUBLIC_API_URL` | フロントエンドビルド時にバックエンドURLを注入する環境変数。ビルド成果物に含まれる |
| `PLAYWRIGHT_BASE_URL` | E2Eテスト対象URLを指定する環境変数。未設定時はlocalhostを使用 |
| `webServer: undefined` | Playwrightがローカルサーバーを自動起動しないようにする設定。外部URLテスト時に使用 |
