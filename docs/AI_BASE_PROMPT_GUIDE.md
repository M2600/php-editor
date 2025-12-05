# AIベースプロンプト - ツール使用ガイド

## 概要

AIがツール（`searchFiles`, `readFile`, `editFile`等）を効率的に使用できるよう、ベースプロンプトに詳細なガイダンスを追加しました。

## 実装場所

### 1. ベースプロンプト（サーバー側）
- **ファイル**: `/api/ai.php`
- **変更箇所**: `$basePrompt` 配列
- **効果**: すべてのAIリクエストに自動適用

### 2. UI改善（クライアント側）
- **ファイル**: `/MEditor/MEditor.js`
- **変更箇所**: カスタムプロンプト入力欄
- **効果**: ユーザーがヘルプを参照しやすくなる

### 3. ドキュメント
- **テンプレート集**: `/docs/AI_CUSTOM_PROMPT_TEMPLATES.md`
- **圧縮機能ガイド**: `/docs/AI_CONTEXT_COMPRESSION.md`

## ベースプロンプトの内容

### 主要な指示事項

1. **調査フェーズ（3ステップ）**
   - ステップ1: `searchFiles` でファイル・関数を検索
   - ステップ2: `readFile`（パラメータなし）で構造を把握
   - ステップ3: `readFile`（行範囲指定）で必要な部分のみ取得

2. **編集フェーズ**
   - 編集前に必ず `readFile` で現在の内容を確認
   - 変更後も `readFile` で確認
   - 適切なツールを選択（`editFileByReplace`, `editFileByLines`, `createFile`）

3. **効率化のルール**
   - 100行超のファイルは段階的に読み込む
   - 複数ファイルは1つずつ調査
   - 不要な情報は読み込まない（最小限の原則）

4. **禁止事項**
   - いきなり大きなファイルを全て読み込む
   - 検索せずに複数ファイルを総当たり
   - 構造確認せずに編集
   - 行範囲指定を使わない
   - 同じファイルを何度も全体読み込み

5. **ツールの優先順位**
   1. `searchFiles` （まず検索で絞り込む）
   2. `readFile`（構造のみ） （全体像を把握）
   3. `readFile`（行範囲指定） （必要部分のみ）
   4. 編集系ツール （確実な情報を得てから）

## 期待される効果

### 1. コンテキスト効率の向上
- **従来**: 複数の大きなファイルを全て読み込み → 数十KB消費
- **改善後**: 検索→構造確認→部分読み込み → 数KB消費
- **効果**: 約10〜20倍の効率化

### 2. 精度の向上
- 必要な情報のみに集中できる
- 無関係な情報による混乱を防止
- より正確なコード編集が可能

### 3. 速度の向上
- サーバー負荷の軽減（クライアント側処理）
- ネットワーク転送量の削減
- レスポンス時間の短縮

## 使用例

### 例1: 関数の修正

```
ユーザー: "calculateTotal関数を修正して消費税計算を追加して"

AI思考プロセス（ベースプロンプトに従う）:
1. searchFiles("function calculateTotal", searchIn="content")
   → lib/calculator.php の50行目に発見
   
2. readFile("lib/calculator.php")
   → 構造確認: 5つの関数、200行
   
3. readFile("lib/calculator.php", startLine=45, endLine=65)
   → calculateTotal関数のみ取得
   
4. editFileByReplace(...) で関数を修正
   
5. readFile("lib/calculator.php", startLine=45, endLine=70)
   → 修正内容を確認
```

### 例2: バグ調査

```
ユーザー: "エラーログに出てるNullPointerExceptionを修正して"

AI思考プロセス:
1. searchFiles("NullPointerException", searchIn="content", filePattern="*.log")
   → error.log の125行目に発見
   
2. searchFiles("handleUserData", searchIn="content")
   → api/user.php の80行目に該当関数
   
3. readFile("api/user.php")
   → 構造確認: UserManager クラス
   
4. readFile("api/user.php", startLine=75, endLine=95)
   → 問題の関数を確認
   
5. readFile("api/user.php", startLine=60, endLine=75)
   → 呼び出し元も確認
   
6. editFileByReplace(...) でnullチェックを追加
```

## カスタマイズ方法

### ユーザー独自のルールを追加したい場合

AI設定画面で「カスタムプロンプト」を有効にして追加：

```
# 追加ルール
- すべてのPHPファイルには必ずセキュリティチェックを含める
- 関数には必ずPHPDocコメントを付ける
- エラーハンドリングは try-catch で統一

# ツール使用
ベースプロンプトのツール使用ルールに従いつつ、
セキュリティ観点でのチェックを常に実施する
```

### プロジェクト固有のワークフロー

```
# このプロジェクト専用ルール
- データベースは使わず、JSONファイルで永続化
- セッション管理は必ず session_init.php を使用
- APIレスポンスは必ず JSON 形式

# ファイル構造
- /api/*.php: バックエンドAPI
- /js/*.js: フロントエンドスクリプト
- /css/*.css: スタイル
```

## トラブルシューティング

### AIがツールを使わない
→ AI設定で「ツールを使用する」がONになっているか確認

### AIが大きなファイルを全て読み込む
→ カスタムプロンプトで「段階的に読み込む」を明示的に指示

### 検索結果が多すぎる
→ `filePattern` で絞り込むようAIに指示
→ より具体的なキーワードで検索するよう依頼

## 関連ドキュメント

- [AI_CONTEXT_COMPRESSION.md](./AI_CONTEXT_COMPRESSION.md) - 圧縮機能の詳細
- [AI_CUSTOM_PROMPT_TEMPLATES.md](./AI_CUSTOM_PROMPT_TEMPLATES.md) - カスタムプロンプトのテンプレート集

## バージョン情報

- 実装日: 2025-12-05
- バージョン: 1.0.0
- 対象ファイル: 
  - `api/ai.php` (ベースプロンプト)
  - `MEditor/MEditor.js` (UI改善)
  - `docs/AI_CUSTOM_PROMPT_TEMPLATES.md` (テンプレート集)
