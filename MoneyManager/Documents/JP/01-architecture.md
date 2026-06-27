# システムアーキテクチャ概要

## プロジェクト紹介

TypeScriptで書かれた家計簿サーバーです。
Google Cloud Platform（GCP）の無料枠を最大限に活用し、コストを最小化することを目指しています。

## 技術スタック

| 技術 | 役割 |
|------|------|
| TypeScript | 主要開発言語 |
| Node.js | ランタイム環境 |
| Express | HTTPサーバーフレームワーク |
| Docker | コンテナ化 |
| Google Cloud Run | サーバー実行環境 |
| Google Cloud Firestore | データベース |
| Google Artifact Registry | Dockerイメージリポジトリ |
| Google Cloud Build | クラウドビルドツール |
| GitHub Actions | 自動デプロイ（CI/CD） |

## 全体構成

```
開発者（ローカル）
  │
  │  git push
  ▼
GitHub (ChangwooPark/MoneyManager)
  │
  │  自動トリガー
  ▼
GitHub Actions
  ├─ Dockerイメージビルド
  ├─ Artifact Registryプッシュ
  └─ Cloud Runデプロイ
       │
       │  HTTPリクエスト
       ▼
    Cloud Run (money-manager)
    asia-northeast3 (ソウル)
       │
       │  読み取り/書き込み
       ▼
    Firestore（データベース）
    asia-northeast3 (ソウル)
```

## APIエンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | サーバー状態確認 |
| GET | `/transactions` | 全取引履歴の取得 |
| GET | `/transactions/:id` | 単件取引履歴の取得 |
| POST | `/transactions` | 取引履歴の作成 |
| PUT | `/transactions/:id` | 取引履歴の更新 |
| DELETE | `/transactions/:id` | 取引履歴の削除 |

## サービスURL

```
https://money-manager-1094294666571.asia-northeast3.run.app
```

## GCPプロジェクト情報

| 項目 | 値 |
|------|------|
| プロジェクトID | `money-manager-499703` |
| リージョン | `asia-northeast3` (ソウル) |
| Firestore DB | `(default)` Native Mode |
| Artifact Registry | `money-manager` |
| Cloud Runサービス | `money-manager` |
