# Phase 19 — レシートカメラスキャン 学習ドキュメント

## 概要

取引入力フォームでレシートをカメラで撮影すると、Claude Vision AIが画像を分析して**金額と商品リストを自動入力**する機能です。

**利用フロー:**
```
FAB(+)タップ → 取引入力フォーム
  → [領収書スキャン]ボタンタップ
  → カメラ / ギャラリーでレシート選択
  → バックエンド POST /receipts/scan
  → Claude Haiku Vision 分析
  → 金額・商品リスト自動入力
  → ユーザー確認後に保存
```

---

## 1. ファイル構成

```
バックエンド
  src/services/claude.ts       ← Claude Vision API呼び出し + レスポンスパース
  src/routes/receipts.ts       ← POST /receipts/scan ルート (multer)
  src/index.ts                 ← /receipts ルート登録

フロントエンド
  frontend/src/lib/api.ts      ← scanReceiptImage()関数追加
  frontend/src/components/features/transaction/
    TransactionForm.tsx        ← スキャンボタン + ファイルinput + 自動入力
    TransactionDetailSheet.tsx ← メモ white-space: pre-wrap 適用
  frontend/src/i18n/translations.ts ← receiptScanBtn等 翻訳キー追加
```

---

## 2. バックエンド — multerで画像受信

### multerとは？

Expressで`multipart/form-data`（ファイルアップロード）リクエストを解析するミドルウェアです。

```typescript
// src/routes/receipts.ts
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),        // ファイルをメモリ(Buffer)に保存
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB制限
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);  // 許可
    } else {
      cb(new Error('許可されていない画像形式'));
    }
  },
});
```

**なぜ`memoryStorage()`か？**

Cloud Runは**ステートレス(Stateless)**コンテナです。リクエストが終わるとコンテナがいつでも置き換えられる可能性があるため、ディスクに保存しても次のリクエストでは見つかりません。メモリバッファで直接処理することでこの問題を回避します。

### ルート登録

```typescript
// upload.single('image'): 'image'フィールド名でファイル1件受信
router.post('/scan', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '画像ファイルが必要です。' });
    return;
  }
  const result = await scanReceipt(req.file.buffer, req.file.mimetype);
  res.json(result);
});
```

---

## 3. バックエンド — Claude Vision API呼び出し

### Claude APIメッセージ構造

Claude Vision APIはテキストと画像を一緒に含んだメッセージを受け取ります。

```typescript
// src/services/claude.ts
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',  // Haiku: 速くて安い、OCRに十分
  max_tokens: 1024,                     // 商品リストが長くなる可能性があるため余裕を確保
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',           // 画像をbase64文字列にエンコード
            media_type: 'image/jpeg', // MIMEタイプを明示
            data: base64Image,        // Buffer.toString('base64')
          },
        },
        {
          type: 'text',
          text: `このレシートを読み取り...`,
        },
      ],
    },
  ],
});
```

**なぜHaikuモデルか？**

| 項目 | Claude Haiku | Claude Sonnet |
|------|-------------|---------------|
| レシートOCR能力 | 十分 | 過剰 |
| 速度 | 速い | 普通 |
| コスト | 安い (~$0.001/枚) | 5倍高い |

### プロンプト設計

```
このレシートを読み取り、以下のJSON形式のみで返してください。
{"amount": <合計金額>, "memo": "<商品リスト>"}

品目リストの形式:
- 「商品名×数量: 金額円」の形式で列挙
- 複数商品は改行(\n)で区切る
- 例: "卵×1: 500円\nラーメン×1: 300円"
```

**設計ポイント:**
- `JSONのみ出力` — 不要な説明文を防ぐ
- 商品区切りにカンマではなく`\n`を使用 → メモ入力欄で改行として表示
- 読み取れない場合は`amount: 0`、`memo: ""`を明示してfallback保証

---

## 4. バックエンド — レスポンスパース（2段階安全網）

Claudeが常に正確なJSONのみを返すとは限らないため、2段階パースを適用します。

```typescript
function parseReceiptResponse(text: string): ReceiptScanResult {
  // 1段階: JSON抽出後 JSON.parse
  const jsonMatch = text.match(/\{[\s\S]*\}/);  // 貪欲マッチング
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        amount: Math.max(0, Math.floor(parsed.amount ?? 0)),
        memo:   (parsed.memo ?? '').trim(),
      };
    } catch { /* パース失敗時は2段階へ */ }
  }

  // 2段階: 正規表現で各フィールドを直接抽出
  const amountMatch = text.match(/"amount"\s*:\s*(\d+)/);
  const memoMatch   = text.match(/"memo"\s*:\s*"([^"]*)"/);
  return {
    amount: amountMatch ? parseInt(amountMatch[1], 10) : 0,
    memo:   memoMatch   ? memoMatch[1].trim() : '',
  };
}
```

**なぜ貪欲マッチング(`*`)か？**

memoの中に`{`や`}`文字が含まれる可能性があります。非貪欲(`*?`)だと最初の`}`で切れてパースが失敗します。貪欲(`*`)は最後の`}`まで含むため、JSON全体を正しくキャプチャします。

---

## 5. Secret Manager — APIキー管理

`ANTHROPIC_API_KEY`はソースコードや環境変数に直接書かず、**GCP Secret Manager**に保存します。

```bash
# 1. シークレット作成
echo -n "sk-ant-..." | gcloud secrets create ANTHROPIC_API_KEY --data-file=- --project=<PROJECT_ID>

# 2. Cloud Run SAにアクセス権限付与
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. Cloud Runデプロイ時にシークレットを環境変数としてマウント
gcloud run deploy money-manager \
  --set-secrets=ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest \
  ...
```

**フロー:**
```
Secret Manager (暗号化保存)
  ↓ IAM権限確認
Cloud Run起動時に環境変数として注入
  ↓
process.env.ANTHROPIC_API_KEY で参照
```

---

## 6. フロントエンド — カメラ連携

### 隠しファイルinput

`<input type="file" capture="environment">` が核心です。

```tsx
// TransactionForm.tsx
const fileInputRef = useRef<HTMLInputElement>(null);

// 隠しファイルinput — ボタンクリック時にref.click()で開く
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  capture="environment"   // 背面カメラ優先 (ギャラリー選択も可能)
  className="hidden"
  onChange={handleReceiptScan}
/>

// ユーザーに見えるボタン
<button onClick={() => fileInputRef.current?.click()}>
  📷 領収書スキャン
</button>
```

**`capture="environment"`の意味:**
- `"environment"` = 背面（外部）カメラ優先
- `"user"` = 前面カメラ優先
- 省略 = ギャラリーを開く

**`accept="image/*"`の意味:**
- ギャラリーから画像ファイルのみ選択可能
- iOSでHEIC撮影しても、アップロード時に**ブラウザが自動でJPEGに変換**

### FormDataで送信

```typescript
// frontend/src/lib/api.ts
export async function scanReceiptImage(file: File): Promise<ReceiptScanResult> {
  const formData = new FormData();
  formData.append('image', file);  // フィールド名'image' = multer upload.single('image')と一致

  const res = await fetch(`${BASE_URL}/receipts/scan`, {
    method: 'POST',
    body: formData,
    // Content-Typeヘッダー未指定 — ブラウザがmultipart/form-data + boundaryを自動設定
  });
  ...
}
```

**注意: Content-Typeヘッダーを直接指定してはいけません。**

`multipart/form-data`はヘッダーに`boundary=xxx`値が含まれる必要があります。ブラウザがFormDataを検出すると自動的に正しいヘッダーを生成します。

### 自動入力処理

```typescript
const handleReceiptScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  e.target.value = '';  // 同じファイルの再選択でonChangeが再発動するよう初期化

  setScanning(true);
  try {
    const result = await scanReceiptImage(file);
    if (result.amount > 0) setAmount(String(result.amount));  // 金額自動入力
    if (result.memo)       setMemo(result.memo);              // 商品リスト自動入力
    setScanMsg(t('receiptScanFilled'));
  } catch {
    setScanMsg(t('receiptScanError'));  // 失敗しても手動入力は継続可能
  } finally {
    setScanning(false);
  }
};
```

---

## 7. メモ入力欄のtextarea切り替え

商品リストは複数行になるため、`<input>`を`<textarea>`に交換しました。

```tsx
// 変更前
<input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />

// 変更後
<textarea
  value={memo}
  onChange={(e) => setMemo(e.target.value)}
  rows={4}
  className="... resize-none"  // ユーザーがサイズ変更できないよう
/>
```

取引詳細シートでも改行が表示されるよう`white-space: pre-wrap`を追加:

```tsx
// TransactionDetailSheet.tsx
<span style={{ color, whiteSpace: preWrap ? 'pre-wrap' : undefined }}>
  {value}
</span>
```

- `pre-wrap`: 文字列内の`\n`を実際の改行としてレンダリング
- `wrap`: 長すぎる場合は自動折り返し（normalと違い空白を保持）

---

## 8. CORSトラブルシューティング

開発環境でPIN認証が失敗した原因はCORSブロックでした。

**原因:**
```
開発Cloud Run FRONTEND_URL = "https://placeholder-dev.vercel.app" (誤った値)
実際の開発フロントエンド = "https://frontend-dev-changwoo-park.vercel.app"
```

バックエンドCORSミドルウェア:
```typescript
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);

if (origin && allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

`frontend-dev-changwoo-park.vercel.app`が許可リストにないためブラウザがAPIレスポンスをブロック → PIN入力が常に失敗しているように見えた。

**解決:**
```bash
gcloud run services update money-manager-dev \
  --update-env-vars="FRONTEND_URL=https://frontend-dev-changwoo-park.vercel.app"
```

---

## 9. HEICフォーマットとiOSブラウザ

iPhoneカメラはデフォルトで**HEIC**フォーマットで撮影します。HEICはClaude APIがサポートしていないフォーマットですが、**iOS Safari/Chromeで`<input type="file">`から画像をアップロードするとき、ブラウザが自動でJPEGに変換**して送信します。

そのため実機では問題ありませんが、MacでHEICファイルを直接選択すると`許可されていない画像形式`エラーが発生します。Macテスト時は`sips`で変換：

```bash
sips -s format jpeg レシート.HEIC --out レシート.jpg
```

---

## 10. 全体データフロー整理

```
[ユーザー] カメラでレシート撮影
     │
     │ File (JPEG、iOSで自動変換)
     ▼
[フロント] FormData作成 → POST /receipts/scan
     │
     │ multipart/form-data (メモリ内Buffer)
     ▼
[バックエンド multer] ファイルパース → req.file.buffer
     │
     │ Buffer + MIMEタイプ
     ▼
[Claude Haiku] base64画像 + プロンプト
     │
     │ {"amount": 5370, "memo": "商品A×1: 500円\n商品B×1: 300円"}
     ▼
[バックエンド] JSONパース → res.json(result)
     │
     │ { amount: 5370, memo: "..." }
     ▼
[フロント] setAmount("5370") + setMemo("商品A×1: 500円\n商品B×1: 300円")
     │
     ▼
[UI] 金額フィールド自動入力 + メモtextareaに改行表示
```
