# ライブラリ自動ロード機能

## 概要

PHPスクリプト実行時に、ライブラリやComposerのオートローダーを自動的にロードする機能です。

## 使い方

### 1. `_autoload.php` ファイルの作成

ユーザーディレクトリのルート（`user-programs/{あなたのID}/`）に `_autoload.php` ファイルを作成します。

```php
<?php
// user-programs/{あなたのID}/_autoload.php

// Composer autoloader のロード
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}
```

### 2. 自動的にロードされる

`_autoload.php` が存在すると、すべてのPHPスクリプト実行時に自動的にこのファイルが最初に読み込まれます。

## 使用例

### Parsedown ライブラリを使う場合

#### 方法1: Composer を使う（推奨）

```bash
# user-programs/{あなたのID}/ ディレクトリで実行
composer require erusev/parsedown
```

```php
<?php
// user-programs/{あなたのID}/_autoload.php
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}
```

```php
<?php
// user-programs/{あなたのID}/test.php
$parsedown = new Parsedown();
echo $parsedown->text('# Hello World');
```

#### 方法2: 手動でライブラリをダウンロード

```php
<?php
// user-programs/{あなたのID}/_autoload.php

// Parsedown.php を user-programs/{あなたのID}/lib/ に配置
if (file_exists(__DIR__ . '/lib/Parsedown.php')) {
    require_once __DIR__ . '/lib/Parsedown.php';
}
```

### カスタムオートローダーを使う場合

```php
<?php
// user-programs/{あなたのID}/_autoload.php

// lib/ ディレクトリから自動的にクラスをロード
spl_autoload_register(function ($class) {
    $file = __DIR__ . '/lib/' . str_replace('\\', '/', $class) . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});
```

これにより、`lib/MyClass.php` に定義した `MyClass` が自動的にロードされます。

### 共通設定ファイルをロード

```php
<?php
// user-programs/{あなたのID}/_autoload.php

// 共通の設定や定数を定義
define('APP_NAME', 'My Application');
define('APP_VERSION', '1.0.0');

// データベース接続情報など
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}
```

## 注意点

1. **セキュリティ**: `_autoload.php` はすべてのスクリプト実行前に実行されるため、信頼できるコードのみを記述してください

2. **パフォーマンス**: 重い処理を `_autoload.php` に書くと、すべてのスクリプトの実行速度に影響します

3. **エラー処理**: `_autoload.php` でエラーが発生すると、すべてのスクリプトが実行できなくなるため注意してください

4. **パス**: `__DIR__` を使用することで、常にユーザーディレクトリのルートを基準にパスを指定できます

## トラブルシューティング

### ライブラリが見つからない

`_autoload.php` が正しく読み込まれているか確認してください：

```php
<?php
// user-programs/{あなたのID}/_autoload.php
error_log('_autoload.php loaded');

if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    error_log('Composer autoloader found');
    require_once __DIR__ . '/vendor/autoload.php';
} else {
    error_log('Composer autoloader not found');
}
```

### エラーが発生する

`_autoload.php` の内容を一時的に空にして、問題を切り分けてください：

```php
<?php
// user-programs/{あなたのID}/_autoload.php
// 空のファイル（問題の切り分け用）
```

## サンプルファイル

サンプルファイルは `docs/_autoload.php.sample` にあります。このファイルをコピーして使用してください：

```bash
cp docs/_autoload.php.sample user-programs/{あなたのID}/_autoload.php
```
