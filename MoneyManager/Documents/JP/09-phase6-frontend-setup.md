# Phase 6: Next.jsフロントエンド初期設定

## このフェーズで行ったこと

フロントエンド（画面）とバックエンド（データ処理）の役割を明確に分離し、
Next.jsプロジェクトを作成して基盤を構築しました。

---

## アーキテクチャの決定：役割分離

### 最初に試みた方向（間違った方向）

```
Next.js → Firebase SDK → Firestore（直接接続）
```

Next.jsにFirebase SDKをインストールしてFirestoreに直接アクセスしようとしました。
この方式には以下の問題がありました：

- Firebase認証キーがブラウザに露出する（セキュリティリスク）
- フロントエンドがDBロジックを含むことになり役割が混在する
- 元の設計意図（バックエンド/フロントエンド分離）に反する

### 最終決定方向（正しい方向）

```
Next.js（画面）→ HTTPリクエスト → Express API（Cloud Run）→ Firestore
```

| 区分 | 役割 | 技術 |
|------|------|------|
| フロントエンド | 画面構成、ユーザー入力、API呼び出し | Next.js、TypeScript、Tailwind CSS |
| バックエンド | データ処理、DB連携、ビジネスロジック | Express、TypeScript、Firestore |

---

## バックエンドの変更点

### 1. 新規APIエンドポイントの追加

フロントエンドに必要な機能のために3つのエンドポイントを追加しました。

#### PIN関連（`/settings`）

| Method | パス | 機能 |
|--------|------|------|
| POST | `/settings/pin/verify` | 入力したPINが正しいか確認 |
| PUT | `/settings/pin` | PIN変更 |

```typescript
// PIN検証の例
POST /settings/pin/verify
Body: { "pin": "8907" }
Response: { "success": true }
```

PINはFirestoreの`settings/app_settings`ドキュメントに保存されます。
初期値は`8907`であり、ドキュメントがなければデフォルト値を返します。

#### 予算関連（`/budgets`）

| Method | パス | 機能 |
|--------|------|------|
| GET | `/budgets/:yearMonth` | 該当月の予算取得 |
| PUT | `/budgets/:yearMonth` | 該当月の予算設定/更新 |

```typescript
// 予算設定の例
PUT /budgets/2026-06
Body: { "amount": 100000 }
Response: { "id": "xxx", "yearMonth": "2026-06", "amount": 100000 }
```

### 2. 取引履歴の年月フィルター追加

既存の`GET /transactions`に`yearMonth`クエリパラメータを追加しました。

```typescript
// 2026年6月の取引履歴のみ取得
GET /transactions?yearMonth=2026-06
```

以前は全データを一括取得していましたが、
特定月のデータのみ取得できるようになりパフォーマンスが向上します。

### 3. CORS設定の追加

CORS（Cross-Origin Resource Sharing）とは、異なるドメイン間のHTTPリクエストを許可/ブロックするブラウザのセキュリティポリシーです。

例えば`localhost:3000`（Next.js）から`localhost:8080`（Express）にリクエストを送ると、
ブラウザが「異なるオリジンからのリクエスト」と判断してブロックします。
これを許可するためにCORS設定が必要です。

```typescript
// 許可するオリジンのリスト
const allowedOrigins = [
  process.env.FRONTEND_URL,   // 本番Next.js URL（環境変数）
  'http://localhost:3000',    // ローカル開発環境
];
```

`FRONTEND_URL`環境変数で本番URLを注入すれば、
後でNext.jsをデプロイした際も自動的に許可されます。

---

## フロントエンド構成

### 作成コマンド

```bash
npx create-next-app@latest frontend \
  --typescript \     # TypeScript使用
  --tailwind \       # Tailwind CSS含む
  --eslint \         # ESLintコードチェック含む
  --app \            # App Router使用（最新方式）
  --src-dir \        # src/ フォルダ構成
  --import-alias "@/*"  # @/ で始まる絶対パスimport
```

### ディレクトリ構成

```
frontend/
  src/
    app/
      globals.css       # グローバルCSS（ダークテーマ変数定義）
      layout.tsx        # ルートレイアウト（全ページ共通）
      page.tsx          # メインページ（後で実装）
    types/
      index.ts          # 共通TypeScript型定義
    lib/
      api.ts            # バックエンドAPI呼び出し関数集
    components/         # UIコンポーネント（後で実装）
  .env.local            # 環境変数（API URLなど）
```

### 主要ファイルの説明

#### `src/types/index.ts` — 共通型定義

TypeScriptでデータの形を事前に定義しておくファイルです。
バックエンドとフロントエンドが同じデータ構造を共有します。

```typescript
export interface Transaction {
  id?: string;
  type: 'income' | 'expense';   // 収入または支出のみ許可
  amount: number;
  category: string;
  description: string;
  date: string;                  // YYYY-MM-DD 形式
  memo?: string;                 // ? は省略可能項目（なくても良い）
}

export interface Budget {
  id?: string;
  yearMonth: string;             // YYYY-MM 形式
  amount: number;
}

export type TabType = 'home' | 'calendar' | 'stats' | 'more';
```

#### `src/lib/api.ts` — APIクライアント

バックエンドAPIを呼び出す関数をまとめたファイルです。
コンポーネントから直接`fetch`を使う代わりに、このファイルの関数を呼び出します。

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// 使用例（コンポーネントから）
import { getTransactions, createTransaction } from '@/lib/api';

const data = await getTransactions('2026-06');
await createTransaction({ type: 'expense', amount: 5000, ... });
```

**`NEXT_PUBLIC_` プレフィックスの意味：**
Next.jsで環境変数をブラウザ（クライアント）からもアクセスするには
`NEXT_PUBLIC_` プレフィックスが必須です。ないとサーバー側でしか読めません。

#### `src/app/globals.css` — ダークテーマ

CSS変数で色を定義して、一貫したダークテーマを維持します。

```css
:root {
  --bg-primary: #0f0f0f;    /* 最も暗い背景 */
  --bg-secondary: #1a1a1a;  /* カード背景 */
  --income: #34d399;        /* 収入色（緑） */
  --expense: #f87171;       /* 支出色（赤） */
  --accent: #6366f1;        /* アクセント色（紫） */
}
```

#### `.env.local` — 環境変数

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

ローカル開発時はローカルのExpressサーバー（8080）に接続します。
デプロイ時はこの値をCloud RunのURLに変更します。
`.env.local`は`.gitignore`に含まれているためGitHubにアップロードされません。

---

## Next.js App Routerとは？

Next.js 13から導入された新しいルーティング方式です。
`src/app/` フォルダの構造がそのままURLパスになります。

```
src/app/
  page.tsx          → /        （メインページ）
  layout.tsx        → 全ページに共通適用されるレイアウト
```

`layout.tsx`は全ページを包むラッパーの役割をします。
メタデータ（タブタイトル、ビューポート設定など）をここで設定します。

```typescript
// モバイル最適化ビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,   // ピンチズーム無効化（アプリのように）
};
```

---

## 環境変数管理戦略

| ファイル | 用途 | Git管理 |
|------|------|--------------|
| `.env.local` | ローカル開発用（API URLなど） | 除外 |
| GitHub Secrets | デプロイ時の環境変数注入 | 除外（暗号化保存） |

本番デプロイ時には`NEXT_PUBLIC_API_URL`をCloud RunのURLに設定する必要があります：
```
NEXT_PUBLIC_API_URL=https://money-manager-1094294666571.asia-northeast3.run.app
```
