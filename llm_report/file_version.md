# ファイルバージョン管理 実装計画・実装状況

作成: 2026-06-14

---

## 概要

AIエージェントとユーザの手動編集を対象に、ユーザディレクトリごとのgitリポジトリでバージョン管理を行う。想定ユーザはgit未経験者のため、gitの概念（branch / revert 等）は一切露出させず、「時系列のスナップショット一覧」としてのみ見せる。

---

## 設計方針

### ディレクトリ構成

- gitリポジトリ: ユーザごとに1つ（`getUserRoot()` 配下 = `~/data/php_editor/sandbox/{classAdminId}/{classId}/{userId}/`）
- リポジトリの初期化: 初回スナップショット時にlazy init（`git init`）

### コミット戦略（3種類）

#### 1. AIターン開始前スナップショット

ユーザがAIにメッセージを送信した瞬間に現在のファイル状態をコミットする。AIが複数ファイルを変更しても、このコミットに戻すだけでアトミックに取り消せる。

```
コミットメッセージ: "AI task: {ユーザメッセージ先頭80文字}"
トリガー: js/main.js の sendAIMessageHandler 冒頭（非同期 fire-and-forget）
```

変更なし（`git status --porcelain` が空）の場合はスキップ。

#### 2. 手動保存時コミット

Ctrl+S / 保存ボタンでのファイル保存成功後にコミット。自動保存は実行時のみなのでコミット爆発はない。

```
コミットメッセージ: "manual save: {filepath}"
トリガー: js/modules/core/file-manager.js の saveFile() 成功レスポンス後（非同期 fire-and-forget）
```

#### 3. 復元操作（「復元を新コミットとして記録」方式）

タイムラインは常に1次元で前進する。`git reset --hard` や `git revert` は使わない。

```
S1 → S2 → S3 → S4 → S5(content = S2の状態)

実装:
  git checkout {hash} -- .
  git add -A
  git commit -m "restored to: {元のコミットメッセージ先頭60文字}"
```

「undoのundo」も可能（直前のS4が残っているため）。

### 履歴表示の方針

| 表示モード | gitコマンド | 備考 |
|-----------|------------|------|
| デフォルト（ディレクトリ） | `git log -- {BASE_DIR}` | エクスプローラーの現在ディレクトリで絞り込み |
| ファイル単位 | `git log -- {filepath}` | 現在開いているファイルで絞り込み |
| 全体 | `git log` | （将来対応） |

復元前に `git show {hash} --name-only` で変更ファイル一覧を表示。クロスディレクトリコミット（AIターン前のスナップショットが複数ディレクトリを含む稀なケース）の場合は警告を出す。

### クロスディレクトリについて

AIツールは `validateFilePath()` により現在の `BASE_DIR` 外のファイル編集ができない。手動保存も1ファイル1コミット。クロスディレクトリコミットが発生するのはAIターン前スナップショット（`git add -A`）で未保存の変更が複数ディレクトリにある稀なケースのみ。問題が出た場合はフィルタリング方針を調整できる。

---

## 実装状況

### 完了 ✅

#### `api/file_functions.php`
- `fileRecursive()` に `.git` ディレクトリのスキップを追加（行556）
- 末尾にgitヘルパー関数を追加（行796〜）:
  - `ensureGitRepo(string $userDir): bool` — `.git`がなければ`git init`、`.gitignore`（`*.log`）を自動生成
  - `gitCmd(string $userDir, string $userId): string` — gitコマンドのベース文字列（identity付き）
  - `gitSnapshot(string $userDir, string $message, string $userId): array` — `add -A && commit`（変更なしはスキップ）
  - `gitHistory(string $userDir, string $userId, ?string $filterPath, int $limit): array` — `git log`（パスフィルタ対応）
  - `gitCommitFiles(string $userDir, string $userId, string $hash): array` — コミットの変更ファイル一覧
  - `gitRestore(string $userDir, string $userId, string $hash): array` — 復元を新コミットとして記録
  - `gitDiff(string $userDir, string $userId, string $hash1, string $hash2, ?string $filterPath): string`
  - `gitShowFile(string $userDir, string $userId, string $hash, string $file): string`

#### `api/git_manager.php`（新規作成）
- 認証パターン: `session_init.php` → `requireLogin()` → `file_functions.php`（file_manager.phpと同一）
- 実装済みaction:
  - `snapshot` — `gitSnapshot()` を呼ぶ（`canEditFiles()`チェック）
  - `history` — `gitHistory()` を呼ぶ（`file`パラメータで絞り込み可）
  - `commit_files` — `gitCommitFiles()` を呼ぶ（復元前の変更ファイル確認用）
  - `restore` — `gitRestore()` を呼ぶ（`canEditFiles()`チェック）
  - `diff` — `gitDiff()` を呼ぶ
  - `show` — `gitShowFile()` を呼ぶ

#### `js/modules/core/file-manager.js`
- `saveFile()` の成功レスポンス後（`ret = 1` の直前）に手動保存スナップショットを追加

#### `js/main.js`
- `sendAIMessageHandler` の冒頭にAIターン前スナップショットを追加

### 未実装（Phase 2）

#### AIツール定義への追加（`js/modules/ai/toolDefinitions.js`）
- `listHistory(file?, limit?)` — AIが履歴を確認できる
- `restoreSnapshot(hash, file?)` — AIが指定コミットに復元できる
- `showFileAtCommit(hash, file)` — AIが過去のファイル内容を確認できる

#### `js/modules/ai/ai-tool.js`
- 上記3ツールの`callTool()`分岐追加

#### UIコンポーネント
- 履歴一覧の表示UI（エクスプローラー or チャットパネル）
- 復元前の変更ファイル確認ダイアログ

---

## セキュリティ対策

| 脅威 | 対策 |
|------|------|
| コマンドインジェクション | 全引数に `escapeshellarg()` を適用 |
| ディレクトリ外操作 | `$userDir` は必ず `getUserRoot()` から取得、ユーザ入力から直接生成しない |
| 偽コミットハッシュ | `/^[0-9a-f]{40}$/i` で拒否 |
| 読み取り専用モード（代理ログイン） | `canEditFiles()` で snapshot/restore をガード |
| `.git` のブラウザ表示 | `fileRecursive()` でスキップ済み（`fileList()`はディレクトリ除外で既に対応済み） |

---

## 変更ファイル一覧

```
api/
  file_functions.php    — gitヘルパー関数追加、fileRecursiveの.gitスキップ
  git_manager.php       — 新規作成（gitバージョン管理API）
js/
  main.js               — sendAIMessageHandlerにAIターン前スナップショット追加
  modules/core/
    file-manager.js     — saveFile()に手動保存スナップショット追加
```

---

## 検証方法

1. AIに「新しいファイルを作って」と送信 → `~/data/php_editor/sandbox/{classAdminId}/{classId}/{userId}/.git` が作成される
2. AIがファイルを編集 → `git log` に `"AI task: ..."` コミットが追加される
3. Ctrl+S で手動保存 → `git log` に `"manual save: {filename}"` コミットが追加される
4. `POST /api/git_manager.php {action: "history", file: "subdir/"}` → 絞り込まれたコミット一覧が返る
5. `POST /api/git_manager.php {action: "restore", hash: "{hash}"}` → ファイルが元の状態に戻り、`"restored to: ..."` という新コミットが追加される
6. `.git` がファイルブラウザに表示されないことを確認
