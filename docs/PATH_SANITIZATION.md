# パス変換によるセキュリティ強化ドキュメント

## 概要
ユーザーに返す出力（エラーメッセージ、実行結果など）にサーバーの内部ディレクトリ構造が表示されないように、すべての出力でパス変換を実施します。

## 問題
PHPプログラムの実行時やエラー発生時に、サーバーの内部パスがそのまま表示されていました：

```
例: /home/user/data/php_editor/sandbox/user123/test.php
```

これにより、以下の情報が漏洩していました：
- サーバーのディレクトリ構造
- 他のユーザーのユーザーID
- システムの構成情報

## 実装された対策

### 1. パス変換関数の強化

#### `sanitizeOutputPaths($output)`
**場所**: `api/file_functions.php`

文字列または配列内のすべてのサーバーパスをユーザーパスに変換します。

**使用例**:
```php
// 文字列の変換
$output = "/home/user/data/php_editor/sandbox/user123/test.php on line 5";
$safe = sanitizeOutputPaths($output);
// 結果: "test.php on line 5"

// 配列の変換
$errors = [
    "Error in /home/user/data/php_editor/sandbox/user123/file1.php",
    "Warning in /home/user/data/php_editor/sandbox/user123/file2.php"
];
$safe = sanitizeOutputPaths($errors);
// 結果: ["Error in file1.php", "Warning in file2.php"]
```

#### `createSafeErrorResponse($message, $context = null)`
**場所**: `api/file_functions.php`

エラーレスポンスを生成する際に、内部パスを自動的に除去します。

**使用例**:
```php
try {
    // 何か処理
} catch (Exception $e) {
    echo json_encode(createSafeErrorResponse($e->getMessage()));
    exit();
}
```

### 2. PHP実行結果のパス変換

#### Debug::executeWithPost()
**場所**: `api/debug.php`

```php
// CGIヘッダーを除去
$output = preg_replace('/^.*?\r?\n\r?\n/s', '', $output, 1);

// サーバーの内部パスをユーザーパスに変換（セキュリティのため）
$output = sanitizeOutputPaths($output);
$errors = sanitizeOutputPaths($errors);
```

**効果**:
- 標準出力からサーバーパスを除去
- 標準エラー出力からサーバーパスを除去

#### Debug::execute()
**場所**: `api/debug.php`

同様に、すべてのHTTPメソッド（GET, POST, PUT, DELETE等）での実行結果からパスを変換します。

### 3. 構文チェック結果のパス変換

#### phpSyntaxError()
**場所**: `api/file_functions.php`

```php
exec("php -l " . shellEscape($serverPath) . " 2>&1", $output, $return);

// サーバーパスをユーザーパスに変換してからHTMLエスケープ
$output = sanitizeOutputPaths($output);
for($i = 0; $i < count($output); $i++){
    $output[$i] = htmlspecialchars($output[$i], ENT_QUOTES);
}
```

**変換例**:
```
変換前:
PHP Parse error:  syntax error, unexpected '}' in /home/user/data/php_editor/sandbox/user123/test.php on line 5

変換後:
PHP Parse error:  syntax error, unexpected '}' in test.php on line 5
```

### 4. 実行結果のパス変換

#### phpRunError()
**場所**: `api/file_functions.php`

```php
exec($command, $output, $return);

// サーバーパスをユーザーパスに変換
$output = sanitizeOutputPaths($output);
if ($realPath) {
    for($i = 0; $i < count($output); $i++){
        $output[$i] = str_replace($realPath, convertServerPath($realPath), $output[$i]);
    }
}
```

**特徴**:
- `realpath()`で解決された絶対パスも変換
- シンボリックリンクの解決後のパスも安全化

#### phpCgiRun()
**場所**: `api/file_functions.php`

```php
exec($command, $output, $return);

// サーバーパスをユーザーパスに変換してからHTMLエスケープ
$output = sanitizeOutputPaths($output);
for($i = 0; $i < count($output); $i++){
    $output[$i] = htmlspecialchars($output[$i], ENT_QUOTES);
}
```

### 5. file_manager.phpでの処理

**場所**: `api/file_manager.php`

Debug::execute()の戻り値は既にパス変換済みなので、HTMLエスケープのみを実施：

```php
// 出力をHTMLエスケープ（パス変換はDebugクラスで既に実施済み）
$outputLines = explode("\n", $result['output']);
for($i = 0; $i < count($outputLines); $i++){
    $outputLines[$i] = htmlspecialchars($outputLines[$i], ENT_QUOTES);
}
```

## パス変換の処理順序

すべての出力で以下の順序で処理を行います：

```
1. プログラム実行/コマンド実行
   ↓
2. サーバーパスをユーザーパスに変換 (sanitizeOutputPaths)
   ↓
3. HTMLエスケープ (htmlspecialchars)
   ↓
4. JSONエンコード
   ↓
5. クライアントに返す
```

## 変換対象のパス

以下のパターンが変換されます：

```php
// ユーザールート: /home/user/data/php_editor/sandbox/user123/

// 変換例:
"/home/user/data/php_editor/sandbox/user123/test.php"
→ "test.php"

"/home/user/data/php_editor/sandbox/user123/dir/file.php"
→ "dir/file.php"

"/home/user/data/php_editor/sandbox/user123/"
→ ""
```

## テスト方法

### 1. 構文エラーのテスト

**test_syntax_error.php**:
```php
<?php
// 意図的な構文エラー
echo "Hello
?>
```

**期待される出力**:
```json
{
  "status": "success",
  "result": true,
  "message": [
    "PHP Parse error:  syntax error, unexpected end of file in test_syntax_error.php on line 3"
  ]
}
```

内部パスは表示されません。

### 2. 実行時エラーのテスト

**test_runtime_error.php**:
```php
<?php
$file = fopen("/etc/passwd", "r"); // open_basedir制限でエラー
?>
```

**期待される出力**:
```json
{
  "status": "success",
  "result": true,
  "message": [
    "Warning: fopen(): open_basedir restriction in effect. File(/etc/passwd) is not within the allowed path(s) in test_runtime_error.php on line 2"
  ]
}
```

サーバーの内部パスは表示されません。

### 3. 例外エラーのテスト

**test_exception.php**:
```php
<?php
throw new Exception("Test error in " . __FILE__);
?>
```

**期待される出力**:
`__FILE__`定数にはサーバーの絶対パスが含まれますが、出力時に変換されます。

### 4. ファイル一覧でのパス確認

```javascript
// クライアント側
API.listFiles("")
```

**期待される結果**:
ファイルパスは常に相対パスで返されます：
```json
{
  "status": "success",
  "files": {
    "name": "/",
    "type": "dir",
    "files": [
      {"name": "test.php", "type": "text"},
      {"name": "dir/file.php", "type": "text"}
    ]
  }
}
```

## エラーメッセージのベストプラクティス

### 推奨される実装

```php
try {
    $serverPath = convertUserPath($userPath);
    // 処理
} catch (Exception $e) {
    logError("Operation failed", ['path' => $userPath, 'error' => $e->getMessage()]);
    echo json_encode(createSafeErrorResponse($e->getMessage()));
    exit();
}
```

### 推奨されない実装

```php
// ❌ 直接エラーメッセージを返す（パスが含まれる可能性）
echo json_encode(["status" => "error", "error" => $e->getMessage()]);

// ❌ サーバーパスをそのまま返す
echo json_encode(["status" => "error", "file" => $serverPath]);
```

## セキュリティ上の利点

### 1. 情報漏洩の防止
- サーバーのディレクトリ構造が隠蔽される
- 他のユーザーの存在やユーザーIDが隠蔽される
- システムの構成情報が隠蔽される

### 2. 攻撃の困難化
- パストラバーサル攻撃の試行が困難になる
- ディレクトリ構造の推測が困難になる
- 標的型攻撃の情報収集が困難になる

### 3. ユーザビリティの向上
- エラーメッセージが簡潔になる
- ユーザーにとって意味のあるパスが表示される
- デバッグが容易になる

## 既知の制限事項

### 1. PHP内部のエラーメッセージ
PHPの内部エラーメッセージ（Fatal errorなど）は、php-cgiの出力として取得できるため、`sanitizeOutputPaths()`で変換されます。

### 2. ログファイル
サーバー内部のログファイル（`/data/php_editor/log/`）には、デバッグのために完全なパスが記録されます。これらのログはユーザーには公開されません。

### 3. open_basedirエラー
`open_basedir`制限によるエラーメッセージには、許可されたパスが含まれますが、これもユーザーのルートディレクトリ内のパスなので問題ありません。

## まとめ

この実装により、以下が達成されました：

✅ すべてのPHP実行結果からサーバーパスを除去
✅ 構文エラーメッセージからサーバーパスを除去
✅ 実行時エラーからサーバーパスを除去
✅ 例外メッセージからサーバーパスを除去
✅ ファイル操作のレスポンスで相対パスを使用
✅ 統一的な`sanitizeOutputPaths()`関数で一元管理

ユーザーは、自分のファイルを基準とした相対パスのみを参照でき、サーバーの内部構造は完全に隠蔽されます。
