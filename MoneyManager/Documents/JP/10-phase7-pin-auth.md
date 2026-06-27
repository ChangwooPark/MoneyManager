# Phase 7: PIN認証システム

## このフェーズで行ったこと

アプリへの初回アクセス時に4桁のPIN番号を入力しないとメイン画面にアクセスできない
認証システムを実装しました。

---

## 認証フロー全体

```
アプリアクセス
  ↓
AppShell: sessionStorageを確認
  ├─ 認証記録なし → PinScreenを表示
  │     ↓
  │   数字パッドで4桁入力
  │     ↓
  │   バックエンド POST /settings/pin/verify を呼び出し
  │     ├─ 成功 → sessionStorageに保存 → メイン画面
  │     └─ 失敗 → 赤色表示 → 初期化 → 再入力
  │
  └─ 認証記録あり → すぐにメイン画面
```

---

## 作成されたファイル

### `src/components/features/auth/PinScreen.tsx`

ユーザーがPINを入力する画面コンポーネントです。

**主な構成要素：**

```
┌─────────────────────┐
│       家計簿         │  ← アプリタイトル
│  PINを入力してください │  ← 案内文
│                     │
│   ● ● ○ ○          │  ← 入力進行ドット（塗りつぶし/空）
│                     │
│  1   2   3          │
│  4   5   6          │  ← 数字パッド
│  7   8   9          │
│      0   ⌫          │
└─────────────────────┘
```

**4桁入力で即時自動検証：**

```typescript
if (next.length === 4) {
  const { success } = await verifyPin(next);
  if (success) {
    onSuccess();  // 親（AppShell）に成功を通知
  } else {
    setError(true);
    setTimeout(() => { setPin(''); setError(false); }, 600); // 0.6秒後に初期化
  }
}
```

別途確認ボタンを押すことなく、4番目の数字を押した瞬間に検証が始まります。
UX的に素早く自然な方式です。

**エラーフィードバック：**

| 状態 | ドット色 | ボーダー色 |
|------|---------|-----------|
| 初期 | 紫（accent） | 紫 |
| 入力中 | 紫（塗りつぶし） | 紫 |
| エラー | 赤（expense） | 赤 |

---

### `src/components/AppShell.tsx`

アプリ全体を包む認証状態管理コンポーネントです。

**役割：**
- アプリが最初にロードされる際に`sessionStorage`を確認
- 認証状態に応じて`PinScreen`またはメイン画面をレンダリング

```typescript
const SESSION_KEY = 'mm_verified';

useEffect(() => {
  const stored = sessionStorage.getItem(SESSION_KEY);
  setVerified(stored === 'true');
}, []);

const handleSuccess = () => {
  sessionStorage.setItem(SESSION_KEY, 'true');  // セッションに保存
  setVerified(true);
};
```

**ローディングスピナーの理由：**

`verified`の初期値が`null`である理由があります。
`sessionStorage`はブラウザでのみアクセス可能なため、
サーバーでレンダリングされる際は常に`null`です。
`useEffect`が実行された後（クライアントロード完了後）にのみ実際の値がわかります。

```
サーバーレンダリング: verified = null → スピナー表示
    ↓
クライアントロード: useEffect実行 → sessionStorageを確認
    ↓
verified = true  → メイン画面
verified = false → PIN画面
```

この処理がないと画面が一瞬チラつく現象（Flash of Unauthenticated Content）が発生します。

---

## sessionStorageとは？

ブラウザにデータを一時保存するスペースです。

| ストレージ | 保持期間 | 特徴 |
|--------|---------|------|
| `sessionStorage` | タブが開いている間 | タブを閉じると削除 |
| `localStorage` | 永続的 | 直接削除しない限り保持 |
| Cookie | 設定した有効期限まで | サーバーにも送信される |

このプロジェクトで`sessionStorage`を選択した理由：
- タブを閉じると自動的に認証が解除される（セキュリティ）
- 同じタブ内ではページをリロードしても保持される（利便性）
- カップル専用アプリなので複雑なJWTトークン方式は不要

---

## 'use client' ディレクティブとは？

```typescript
'use client';  // ファイルの先頭に宣言
```

Next.js App Routerでは、デフォルトで全てのコンポーネントが**サーバーコンポーネント**です。
サーバーでレンダリングされるため、ブラウザAPI（`sessionStorage`、`useState`、`useEffect`など）は使用できません。

`'use client'`を宣言すると、そのコンポーネントは**クライアントコンポーネント**となり
ブラウザで実行され全てのブラウザAPIが使用できます。

| 区分 | サーバーコンポーネント | クライアントコンポーネント |
|------|-------------|------------------|
| 宣言 | デフォルト（宣言不要） | `'use client'` が必要 |
| 実行場所 | サーバー | ブラウザ |
| useState使用 | 不可 | 可能 |
| sessionStorage使用 | 不可 | 可能 |
| SEO | 有利 | 不利 |

`PinScreen`と`AppShell`はともに`useState`、`useEffect`、ブラウザAPIを使用するため
`'use client'`が必要です。

---

## PIN変更機能の状況

| 区分 | 状態 |
|------|------|
| バックエンドAPI（`PUT /settings/pin`） | ✅ Phase 6で実装済み |
| フロントエンドUI | ⏳ Phase 13（もっとみるタブ）で実装予定 |

バックエンドはすでに準備済みで、UIのみ残っている状態です。
