# Phase 2: Dockerコンテナ化

## Dockerとは？

アプリケーションを**コンテナ**という独立した環境に格納して実行する技術です。
「私のコンピューターでは動いたのに、サーバーで動かない」という問題を解決します。
どんな環境でも同じように動作することが核心です。

```
コンテナ = アプリコード + ランタイム（Node.js）+ 設定 + 依存関係
```

## Dockerfile

Dockerイメージを作るための設計図です。

```dockerfile
# Stage 1: Build（ビルド環境）
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --save-dev typescript@latest --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Stage 2: Production（実行環境）
FROM node:22-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

## マルチステージビルドとは？

このDockerfileは2つのステージ（Stage）に分かれています。

```
Stage 1 (builder)
  node:22-alpine イメージ
  + 全パッケージのインストール（devDependencies含む）
  + TypeScriptコンパイル → dist/ 生成
  → このステージの成果物のみStage 2に渡す

Stage 2 (runner)  ← 最終イメージ
  node:22-alpine イメージ
  + 本番パッケージのみインストール（devDependencies除く）
  + dist/ ファイルのみコピー
  → 不要なファイルのない軽量イメージ
```

**なぜ分けるのか？**
TypeScriptコンパイラ、型定義ファイルなどはビルド時にのみ必要です。
最終イメージからこれらを除外することでイメージサイズが縮小され、セキュリティも向上します。

## 主要コマンドの説明

| コマンド | 意味 |
|--------|------|
| `FROM node:22-alpine` | Node.js 22ベースのAlpine Linuxイメージを使用（軽量Linux） |
| `WORKDIR /app` | コンテナ内の作業ディレクトリを設定 |
| `COPY package*.json ./` | package.json、package-lock.jsonをコピー |
| `RUN npm ci` | package-lock.jsonを基準に正確なバージョンをインストール |
| `EXPOSE 8080` | コンテナが8080ポートを使用することを明示 |
| `CMD ["node", "dist/index.js"]` | コンテナ起動時に実行するコマンド |

## .dockerignore

Dockerビルド時に不要なファイルを除外します（`.gitignore`と同様の概念）：

```
node_modules/   # コンテナ内で再インストールするため不要
dist/           # コンテナ内で再ビルドするため不要
.env            # セキュリティ情報は絶対に含めてはいけない
```

## ローカルでDockerを実行する

```bash
# イメージビルド
docker build -t money-manager:local .

# コンテナ実行（ローカル8080ポート → コンテナ8080ポート）
docker run -p 8080:8080 money-manager:local

# 動作確認
curl http://localhost:8080/health
# → {"status":"ok"}

# コンテナ停止・削除
docker stop money-manager-test
docker rm money-manager-test
```

## Dockerなしで開発する場合との違い

| 項目 | Dockerなし | Docker使用 |
|------|------------|------------|
| 実行 | `npm run dev` | `docker run` |
| 環境 | 自分のPC上のNode.jsバージョンに依存 | 常にNode.js 22 |
| デプロイ | サーバーにNode.jsのインストールが必要 | イメージを渡すだけ |
| 隔離 | なし | 完全隔離 |
