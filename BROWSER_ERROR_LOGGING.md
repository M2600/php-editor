# ブラウザエラーログ機能

PHP Editorにブラウザで発生したJavaScriptエラーをサーバに送信する機能を追加しました。

## 機能概要

- **自動エラーキャッチ**: 未処理のJavaScriptエラーと Promise rejection を自動で検出
- **コンソールエラー監視**: `console.error()` の出力もキャッチ（オプション）
- **詳細な情報収集**: ブラウザ情報、画面サイズ、スタックトレース等を含む
- **リトライ機能**: ネットワークエラー時の自動リトライ
- **サーバサイドログ**: 強化されたログシステムと統合

## ファイル構成

### サーバサイド
- `/api/error_logger.php`: エラーログを受信するAPIエンドポイント
- `/api/logger.php`: 強化されたログシステム（既存）

### クライアントサイド  
- `/js/error-logger.js`: エラーキャッチャーとサーバ送信機能
- `/js/modules/utils/api.js`: API通信エラーもログに記録するよう拡張

### テンプレート
- `/templates/editor.html`: メインエディタにエラーロガー追加
- `/templates/monaco-editor.html`: Monacoエディタにエラーロガー追加

## 使用方法

### 自動エラーキャッチ
ページ読み込み後、自動的にエラーロガーが初期化され、以下のエラーを自動キャッチします：

```javascript
// これらは自動的にサーバに送信されます
throw new Error("テストエラー");
undefined.someMethod(); // TypeError
Promise.reject("未処理のPromise拒否");
```

### 手動エラーログ
特定のエラーやデバッグ情報を手動で送信：

```javascript
// エラーレベルで送信
window.logError('error', 'ファイル保存に失敗しました', {
    filename: 'test.php',
    error_code: 'SAVE_FAILED'
});

// 警告レベルで送信  
window.logError('warning', '大きなファイルを読み込み中', {
    filesize: '10MB'
});

// 情報レベルで送信
window.logError('info', 'ユーザーアクション実行', {
    action: 'file_create',
    path: '/user/test.php'
});
```

### API統合
API呼び出しのエラーも自動的に記録されます：

```javascript
// APIエラーは自動的にログに記録
api('/api/file_manager.php', { action: 'invalid' })
    .catch(error => {
        // このエラーは既にサーバに送信済み
        console.log('API呼び出しが失敗しました');
    });
```

## ログ出力例

サーバのログファイル（`~/data/php_editor/log/php_editor_YYYY-MM-DD.log`）に以下のような形式で記録されます：

```json
{
    "timestamp": "2025-08-13T10:30:45+09:00",
    "level": "ERROR", 
    "message": "Browser: Uncaught TypeError: Cannot read property 'value' of null",
    "context": {
        "client_type": "browser",
        "error_type": "javascript_error",
        "client_timestamp": "2025-08-13T01:30:45.123Z",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
        "remote_addr": "192.168.1.100",
        "session_id": "abc123...",
        "page_url": "https://example.com/editor.php",
        "line_number": 42,
        "column_number": 15,
        "filename": "https://example.com/js/editor.js",
        "stack_trace": "TypeError: Cannot read property...\n    at...",
        "additional_info": {
            "browser": {
                "name": "Chrome",
                "userAgent": "Mozilla/5.0...",
                "language": "ja-JP",
                "platform": "Win32"
            },
            "screen": {"width": 1920, "height": 1080},
            "viewport": {"width": 1200, "height": 800}
        }
    },
    "pid": 12345,
    "session": "user_session_id"
}
```

## エラーレベル

- **ERROR**: JavaScript実行エラー、API呼び出し失敗
- **WARNING**: console.error()の出力、警告レベルの手動ログ
- **INFO**: 情報レベルの手動ログ、ユーザーアクション追跡
- **DEBUG**: デバッグ情報

## 設定オプション

エラーロガーの動作をカスタマイズできます：

```javascript
window.errorLogger = new ErrorLogger({
    apiEndpoint: '/api/error_logger.php',  // APIエンドポイント
    maxRetries: 3,                         // 最大リトライ回数
    retryDelay: 1000,                      // リトライ間隔（ms）
    enableConsoleLog: true                 // console.error監視の有無
});
```

## トラブルシューティング

### エラーが送信されない場合
1. ブラウザの開発者ツールでネットワークタブを確認
2. `/api/error_logger.php` へのPOSTリクエストが送信されているか確認
3. サーバのログファイルでエラーメッセージを確認

### ログファイルが作成されない場合
1. `~/data/php_editor/log/` ディレクトリの書き込み権限を確認
2. PHPのエラーログを確認（`error_log()`の出力）

### セッション関連のエラー
1. セッションが正常に開始されているか確認
2. ログイン状態を確認

この機能により、ユーザーが遭遇したブラウザエラーを詳細に把握でき、問題の特定と解決が大幅に改善されます。
