# iframe JavaScript エラー表示機能

## 概要

Webページ開発モードで実行されるユーザプログラム（iframe内）で発生したJavaScriptエラーを、エディタ側でキャッチして表示する機能です。

### 主な機能

- 🔍 **自動エラー検出**: iframe内のJSエラーを自動キャッチ
- 📢 **自動通知**: エラー発生時に自動的にコンソールタブを表示
- 🧹 **自動クリーンアップ**: 実行時に前回のエラーを自動クリア
- 📊 **詳細情報**: ファイル名、行番号、スタックトレースを表示
- 🚀 **クライアントサイド完結**: サーバ側の変更不要

## 仕組み

```
┌─────────────────────────────────────────────┐
│ エディタ (localhost:8000/2.php)             │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ IframeErrorHandler                   │  │
│  │  - エラーロガースクリプトを読み込み   │  │
│  │  - HTMLを取得してスクリプトを注入    │  │
│  │  - postMessageでエラーを受信         │  │
│  │  - mConsoleにエラーを表示            │  │
│  └───────────────────────────────────────┘  │
│                    ↕ postMessage()          │
│  ┌───────────────────────────────────────┐  │
│  │ iframe (user-programs実行)           │  │
│  │                                       │  │
│  │  <script> iframe-error-logger.js     │  │
│  │    - window.onerror                  │  │
│  │    - unhandledrejection              │  │
│  │    - console.error                   │  │
│  │         ↓                            │  │
│  │    親ウィンドウへ送信                 │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 実装ファイル

### 1. `/js/iframe-error-logger.js`
- iframe内で動作する軽量エラーロガー
- 以下のエラーをキャッチ:
  - JavaScript実行エラー (window.onerror)
  - 未処理のPromise拒否 (unhandledrejection)
  - console.error の出力
- エラー情報をpostMessageで親ウィンドウに送信

### 2. `/js/modules/core/iframe-error-handler.js`
- エディタ側のエラーハンドラークラス
- 主な機能:
  - エラーロガースクリプトの読み込み
  - ユーザプログラムのHTMLを取得してスクリプトを注入
  - Blob URLを使用してiframeに読み込み
  - postMessageでエラーを受信
  - mConsoleにエラーを表示

### 3. `/js/main.js` (変更箇所)
- IframeErrorHandlerのインポート
- webPreviewer初期化時にエラーハンドラーを作成
- 実行時・リロード時にエラーロガーを注入して読み込み

## 使用方法

### 基本的な使い方

1. エディタで`localhost:8000/2.php`を開く
2. 実行モードを「Webページモード」に設定
3. JavaScriptを含むHTMLファイルを作成・開く
4. 実行ボタンをクリック
5. iframe内でエラーが発生すると、**自動的にコンソールタブが表示され**、エラー詳細が表示される

### 自動コンソール表示機能

- **Webページモード**では、通常コンソールタブは非表示
- **エラー発生時のみ**、自動的にコンソールタブに切り替わる
- エラーの見逃しを防止し、開発効率を向上

### テスト方法

テスト用のHTMLファイルを用意しました:

1. エディタで`/user-programs/test-error.html`を開く
2. 実行ボタンをクリック
3. テストページ内の各ボタンをクリック
4. エディタのコンソールにエラーが表示されることを確認

## エラー表示形式

```
⚠️ [実行エラー] Cannot read property 'someMethod' of null
📍 test-error.html:45:12

TypeError: Cannot read property 'someMethod' of null
    at triggerError1 (test-error.html:45:12)
    at HTMLButtonElement.onclick (test-error.html:23:35)
```

### エラーの種類別アイコン

- ⚠️ JavaScript実行エラー (TypeError, ReferenceError等)
- 🔴 console.error
- 🚫 未処理のPromise拒否

## 技術的な詳細

### エラーロガーの注入プロセス

1. **HTMLの取得**
   ```javascript
   const response = await fetch(url);
   let html = await response.text();
   ```

2. **スクリプトの注入**
   ```javascript
   const injectedScript = `<script>\n${this.errorLoggerScript}\n</script>`;
   html = html.replace('</head>', injectedScript + '</head>');
   ```

3. **Base URLの設定**（相対パスの解決）
   ```javascript
   const baseTag = `<base href="${url}">`;
   html = html.replace('</head>', baseTag + '</head>');
   ```

4. **Blob URLでの読み込み**
   ```javascript
   const blob = new Blob([html], { type: 'text/html' });
   const blobUrl = URL.createObjectURL(blob);
   iframe.src = blobUrl;
   ```

### セキュリティ

- **同一オリジン制約**: `localhost:8000`で統一されているため安全
- **オリジン検証**: postMessage受信時にオリジンを検証
  ```javascript
  if (event.origin !== window.location.origin) return;
  ```

### Content-Type の扱い

- HTML以外のコンテンツ（JSON、画像等）の場合は注入をスキップ
- Content-Typeヘッダーで判定

## 制限事項

1. **同一オリジンのみ対応**
   - 異なるオリジンのiframeではCORS制約により動作しません
   - 現在の構成（localhost:8000）では問題なし

2. **動的に生成されたiframe**
   - ユーザプログラムが内部でiframeを生成した場合、そのiframe内のエラーは捕捉できません

3. **既存のエラーハンドラーとの互換性**
   - ユーザが独自のwindow.onerrorを設定している場合、上書きされる可能性があります
   - addEventListener方式を使用しているため、基本的には共存可能

## トラブルシューティング

### エラーが表示されない場合

1. **ブラウザの開発者ツールで確認**
   ```
   - Consoleタブで「iframe error logger initialized」が表示されているか
   - Networkタブで/js/iframe-error-logger.jsが読み込まれているか
   - postMessageが送信されているか
   ```

2. **Content-Typeを確認**
   ```javascript
   // 開発者コンソールで確認
   fetch('/user-programs/yourfile.php')
     .then(r => console.log(r.headers.get('content-type')))
   ```

3. **同一オリジンか確認**
   ```javascript
   // 開発者コンソールで確認
   console.log(window.location.origin);
   console.log(iframe.contentWindow.location.origin);
   ```

### Blob URLのメモリリーク対策

- リロード時に古いBlob URLは自動的にrevokeされます
- ページ遷移時にも適切にクリーンアップされます

## 今後の拡張可能性

### 実装済み
- ✅ JavaScript実行エラーの捕捉
- ✅ Promise拒否の捕捉
- ✅ console.errorの捕捉
- ✅ エラー情報の表示（ファイル名、行番号、スタックトレース）
- ✅ Content-Type判定
- ✅ Blob URL管理
- ✅ **エラー発生時の自動コンソール表示**（Webページモード）
- ✅ 実行時の自動エラークリア

### 今後の拡張案
- [ ] 専用エラーパネルUI（エラー件数バッジ、エラー一覧）
- [ ] エラーフィルタリング（重複除外、タイプ別フィルター）
- [ ] サーバログへの統合（エラーをサーバにも送信）
- [ ] ソースマップ対応（トランスパイル後のコード対応）
- [ ] エラー発生時のスクリーンショット
- [ ] エラー統計（エラー頻度、エラータイプ分布）

## まとめ

この機能により、以下が実現されました:

1. **ユーザ体験の向上**: ブラウザ開発者ツールを開かなくてもエラーを確認可能
2. **開発効率の向上**: エディタ内でエラーを即座に確認できる
3. **自動通知**: エラー発生時に自動的にコンソールタブに切り替わる
4. **エラー情報の充実**: スタックトレース、ファイル名、行番号を表示
5. **クライアントサイド完結**: サーバ側の変更不要で実装
6. **ストレスフリー**: 実行時に自動的にエラーをクリア、見逃しを防止

開発時のデバッグ作業が大幅に効率化されます！
