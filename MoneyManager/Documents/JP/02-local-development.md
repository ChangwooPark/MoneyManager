# Phase 1: ローカル開発環境の構成

## 目標

TypeScript + Express + Firestore SDKを使用してローカルで実行可能なAPIサーバーを構築することです。

## プロジェクト初期化

### npm初期化

```bash
npm init -y
```

`package.json`ファイルを生成します。Node.jsプロジェクトの基本設定ファイルです。

### パッケージインストール

```bash
# 本番サービスで使用するパッケージ
npm install express @google-cloud/firestore

# 開発時にのみ使用するパッケージ
npm install --save-dev typescript @types/node @types/express ts-node
```

| パッケージ | 用途 |
|--------|------|
| `express` | HTTPサーバー |
| `@google-cloud/firestore` | Firestoreデータベース連携 |
| `typescript` | TypeScriptコンパイラ |
| `@types/node` | Node.js TypeScript型定義 |
| `@types/express` | Express TypeScript型定義 |
| `ts-node` | TypeScriptを直接実行（開発用） |

## ファイル構成

```
MoneyManager/
  src/
    index.ts              # サーバーエントリーポイント
    routes/
      transactions.ts     # 取引履歴APIルーター
    services/
      firestore.ts        # Firestore連携ロジック
  tsconfig.json           # TypeScript設定
  package.json            # プロジェクト設定・スクリプト
  .gitignore              # Git除外ファイルリスト
```

## 主要ファイルの説明

### tsconfig.json

TypeScriptコンパイラの設定ファイルです。

```json
{
  "compilerOptions": {
    "target": "ES2020",       // どのJavaScriptバージョンに変換するか
    "module": "commonjs",     // モジュールシステム（Node.js標準）
    "outDir": "./dist",       // コンパイルされたファイルの出力先
    "rootDir": "./src",       // TypeScriptソースファイルの場所
    "strict": true            // 厳格な型チェックを有効化
  }
}
```

**strictモードとは？**
`any`型の使用禁止、nullチェックの強制など、型安全性を高める設定です。
コードの作成がやや面倒になりますが、ランタイムエラーを事前に防ぐことができます。

### src/index.ts（サーバーエントリーポイント）

```typescript
const PORT = process.env.PORT || 8080;
```

ポートを環境変数から読み取る理由：Cloud Runはコンテナを実行する際に`PORT`環境変数を自動的に設定します。
ローカルでは環境変数がないため、デフォルト値の8080を使用します。

### src/services/firestore.ts（データベースロジック）

Firestoreと直接通信する関数がまとめられています。

**Transactionインターフェース：**

```typescript
interface Transaction {
  id?: string;
  type: 'income' | 'expense';  // 収入または支出のみ許可
  amount: number;
  category: string;
  description: string;
  date: string;                 // ISO 8601形式（例："2026-06-17"）
}
```

**CRUD関数：**

| 関数 | 役割 |
|------|------|
| `createTransaction` | 新規取引履歴の作成 |
| `getTransactions` | 全件リスト取得（日付降順） |
| `getTransactionById` | IDによる単件取得 |
| `updateTransaction` | 取引履歴の更新 |
| `deleteTransaction` | 取引履歴の削除 |

### src/routes/transactions.ts（APIルーター）

HTTPリクエストを受け取り、Firestore関数を呼び出してレスポンスを返します。

## 実行方法

```bash
# 開発モード（ソースコードを直接実行、ビルド不要）
npm run dev

# 本番モード（ビルド後に実行）
npm run build
npm start
```

### ローカルでFirestoreを使用する際の注意事項

ローカルで実行する場合、FirestoreにアクセスするにはGCP認証が必要です：

```bash
gcloud auth application-default login
```

このコマンドを実行すると、ローカル環境でも実際のGCP Firestoreに接続できます。

## package.jsonスクリプト

```json
{
  "scripts": {
    "build": "tsc",           // TypeScript → JavaScriptコンパイル
    "start": "node dist/index.js",  // コンパイル済みファイルを実行
    "dev": "ts-node src/index.ts"   // 開発用直接実行
  }
}
```
