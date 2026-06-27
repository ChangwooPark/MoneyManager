# Phase 17 — LINE Messaging API 通知機能 学習文書

## 概要

Phase 17で実装した機能と使用したGCP Bashコマンドを合わせて説明します。

**実装機能:**
1. LINE Messaging APIで取引登録時にプッシュ通知を送信
2. もっとみるタブ — 通知ON/OFFトグル + テストメッセージ送信UI
3. GCP Secret ManagerでAPIトークンを安全に管理

---

## 1. LINE Messaging APIの概念

LINE Notify（2025年3月終了）の後継方式です。

### 動作フロー

```
[バックエンドサーバー]
     │
     │  POST https://api.line.me/v2/bot/message/push
     │  Authorization: Bearer {Channel Access Token}
     │  Body: { "to": "{User ID}", "messages": [...] }
     │
     ▼
[LINE サーバー]
     │
     ▼
[ユーザーのLINEアプリ]  ← ボットを友達追加していないと受信できない
```

### 必要な2つの値

| 値 | 説明 | 場所 |
|---|---|---|
| `Channel Access Token` | ボットがメッセージを送信できる認証トークン | LINE Developers → Messaging API タブ |
| `User ID` | メッセージを受信するユーザーの識別子 | LINE Developers → Basic settings タブ → "Your user ID" |

---

## 2. バックエンド構造

### 2-1. LINEサービス（`src/services/line.ts`）

```typescript
export async function sendLineNotification(message: string): Promise<boolean> {
  const token  = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  // 環境変数が未設定の場合は静かにスキップ（ローカル開発環境など）
  if (!token || !userId) {
    console.warn('[LINE] 環境変数未設定 — 通知送信をスキップ');
    return false;
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE API error ${res.status}: ${body}`);
  }

  return true; // 送信成功
}
```

**戻り値の設計意図:**
- `true` — 実際の送信成功
- `false` — 環境変数未設定（エラーではない、ローカル開発では静かにスキップ）
- `throw` — LINE APIのレスポンスエラー（ネットワーク問題、誤ったトークンなど）

### 2-2. 取引保存後に通知を送信（fire-and-forget）

```typescript
// src/routes/transactions.ts — POST ハンドラー
const created = await createTransaction({ type, amount, category, description, date, memo });
res.status(201).json(created); // ← クライアントに即座に応答（通知送信を待たない）

// 通知送信 — fire-and-forget
getNotificationEnabled()
  .then(enabled => {
    if (!enabled) return;
    return sendLineNotification(buildTransactionMessage(created));
  })
  .catch(err => console.error('[LINE] 通知送信失敗:', err));
```

**fire-and-forgetパターンとは？**

`await` を使わずにPromiseをそのまま流す方式です。
通知送信を待たずにHTTPレスポンスを先に送ります。

```
await 使用時:  取引保存 → 通知送信（待機）→ クライアントに応答  （遅い）
fire-and-forget: 取引保存 → クライアントに即座に応答  （速い）
                           ↑ 通知送信はバックグラウンドで継続
```

通知の失敗が取引保存自体に影響しないよう `.catch()` でエラーを別途処理します。

### 2-3. 通知メッセージのフォーマット

```typescript
export function buildTransactionMessage(tx: { ... }): string {
  const icon      = tx.type === 'income' ? '💰' : '💸';
  const typeLabel = tx.type === 'income' ? '収入' : '支出';
  const sign      = tx.type === 'income' ? '+' : '-';
  const amount    = `¥${tx.amount.toLocaleString('ja-JP')}`;

  let message = `[家計簿通知]\n${icon} ${typeLabel} ${sign}${amount} (${tx.category})\n${tx.date} 登録`;
  if (tx.memo) message += `\nメモ: ${tx.memo}`;

  return message;
}
```

実際のLINEメッセージの例:
```
[家計簿通知]
💸 支出 -¥3,000 (食費)
2026-06-22 登録
メモ: ランチ
```

### 2-4. 通知設定API（`src/routes/notifications.ts`）

| メソッド | パス | 機能 |
|---|---|---|
| GET | `/notifications/settings` | 通知ON/OFFの状態を取得 |
| PUT | `/notifications/settings` | 通知ON/OFFを変更 |
| POST | `/notifications/test` | テストメッセージを即座に送信 |

Firestore `settings/notification_settings` ドキュメントに `{ enabled: boolean }` を保存。
デフォルト値は `true`（ドキュメントがなければ true を返す）。

---

## 3. フロントエンド — ON/OFFトグルボタンの実装

```tsx
<button
  onClick={handleNotifToggle}
  disabled={notifLoading}
  className="relative w-12 h-6 rounded-full overflow-hidden transition-colors duration-200"
  style={{ backgroundColor: notifEnabled ? 'var(--accent)' : 'var(--border)' }}
  aria-label={notifEnabled ? '通知をOFF' : '通知をON'}
>
  <span
    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
    style={{ transform: notifEnabled ? 'translateX(26px)' : 'translateX(2px)' }}
  />
</button>
```

**寸法の計算:**
```
ボタン: w-12 = 48px,  h-6 = 24px
サム:   w-5  = 20px,  h-5 = 20px

OFF位置: translateX(2px)  → 左端（2pxのマージン）
ON 位置: translateX(26px) → 右端（48 - 20 - 2 = 26px）

overflow-hidden が必須な理由:
  なければサムがボタンの外に飛び出してUIが崩れる
```

---

## 4. GCP Secret Manager — Bashコマンドまとめ

### 4-1. Secret Manager APIの有効化

```bash
gcloud services enable secretmanager.googleapis.com --project=money-manager-499703
```

GCPプロジェクトでSecret Managerを初めて使用する際に一度だけ実行します。
有効化しないと `API has not been used` エラーが発生します。

### 4-2. Secretの作成

```bash
printf '%s' 'トークン値' | gcloud secrets create シークレット名 --data-file=- --project=プロジェクトID
```

**オプションの説明:**
- `printf '%s'` — 値の末尾に改行（`\n`）が付かないようにします。`echo` は自動で `\n` を追加するためトークンが変質する可能性があります。
- `--data-file=-` — 標準入力（`stdin`）から値を読み込みます。`-` が stdin を意味します。
- `--project` — 対象のGCPプロジェクトID

実際に使用したコマンド:
```bash
printf '%s' '735dqvAf...' | gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN \
  --data-file=- --project=money-manager-499703

printf '%s' 'U162361c...' | gcloud secrets create LINE_USER_ID \
  --data-file=- --project=money-manager-499703
```

成功時の出力:
```
Created version [1] of the secret [LINE_CHANNEL_ACCESS_TOKEN].
```

### 4-3. Secretのバージョン更新（トークン再発行時）

```bash
printf '%s' '新しいトークン値' | gcloud secrets versions add シークレット名 \
  --data-file=- --project=プロジェクトID
```

Secretを削除して再作成するのではなく、`versions add` で新しいバージョンを追加します。
既存のバージョンは保持され、`latest` が新しいバージョンを指します。

### 4-4. IAM権限の付与

```bash
gcloud projects add-iam-policy-binding money-manager-499703 \
  --member="serviceAccount:1094294666571-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Cloud RunがSecret Managerの値を読み取るにはサービスアカウントに `secretAccessor` 権限が必要です。
この権限がないとデプロイ時に `Permission denied on secret` エラーが発生します。

**サービスアカウント名の構造:**
```
{プロジェクト番号}-compute@developer.gserviceaccount.com
└── Cloud Run、Compute Engineのデフォルトサービスアカウント
```

### 4-5. Cloud RunにSecretを環境変数として接続

```bash
gcloud run services update money-manager \
  --region asia-northeast3 \
  --project money-manager-499703 \
  --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest,LINE_USER_ID=LINE_USER_ID:latest"
```

**形式:** `環境変数名=シークレット名:バージョン`

- `latest` — 最新バージョンを自動で参照します。
- このコマンドを実行すると新しいCloud Runリビジョンが作成されます。
- コンテナ内で `process.env.LINE_CHANNEL_ACCESS_TOKEN` としてアクセスできます。

### 4-6. Secretのリスト確認

```bash
gcloud secrets list --project=money-manager-499703
```

出力例:
```
NAME                       CREATED              REPLICATION_POLICY  LOCATIONS
LINE_CHANNEL_ACCESS_TOKEN  2026-06-22T08:05:23  automatic           -
LINE_USER_ID               2026-06-22T08:05:37  automatic           -
```

### 4-7. デプロイされたAPIの直接テスト（curl）

```bash
curl -s -X POST https://money-manager-1094294666571.asia-northeast3.run.app/notifications/test \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}"
```

**オプションの説明:**
- `-s`（silent）— 進行バーなしで結果のみ出力
- `-X POST` — HTTPメソッドを指定
- `-H` — ヘッダーを追加
- `-w "\nHTTP_STATUS:%{http_code}"` — レスポンス本文の後にHTTPステータスコードを追加出力

成功時の出力:
```
{"sent":true}
HTTP_STATUS:200
```

### 4-8. Cloud Runサービス情報の確認

```bash
# 現在実行中のイメージタグを確認（デプロイされたコミットハッシュの確認に便利）
gcloud run services describe money-manager \
  --region asia-northeast3 \
  --project money-manager-499703 \
  --format="value(spec.template.spec.containers[0].image)"

# 最新リビジョンの作成時刻を確認
gcloud run revisions describe リビジョン名 \
  --region asia-northeast3 \
  --project money-manager-499703 \
  --format="value(metadata.creationTimestamp)"
```

### 4-9. Cloud Runのログを取得

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="money-manager"' \
  --project money-manager-499703 \
  --limit 30 \
  --freshness 10m \
  --format="value(timestamp, textPayload)"
```

**オプションの説明:**
- `resource.type` — ログソースフィルター（Cloud Runリビジョン）
- `--freshness 10m` — 直近10分以内のログのみ取得
- `--limit 30` — 最大30件

---

## 5. Secret Manager vs 環境変数の直接設定の比較

| 方式 | メリット | デメリット |
|---|---|---|
| **Secret Manager** | 値がGCPコンソールで暗号化管理される、バージョン管理が可能、IAMでアクセス制御 | 設定が複雑 |
| **環境変数を直接設定** | 設定が簡単 | Cloud Runコンソールで値が平文で見える |

APIトークンのように漏洩してはいけない値にはSecret Managerを使用します。

---

## 6. 全体フローのまとめ

```
[ユーザーが取引を登録]
     │
     ▼
[フロントエンド] POST /transactions
     │
     ▼
[バックエンド transactions.ts]
     │  createTransaction() → Firestoreへの保存完了
     │  res.status(201).json(created)  ← クライアントに即座に応答
     │
     │  （バックグラウンド）
     ├── getNotificationEnabled() → Firestoreから通知設定を取得
     │        │ enabled: false → 終了
     │        │ enabled: true  ↓
     └── sendLineNotification(message)
              │
              │  POST api.line.me/v2/bot/message/push
              │  Authorization: Bearer {SECRET_MANAGERから注入されたトークン}
              │
              ▼
         [LINEサーバー] → [ユーザーのLINEアプリ]
```

---

## まとめ

| 実装ポイント | 核心 |
|---|---|
| LINE API認証 | Bearerトークン方式、`Authorization: Bearer {token}` ヘッダー |
| トークンのセキュリティ管理 | GCP Secret Manager → Cloud Runの環境変数に自動注入 |
| fire-and-forget | `await` なしで `.then().catch()` でバックグラウンド実行 |
| 通知の無効化 | Firestore `settings/notification_settings.enabled` フラグ |
| トグルUI | `overflow-hidden` が必須 — なければサムがボタンの外に飛び出す |
| ボット友達追加 | ユーザーがLINEアプリでボットを友達追加しないとメッセージを受信できない |
