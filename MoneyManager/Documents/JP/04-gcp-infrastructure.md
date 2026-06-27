# Phase 3: GCPインフラ構成

## 有効化したGCP API

GCPの各サービスを使用するには、APIを先に有効化する必要があります。

```bash
gcloud services enable \
  firestore.googleapis.com \        # Firestoreデータベース
  artifactregistry.googleapis.com \ # Dockerイメージリポジトリ
  cloudbuild.googleapis.com \       # クラウドビルド
  run.googleapis.com                # Cloud Runサービス
```

## Firestoreデータベース

### 作成コマンド

```bash
gcloud firestore databases create \
  --location=asia-northeast3 \  # ソウルリージョン
  --project=money-manager-499703
```

### Firestoreとは？

Googleが提供する**NoSQLドキュメント型データベース**です。

**構造：**
```
Firestore
  └─ Collection（コレクション）= フォルダの概念
       └─ Document（ドキュメント）= ファイルの概念
            └─ Field（フィールド）= データ
```

**このプロジェクトの構造：**
```
transactions（コレクション）
  ├─ 3FymF3vJSd03Tjyhicdb（ドキュメントID - 自動生成）
  │    ├─ type: "expense"
  │    ├─ amount: 5000
  │    ├─ category: "食費"
  │    ├─ description: "昼食"
  │    ├─ date: "2026-06-17"
  │    └─ createdAt: Timestamp
  └─ ...
```

### Native Modeとは？

Firestoreには2つのモードがあります：
- **Native Mode**：リアルタイム更新、強力なクエリサポート → 今回選択
- **Datastore Mode**：既存のDatastoreとの互換性（レガシー）

### 無料枠

| 項目 | 無料上限 |
|------|----------|
| ストレージ容量 | 1GB |
| 読み取り | 50,000回/日 |
| 書き込み | 20,000回/日 |
| 削除 | 20,000回/日 |

個人の家計簿レベルでは無料上限を超えることは難しいです。

## Artifact Registry

Dockerイメージを保存する倉庫です。GitHubにコードを保存するように、Dockerイメージを保存します。

### 作成コマンド

```bash
gcloud artifacts repositories create money-manager \
  --repository-format=docker \   # Dockerイメージ形式
  --location=asia-northeast3 \   # ソウルリージョン
  --project=money-manager-499703
```

### イメージパスの規則

```
asia-northeast3-docker.pkg.dev / money-manager-499703 / money-manager / account-book : v1
        リージョン                     プロジェクトID        リポジトリ名    イメージ名    タグ
```

## リージョン選択の理由（asia-northeast3）

全サービスを**ソウルリージョン（asia-northeast3）**にデプロイした理由：
1. 韓国ユーザー基準のレイテンシ最小化
2. Firestore ↔ Cloud Run が同じリージョンであればネットワーク費用なし
3. データ主権（韓国内でデータを保管）
