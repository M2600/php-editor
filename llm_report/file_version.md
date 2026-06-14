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

#### 1. AIターン完了後スナップショット

AIのターンが完了した（`finalizeAssistantResponse()` 終了）時点で現在のファイル状態をコミットする。AIが複数ファイルを変更しても、このコミットに戻すだけでアトミックに取り消せる。

```
コミットメッセージ: "AI task: {ユーザメッセージ先頭80文字}"
タイミング: finalizeAssistantResponse() 完了後（onTurnComplete コールバック）
トリガー: js/main.js の sendAIMessageHandler → onTurnComplete を ai-chat.js に渡す
```

ターン完了後にスナップショットを取ることで、コミットのラベルと内容が一致する（「AI task: M1」コミットにはM1の編集結果が入る）。変更なしの場合はスキップ。

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

### クロスディレクトリについて

AIツールは `validateFilePath()` により現在の `BASE_DIR` 外のファイル編集ができない。手動保存も1ファイル1コミット。クロスディレクトリコミットが発生するのはAIターン前スナップショット（`git add -A`）で未保存の変更が複数ディレクトリにある稀なケースのみ。問題が出た場合はフィルタリング方針を調整できる。

---

## 実装状況

### Phase 1 完了 ✅ — バックエンド基盤 + スナップショット自動記録

#### `api/file_functions.php`
- `fileRecursive()` に `.git` / `.gitignore` のスキップを追加
- `assertNotGitPath()` を追加し、全書き込み関数（saveFile, touchFile, createFileWithContent, makeDirectory, renameFile×2, deleteFile, deleteDirectory）の冒頭で呼び出し
- 末尾にgitヘルパー関数を追加:
  - `ensureGitRepo(string $userDir): bool`
  - `gitCmd(string $userDir, string $userId): string`
  - `gitSnapshot(string $userDir, string $message, string $userId): array`
  - `gitHistory(string $userDir, string $userId, ?string $filterPath, int $limit): array`
  - `gitCommitFiles(string $userDir, string $userId, string $hash): array`
  - `gitRestore(string $userDir, string $userId, string $hash): array`
  - `gitDiff(string $userDir, string $userId, string $hash1, string $hash2, ?string $filterPath): string`
  - `gitShowFile(string $userDir, string $userId, string $hash, string $file): array`（`['found' => bool, 'content' => string, 'error' => string]`）

#### `api/git_manager.php`（新規作成）
- 認証パターン: `session_init.php` → `requireLogin()` → `file_functions.php`
- actions: `snapshot` / `history` / `commit_files` / `restore` / `diff` / `show`
- `show` は `not_found` ステータスを返す（ファイルが存在しない or パス誤りの場合）

#### `js/modules/core/file-manager.js`
- `saveFile()` 成功後に手動保存スナップショット（fire-and-forget）

#### `js/main.js` + `js/modules/ai/ai-chat.js`
- `sendAIMessage()` に `onTurnComplete` コールバックパラメータを追加
- `finalizeAssistantResponse()` 末尾で `onTurnComplete()` を呼び出し
- `sendAIMessageHandler` で `onTurnComplete` としてAIターン完了後スナップショットを登録

---

### Phase 2 完了 ✅ — AIツール

#### `js/modules/ai/toolDefinitions.js`
- `listHistory(file?, limit?)` — 履歴一覧取得。ハッシュは内部処理のみ、ユーザには日時+メッセージで表示する旨をdescriptionに明記
- `showFileAtCommit(hash, file)` — 過去のファイル内容確認
- `restoreSnapshot(hash)` — 指定コミットへの復元

#### `js/modules/ai/ai-tool.js`
- `resolveGitPath(filePath, baseDir)` — BASE_DIR相対パスをgitリポジトリルート相対パスに変換
- `showRestoreConfirmation(editor, files)` — `editor.popupWindow()` を使ったカスタム確認ダイアログ（Promise ベース）
  - キャンセルボタン / X ボタンどちらでも `resolve(false)` → チャットに「ユーザーによりキャンセルしました」を表示
  - 復元ボタンで `resolve(true)` → 復元実行
- `callTool()` に `listHistory` / `showFileAtCommit` / `restoreSnapshot` の分岐を追加

---

### Phase 3 未実装 — 履歴ブラウザUI

ユーザがAIに聞かずに自分で直接操作できる専用UIパネル。

#### 要件
- 現在のディレクトリ（BASE_DIR）に絞った履歴一覧を表示
- ファイル単位の絞り込み切り替え
- 各エントリに「この時点に戻す」ボタン → `restoreSnapshot` を実行（確認ダイアログ付き）
- ハッシュは非表示。日時 + コミットメッセージのみ表示
- ロケーション候補: エクスプローラーのサイドバー or 専用タブ

#### 必要なAPI
- `GET /api/git_manager.php` `{action: "history", file: BASE_DIR, limit: 50}` — 一覧取得
- `GET /api/git_manager.php` `{action: "commit_files", hash}` — 復元前の変更ファイル確認
- `POST /api/git_manager.php` `{action: "restore", hash}` — 復元実行

---

## セキュリティ対策

| 脅威 | 対策 |
|------|------|
| コマンドインジェクション | 全引数に `escapeshellarg()` を適用 |
| ディレクトリ外操作 | `$userDir` は必ず `getUserRoot()` から取得 |
| 偽コミットハッシュ | `/^[0-9a-f]{40}$/i` で拒否 |
| 読み取り専用モード | `canEditFiles()` で snapshot/restore をガード |
| `.git` のブラウザ表示 | `fileRecursive()` でスキップ |
| `.git` への書き込み | `assertNotGitPath()` で全書き込み関数をガード |

---

## 変更ファイル一覧

```
api/
  file_functions.php    — gitヘルパー関数追加、assertNotGitPath、fileRecursiveの.gitスキップ
  git_manager.php       — 新規作成（gitバージョン管理API）
js/
  main.js               — sendAIMessageHandlerにonTurnCompleteコールバック追加
  modules/core/
    file-manager.js     — saveFile()に手動保存スナップショット追加
  modules/ai/
    toolDefinitions.js  — listHistory / showFileAtCommit / restoreSnapshot ツール追加
    ai-tool.js          — resolveGitPath, showRestoreConfirmation, callTool分岐追加
```
