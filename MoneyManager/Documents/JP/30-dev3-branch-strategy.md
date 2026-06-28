# Phase Dev-3 — GitHubブランチ戦略構成 学習ドキュメント

## 概要

本番(main)と開発(develop)ブランチを分離し、mainブランチに保護ルールを適用した過程を説明します。

---

## 1. ブランチ戦略が必要な理由

ブランチ(Branch)は、同じコードベースで**独立した作業スペース**を作るGitの機能です。

ブランチを分けないと：
- 開発中の未完成コードがそのまま本番にデプロイされる可能性がある
- バグが発生したとき、どの変更が原因か追跡しづらい
- 機能開発中に緊急修正が必要になったときコードが混在する

---

## 2. ブランチ構成

```
main ────────────────────────────────▶  本番サーバー (Production)
  │
  └── develop ──────────────────────▶  開発サーバー (Development)
```

| ブランチ | 用途 | デプロイ先 | 直接push |
|----------|------|-----------|----------|
| `main` | 検証済みコードのみマージ | 本番サーバー | ❌ 禁止（保護ルール） |
| `develop` | 機能開発・テスト | 開発サーバー | ✅ 許可 |

---

## 3. developブランチの作成

```bash
# mainブランチを基準にdevelopブランチを作成して切り替え
git checkout -b develop

# GitHubリモートリポジトリにpushしてトラッキングブランチを設定
# -u オプション: 以降のgit push/pullでorigin/developを自動参照
git push -u origin develop
```

### `-u` オプションとは

`--set-upstream` の略です。
このオプションなしで `git push origin develop` とすると毎回フルパスを書く必要がありますが、`-u` を一度使えば以降は `git push` だけで同じ動作をします。

---

## 4. mainブランチの保護ルール設定

### 設定内容

```bash
gh api repos/ChangwooPark/MoneyManager/branches/main/protection \
  --method PUT \
  --field allow_force_pushes=false \   # force push禁止
  --field allow_deletions=false        # ブランチ削除禁止
```

### force pushとは

通常のpushは既存のコミットの上に新しいコミットを積み重ねます。
force push（`git push --force`）はリモートのコミット履歴を**強制的に上書き**します。

```
通常のpush:   A → B → C → D（新しいコミットを追加）
force push:   A → B → C → D を A → E に上書き（B, C, Dの記録を削除）
```

本番ブランチでforce pushが発生するとデプロイ履歴が消えロールバックが不可能になるため、必ず禁止します。

### GitHub UIで確認する方法

```
リポジトリ → Settings → Branches → Branch protection rules
→ mainのルール項目を確認
```

---

## 5. 設定結果の確認

```bash
gh api repos/ChangwooPark/MoneyManager/branches \
  --jq '.[] | {name: .name, protected: .protected}'
```

```json
{"name": "develop", "protected": false}
{"name": "main",    "protected": true}
```

- `main`: 保護適用 ✅
- `develop`: 保護なし（個人プロジェクト、自由にpush可能）✅

---

## 6. 日常的な開発フロー

```bash
# 1. developブランチに切り替え
git checkout develop

# 2. 機能開発・コミット
git add .
git commit -m "Feat: 新機能追加"

# 3. 開発サーバーに反映（GitHub Actionsが自動デプロイ）
git push origin develop

# 4. 開発サーバーで確認後、本番に反映するとき
git checkout main
git merge develop
git push origin main   # 本番デプロイ開始
```

---

## 7. 重要概念まとめ

| 概念 | 説明 |
|------|------|
| ブランチ(Branch) | 同じコードベースで独立した作業スペースを作るGitの機能 |
| `git checkout -b` | 新しいブランチを作成して同時に切り替えるコマンド |
| `git push -u` | リモートブランチを作成してトラッキング関係を設定（以降はgit pushのみで動作） |
| ブランチ保護ルール | 特定ブランチへのforce push・削除などの危険な操作をGitHubレベルでブロックする設定 |
| force push | リモートのコミット履歴を強制上書きする危険なpush。本番ブランチでは必ず禁止 |
| PR(Pull Request) | あるブランチの変更を別ブランチにマージ要求するGitHubの機能。コードレビューの基本単位 |
