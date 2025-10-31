# エクスプローラー自動リロード機能

## 概要

ファイルエクスプローラーを定期的に自動リロードする機能です。複数の環境で同時に編集する場合や、外部ツールでファイルを変更する場合に便利です。

また、**プログラム実行後の自動リロード機能**も搭載しており、PHPプログラムがファイルを生成・変更した場合に自動的にエクスプローラーが更新されます。

## 設定

### デフォルト設定

`js/modules/core/config.js`で設定可能：

```javascript
export const CONFIG = {
    // ...
    EXPLORER_AUTO_RELOAD_INTERVAL: 5000, // 5秒 (ミリ秒単位)
    RELOAD_EXPLORER_AFTER_EXECUTION: true, // プログラム実行後にリロードするか
    RELOAD_EXPLORER_EXECUTION_DELAY: 1500, // 実行後のリロード遅延時間（ミリ秒）
    // ...
};
```

#### 定期リロード設定
- **EXPLORER_AUTO_RELOAD_INTERVAL**
  - **0**: 自動リロード無効
  - **正の数値**: リロード間隔（ミリ秒）

#### プログラム実行後リロード設定
- **RELOAD_EXPLORER_AFTER_EXECUTION**
  - **true**: プログラム実行後にエクスプローラーをリロード（デフォルト）
  - **false**: リロードしない

- **RELOAD_EXPLORER_EXECUTION_DELAY**
  - プログラム実行完了後、何ミリ秒待ってからリロードするか
  - デフォルト: `1500` (1.5秒)
  - ファイルシステムの変更が確実に反映されるための遅延

### 推奨設定

- **開発環境**: `30000` (30秒) - デフォルト
- **本番環境**: `60000` (60秒) または無効 (`0`)
- **高頻度変更**: `10000` (10秒)

## 使い方

### 基本操作

自動リロードはアプリケーション起動時に自動的に開始されます。

### ブラウザコンソールからの操作

開発者ツールのコンソールで以下のコマンドが使用可能：

#### 設定を確認
```javascript
explorerAutoReload.getConfig()
// 出力例:
// {
//   interval: 30000,
//   enabled: true,
//   isRunning: true,
//   lastReloadTime: 1729012345678,
//   timeUntilNextReload: 15432
// }
```

#### 自動リロードを一時停止
```javascript
explorerAutoReload.stop()
```

#### 自動リロードを再開
```javascript
explorerAutoReload.start()
```

#### 即座にリロード実行
```javascript
explorerAutoReload.reload()
```

#### リロード間隔を変更
```javascript
// 60秒に変更
explorerAutoReload.setInterval(60000)

// 無効化
explorerAutoReload.setInterval(0)
```

#### 有効/無効を切り替え
```javascript
// 無効化
explorerAutoReload.setEnabled(false)

// 有効化
explorerAutoReload.setEnabled(true)
```

#### 次のリロードまでの残り時間を確認
```javascript
const remaining = explorerAutoReload.getTimeUntilNextReload()
console.log(`次のリロードまで ${Math.round(remaining / 1000)} 秒`)
```

#### 特定時間後にリロード実行（一回限り）
```javascript
// 5秒後にリロード
explorerAutoReload.reloadAfter(5000)

// 1分後にリロード
explorerAutoReload.reloadAfter(60000)

// Promiseとして扱える
explorerAutoReload.reloadAfter(3000)
    .then(() => console.log('リロード完了'))
    .catch(err => console.error('リロード失敗', err))

// async/awaitも使用可能
await explorerAutoReload.reloadAfter(2000)
```

#### スケジュールされたリロードをキャンセル
```javascript
// リロードをスケジュール
explorerAutoReload.reloadAfter(10000)

// 実行前にキャンセル
explorerAutoReload.cancelScheduledReload()

// キャンセルされたかどうか確認
const cancelled = explorerAutoReload.cancelScheduledReload()
console.log(cancelled ? 'キャンセルされました' : 'スケジュールされたリロードはありません')
```

#### スケジュールされたリロードの存在確認
```javascript
if (explorerAutoReload.hasScheduledReload()) {
    console.log('リロードがスケジュールされています')
}
```

## 機能詳細

### リロードのタイミング

#### 1. 定期的な自動リロード
- アプリケーション起動時から開始
- 設定された間隔で自動的にリロード
- 手動リロード（リロードボタン）は自動リロードのタイマーに影響しない

#### 2. プログラム実行後の自動リロード
- PHPプログラムの実行完了後に自動的にリロード
- **API開発モード**（デバッグ実行）と**Webページモード**の両方で動作
- ファイル生成・変更・削除が行われる可能性があるプログラムに対応
- デフォルトで1.5秒の遅延後にリロード（設定可能）

**リロードされるケース:**
- プログラムが新しいファイルを作成した
- プログラムがファイルを変更した
- プログラムがファイルを削除した
- プログラムがディレクトリを作成・削除した

### パフォーマンスへの影響

- 軽量な処理（APIリクエスト1回のみ）
- バックグラウンドで実行
- ユーザー操作を妨げない
- 実行後リロードは一回限り（定期リロードとは独立）

### セキュリティ

- セッション認証済みのAPIを使用
- 既存のセキュリティ機構に依存

## トラブルシューティング

### 自動リロードが動作しない

1. 設定を確認
   ```javascript
   console.log(CONFIG.EXPLORER_AUTO_RELOAD_INTERVAL)
   ```

2. 状態を確認
   ```javascript
   explorerAutoReload.getConfig()
   ```

3. 手動で開始
   ```javascript
   explorerAutoReload.start()
   ```

### リロード間隔が適切でない

```javascript
// 間隔を変更（例: 15秒）
explorerAutoReload.setInterval(15000)
```

### デバッグログを有効化

```javascript
explorerAutoReload.debug = true
```

## API リファレンス

### ExplorerAutoReload クラス

#### コンストラクタ
```javascript
new ExplorerAutoReload({
    interval: 30000,    // リロード間隔（ミリ秒）
    enabled: true,      // 有効/無効
    debug: false        // デバッグログ
})
```

#### メソッド

##### start()
自動リロードを開始

##### stop()
自動リロードを停止

##### reload()
即座にリロードを実行（Promise）

##### reloadAfter(delay)
指定時間後にリロードを実行（一回限り）
- `delay`: 遅延時間（ミリ秒）
- 戻り値: Promise（リロード完了/失敗を返す）
- 既存のスケジュールは自動的にキャンセルされる

##### cancelScheduledReload()
スケジュールされたリロードをキャンセル
- 戻り値: `true`（キャンセル成功）、`false`（スケジュールなし）

##### hasScheduledReload()
スケジュールされたリロードが存在するか確認
- 戻り値: `boolean`

##### setInterval(interval)
リロード間隔を変更
- `interval`: ミリ秒単位の間隔

##### setEnabled(enabled)
有効/無効を切り替え
- `enabled`: `true`で有効、`false`で無効

##### isRunning()
動作中かどうかを返す（boolean）

##### getLastReloadTime()
最後のリロード時刻を返す（タイムスタンプまたはnull）

##### getTimeUntilNextReload()
次のリロードまでの残り時間を返す（ミリ秒またはnull）

##### getConfig()
現在の設定と状態を返す（Object）

## 使用例

### シナリオ1: 開発中に複数環境で作業

```javascript
// 高頻度でリロード（10秒）
explorerAutoReload.setInterval(10000)
```

### シナリオ2: 本番環境で自動リロード無効化

```javascript
// 無効化
explorerAutoReload.setEnabled(false)
```

### シナリオ3: 一時的に停止して再開

```javascript
// 作業中は停止
explorerAutoReload.stop()

// ... 作業 ...

// 再開
explorerAutoReload.start()
```

### シナリオ4: プログラム実行後の自動リロードを無効化

プログラムがファイルを生成しないことがわかっている場合：

```javascript
// config.jsで設定
export const CONFIG = {
    // ...
    RELOAD_EXPLORER_AFTER_EXECUTION: false,
    // ...
};
```

またはブラウザコンソールで一時的に変更：
```javascript
CONFIG.RELOAD_EXPLORER_AFTER_EXECUTION = false
```

### シナリオ5: ファイル保存後に少し待ってからリロード

```javascript
// ファイル保存処理
await saveFile(...)

// 3秒後にリロードして変更を確認
await explorerAutoReload.reloadAfter(3000)
```

### シナリオ5: 長時間の処理後に一度だけリロード

```javascript
// 自動リロードを停止
explorerAutoReload.stop()

// 長時間の処理を実行
await performLongRunningTask()

// 10秒後にリロードして、その後自動リロードを再開
await explorerAutoReload.reloadAfter(10000)
explorerAutoReload.start()
```

### シナリオ6: 条件付きでスケジュールをキャンセル

```javascript
// 30秒後にリロードをスケジュール
explorerAutoReload.reloadAfter(30000)

// ユーザーが手動でリロードした場合はキャンセル
if (userClickedReloadButton) {
    explorerAutoReload.cancelScheduledReload()
    await explorerAutoReload.reload() // 即座にリロード
}
```

## プログラム実行後リロードの実用例

### 例1: ファイル生成プログラム

```php
<?php
// output.txt を生成するプログラム
file_put_contents('output.txt', 'Hello, World!');
echo "ファイルを生成しました";
?>
```

実行後、自動的にエクスプローラーがリロードされ、`output.txt`が表示されます。

### 例2: ログファイル生成

```php
<?php
// ログファイルを作成
$logFile = 'logs/app.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0777, true);
}
file_put_contents($logFile, date('Y-m-d H:i:s') . " - Application started\n", FILE_APPEND);
echo "ログを記録しました";
?>
```

実行後、`logs/`ディレクトリと`app.log`が自動的に表示されます。

### 例3: 画像処理

```php
<?php
// 画像をリサイズして保存
$source = 'original.jpg';
$dest = 'thumbnail.jpg';

$img = imagecreatefromjpeg($source);
$thumb = imagescale($img, 200);
imagejpeg($thumb, $dest);

echo "サムネイルを生成しました";
?>
```

実行後、`thumbnail.jpg`が自動的にエクスプローラーに表示されます。

## 注意事項

- 自動リロードは現在表示中のディレクトリのみをリロードします
- 開いているファイルには影響しません（保存されていない変更は保持されます）
- ネットワークエラー時は自動的にリトライしません（次の間隔で再試行）
- 間隔を短くしすぎるとサーバー負荷が増加する可能性があります
- プログラム実行後リロードは、ファイル変更を検知するのではなく、実行完了を契機にリロードします

## 今後の拡張案

- [ ] UIでの設定変更
- [ ] エラー時の自動リトライ
- [ ] 開いているファイルの変更検知と通知
- [ ] リロード時のビジュアルフィードバック
- [ ] ユーザー設定への保存
