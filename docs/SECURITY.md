# セキュリティ対策ドキュメント

## 概要
このドキュメントでは、PHPEditorに実装されているセキュリティ対策について説明します。

## パストラバーサル攻撃の防止

### 問題
ユーザーが`../`を使用して親ディレクトリにアクセスし、他のユーザーのファイルにアクセスできる可能性がありました。

例: `/user-programs/{userId}/../../{otherUserId}/secret.txt`

### 実装された対策

#### 1. パス検証関数 `isPathInUserRoot()`
**場所**: `api/file_functions.php`

```php
function isPathInUserRoot($path, $userRoot)
```

**機能**:
- `realpath()`を使用してパスを正規化
- パスがユーザーのルートディレクトリ内にあるか検証
- ディレクトリトラバーサル攻撃を検出してログに記録

**動作**:
1. パスを絶対パスに変換（シンボリックリンクも解決）
2. ユーザールートディレクトリと比較
3. パスがユーザールート配下にない場合はfalseを返す
4. 不正なアクセス試行をログに記録

#### 2. 強化された `convertUserPath()` 関数
**場所**: `api/file_functions.php`

```php
function convertUserPath($path)
```

**変更点**:
- すべてのパスに対して`isPathInUserRoot()`を呼び出し
- パストラバーサル検出時に例外をスロー
- セキュリティ違反をログに記録

**例外処理**:
```php
throw new Exception("Access denied: Path is outside user directory");
```

#### 3. ファイル操作APIのエラーハンドリング
**場所**: `api/file_manager.php`, `api/file_upload.php`

**実装**:
- すべてのファイル操作をtry-catchブロックで囲む
- `convertUserPath()`の例外をキャッチ
- セキュリティエラーをログに記録
- クライアントには詳細を隠した一般的なエラーメッセージを返す

**エラーレスポンス例**:
```json
{
  "status": "error",
  "error": "Access denied or invalid operation"
}
```

#### 4. PHP実行時のディレクトリ制限
**場所**: `api/debug.php`

**実装**:
- `php-cgi`実行時に`open_basedir`オプションを動的に設定
- ユーザープログラムは自分のディレクトリ外にアクセス不可

**コマンド例**:
```bash
php-cgi -d open_basedir=/path/to/user/root/ /path/to/script.php
```

**効果**:
- ユーザープログラムが`fopen()`, `file_get_contents()`などで他ユーザーのファイルにアクセスしようとしても失敗
- PHPの`include`, `require`も制限される

## セッション分離

### ユーザープログラムとエディタのセッション分離
**場所**: `user-programs/php.ini`, `api/session_init.php`

**設定**:
```ini
; エディタ
session.name = PHP_EDITOR_SID

; ユーザープログラム
session.name = USER_PROGRAM_SID
```

**効果**:
- ユーザープログラムがエディタのセッションを盗聴できない
- セッションCookieの漏洩を防止

## ログとモニタリング

### セキュリティイベントのログ記録
**場所**: `api/logger.php`

**記録される情報**:
1. パストラバーサル試行の検出
2. 不正なパスアクセスの試行
3. ファイル操作の失敗
4. ユーザーID、試行されたパス、実パス

**ログレベル**:
- `WARNING`: パストラバーサル試行検出時
- `ERROR`: ファイル操作の失敗
- `INFO`: 通常のファイル操作

**ログ例**:
```
[2025-10-16 12:34:56] WARNING: Path traversal attempt detected
  attempted_path: ../../other_user/secret.txt
  real_path: /data/php_editor/sandbox/other_user/secret.txt
  user_root: /data/php_editor/sandbox/current_user/
  user_id: user123
```

## 認証とアクセス制御

### 統一されたセッション初期化
**場所**: `api/session_init.php`

**機能**:
```php
requireLogin()  // すべてのAPIで認証を強制
```

**適用範囲**:
- `api/file_manager.php`
- `api/file_upload.php`
- その他すべてのAPIエンドポイント

### セッションCookieの設定
```php
session.cookie_httponly = 1  // JavaScriptからアクセス不可
session.cookie_samesite = Strict  // CSRF攻撃を防止
session.cookie_secure = 1  // HTTPS通信時のみ（本番環境）
```

## テスト方法

### パストラバーサルのテスト

#### 1. 基本的な親ディレクトリアクセス
```bash
curl -X POST http://localhost/api/file_manager.php \
  -H "Content-Type: application/json" \
  -d '{"action":"get","path":"../other_user/file.txt"}'
```

**期待される結果**: `"error": "Access denied or invalid operation"`

#### 2. 複数の親ディレクトリアクセス
```bash
curl -X POST http://localhost/api/file_manager.php \
  -H "Content-Type: application/json" \
  -d '{"action":"get","path":"../../../../../../etc/passwd"}'
```

**期待される結果**: `"error": "Access denied or invalid operation"`

#### 3. エンコードされたパストラバーサル
```bash
curl -X POST http://localhost/api/file_manager.php \
  -H "Content-Type: application/json" \
  -d '{"action":"get","path":"%2e%2e%2fother_user%2ffile.txt"}'
```

**期待される結果**: `"error": "Access denied or invalid operation"`

#### 4. ユーザープログラムからのアクセステスト
```php
<?php
// test_security.php
// このファイルを実行して、他ユーザーのファイルにアクセスできないことを確認

// パストラバーサル試行
$files_to_test = [
    '../other_user/file.txt',
    '../../other_user/file.txt',
    '../../../etc/passwd'
];

foreach ($files_to_test as $file) {
    echo "Testing: $file\n";
    if (file_exists($file)) {
        echo "  WARNING: File accessible!\n";
    } else {
        echo "  OK: Access denied\n";
    }
    
    // 読み取り試行
    $content = @file_get_contents($file);
    if ($content !== false) {
        echo "  WARNING: File readable!\n";
    } else {
        echo "  OK: Cannot read\n";
    }
    echo "\n";
}
?>
```

**期待される結果**: すべて "OK: Access denied" または PHPのopen_basedirエラー

## セキュリティのベストプラクティス

### 開発者向け

1. **パス処理時は必ず `convertUserPath()` を使用**
   - 直接パスを構築しない
   - `realpath()`による検証を信頼

2. **エラーメッセージに機密情報を含めない**
   - パスの詳細をクライアントに返さない
   - 一般的なエラーメッセージを使用

3. **すべてのファイル操作を try-catch で囲む**
   - 予期しない例外を適切に処理
   - セキュリティ違反をログに記録

4. **ログレベルを適切に使用**
   - `WARNING`: セキュリティ関連の異常
   - `ERROR`: 操作の失敗
   - `INFO`: 通常の操作

### デプロイ時の確認事項

1. ✅ `open_basedir` が設定されているか確認
2. ✅ セッション名が分離されているか確認
3. ✅ HTTPS環境で `session.cookie_secure = 1` が設定されているか
4. ✅ ログファイルのパーミッションが適切か（所有者のみ読み書き可能）
5. ✅ ユーザーディレクトリのパーミッションが適切か

## 既知の制限事項

### 1. realpath()の制限
- ファイルが存在しない場合、`realpath()`はfalseを返す
- この場合、親ディレクトリで検証を行う
- 完全なパス検証には実装の複雑さが増す

### 2. シンボリックリンク
- `realpath()`はシンボリックリンクを解決する
- ユーザーがシンボリックリンクを作成して他のディレクトリにアクセスしようとしても防止される

### 3. パフォーマンス
- `realpath()`は実際にファイルシステムにアクセスするため、若干のオーバーヘッドがある
- しかし、セキュリティのためには必要なコスト

## 将来の改善案

1. **サブドメイン分離の実装**
   - エディタ: `editor.example.com`
   - ユーザープログラム: `user-programs.example.com`
   - Cookie完全分離

2. **レート制限の実装**
   - セキュリティ違反の連続試行を検出
   - IPアドレスベースの一時的なブロック

3. **監査ログの強化**
   - すべてのファイルアクセスを記録
   - 定期的なセキュリティレポート生成

4. **コンテナ分離**
   - ユーザーごとに独立したコンテナで実行
   - より強力な分離を実現

## まとめ

この実装により、以下のセキュリティ対策が実現されています:

✅ パストラバーサル攻撃の防止
✅ ユーザー間のファイルアクセス制御
✅ セッション分離
✅ 実行時のディレクトリ制限（open_basedir）
✅ セキュリティイベントのログ記録
✅ 適切なエラーハンドリング

これらの対策により、ユーザーは自分のディレクトリ内のファイルのみにアクセスでき、他のユーザーのファイルにはアクセスできません。
