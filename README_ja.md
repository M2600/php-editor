# php-editor
プログラミング教育用PHPエディタ

## 機能
- シンタックスハイライト機能付きWeb ベースPHPコードエディタ
- 完全なCRUD操作対応ファイル管理システム
- LMStudio統合によるAI駆動コーディングアシスタント
- ファイルコンテキスト認識機能付きインタラクティブAIチャット
- ブラウザセッション間でのチャット履歴永続化
- リアルタイム構文チェックとエラー検出
- 一貫したAIインターフェース付きテーマサポート（ライト/ダークモード）
- モバイルアクセス用QRコード生成
- Git保護機能付きセキュアAPIキー管理
- nginx対応本番環境デプロイメント

## AIアシスタント機能
PHPエディタはLMStudio APIを使用したAI駆動コーディングアシスタンスを含みます：

### 利用可能なAI機能：
- **リアルタイムチャット**: ファイルコンテキスト認識機能付きインタラクティブAIアシスタント

### AIチャット機能：
- **ファイルコンテキスト共有**: AIが現在のファイル内容を分析可能
- **チャット履歴**: 会話がブラウザストレージに保存され、セッション間で永続化
- **Markdownサポート**: AI応答がシンタックスハイライト付きでフォーマット
- **テーマ統合**: チャットインターフェースがライト/ダークテーマに適応

### AIアシスタントセットアップ：

#### 方法1: LMStudio（推奨）
1. [lmstudio.ai](https://lmstudio.ai)からLMStudioをダウンロード・インストール

2. LMStudioでコーディングモデルをロード（推奨モデル）：
   - `codellama`
   - `deepseek-coder`
   - `codegemma`

3. LMStudioサーバーを起動してAPIエンドポイントを確認

4. AI設定を構成：
   ```bash
   # サンプル設定をコピー
   cp api/ai_config.sample.php api/ai_config.php
   
   # 設定ファイルを編集
   nano api/ai_config.php
   ```

5. `api/ai_config.php`を設定で更新：
   ```php
   <?php
   return [
       'lmstudio_api_url' => 'http://your-lmstudio-server:1234/v1/chat/completions',
       'api_key' => 'your-api-key-here',
   ];
   ```

#### 方法2: その他のOpenAI互換API
設定ファイルの`lmstudio_api_url`と`api_key`を更新することで、他のOpenAI互換APIも使用可能です。

### セキュリティ注意事項：
- `ai_config.php`ファイルはAPIキー保護のためGitから除外されています
- APIキーをバージョン管理にコミットしないでください
- 提供された`ai_config.sample.php`をテンプレートとして使用してください

## インストール
1. リポジトリをクローン
2. PHPウェブサーバー（Apache、Nginx、またはPHP内蔵サーバー）をセットアップ
3. セッション管理を設定
4. AI機能をセットアップ（AIアシスタント機能セクションを参照）
5. `api/ai_config.sample.php`を`api/ai_config.php`にコピーしてAI設定を構成
6. ウェブブラウザからエディタにアクセス

### Nginx設定（推奨）

#### 前提条件
- Nginxウェブサーバー（nginx 1.18.0でテスト済み）
- PHP 8.3 with PHP-FPM
- PHPモジュール：curl、json、session、cgi
- Composer（ユーザープログラム依存関係用）

#### 環境詳細
この設定は以下の環境でテスト済みです：
- **OS**: Linux Mint 21.3 x86_64
- **ウェブサーバー**: nginx 1.18.0
- **PHP**: PHP-FPM 8.3（php-curl、php-cgi付き）
- **パッケージマネージャー**: Composer

#### 完全なNginx設定
`/etc/nginx/sites-available/php-editor`として保存：

```nginx
server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root /var/www/html/php-editor;
	index index.html index.htm index.nginx-debian.html index.php;
	server_name _;
	charset UTF-8;
	
	location ~ /\. {
		return 404;
	}

	location ~ \.md$ {
		return 404;
	}

	location / {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;
	}

	location ~ ^/user-programs/ {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;

		# キャッシュ制御 
		add_header Cache-control "no-store";
		add_header Pragma "no-cache";

		# CORSヘッダー
		add_header 'Access-Control-Allow-Origin' https://example.com always;
	    	add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
	    	add_header 'Access-Control-Allow-Headers' 'X-Requested-With, Content-Type' always;

		location ~ \.php$ {
			include snippets/fastcgi-php.conf;
			fastcgi_pass unix:/run/php/php8.3-fpm_userphp.sock;
		}

		location ~ \.ini$ {
			return 404;		
		}
	}

	location ~ \.php$ {
		include snippets/fastcgi-php.conf;
		fastcgi_pass unix:/run/php/php8.3-fpm.sock;
	}
}
```

#### PHP-FPM設定

**主要設定注意事項：**
- CORSヘッダーの`https://example.com`を実際のドメインに置換
- 設定では2つのPHP-FMPプールを使用：
  - `unix:/run/php/php8.3-fpm.sock` メインアプリケーション用
  - `unix:/run/php/php8.3-fpm_userphp.sock` ユーザープログラム用（別プール）
- 必要に応じて`server_name`とルートパスを更新

#### インストール手順
1. **nginx設定ファイルを作成**：
   ```bash
   sudo nano /etc/nginx/sites-available/php-editor
   ```
   上記のnginx設定をコピーしてください。

2. **ユーザーPHPプール設定を作成**：
   ```bash
   sudo nano /etc/php/8.3/fpm/pool.d/www_userphp.conf
   ```
   上記のwww_userphpプール設定をコピーしてください。

3. **設定ファイルのドメインとパスを更新**：
   - CORSヘッダーの`https://example.com`を実際のドメインに置換
   - 異なるインストールディレクトリを使用する場合は`/var/www/html/php-editor`パスを更新

4. **サイトを有効化**：
   ```bash
   sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/
   ```

5. **ユーザープログラムディレクトリと設定を作成**：
   ```bash
   sudo mkdir -p /var/www/html/user-programs
   # 完全セットアップコマンドセクションに示されているようにuser-programs php.iniを作成
   ```

6. **サービスをテストしてリロード**：
   ```bash
   sudo nginx -t
   sudo php-fpm8.3 -t
   sudo systemctl restart nginx
   sudo systemctl restart php8.3-fpm
   ```

#### PHP-FPMプール設定
メインプール設定抜粋：

```ini
; 'www'という名前の新しいプールを開始
[www]

; 子プロセスのUnixユーザー/グループ
user = www-data
group = www-data

; FastCGIリクエストを受け付けるアドレス
listen = /run/php/php8.3-fpm.sock

; Unixソケットの権限を設定
listen.owner = www-data
listen.group = www-data

; プロセスマネージャーが子プロセス数を制御する方法を選択
; 可能な値：static、dynamic、ondemand
pm = dynamic

; 同時に生存可能な子プロセスの最大数
pm.max_children = 50

; 起動時に作成される子プロセス数
pm.start_servers = 5

; 'idle'状態の子プロセスの最小数
pm.min_spare_servers = 5

; 'idle'状態の子プロセスの最大数
pm.max_spare_servers = 35
```

**注意**: サーバー設定にはユーザープログラム実行用の別プール（`www_userphp`）が含まれており、追加のセキュリティ分離を提供します。

#### PHPプールアーキテクチャ詳細
php-editorはセキュリティと分離のために2つの異なるPHP-FMPプールを使用します：

1. **wwwプール** (`/run/php/php8.3-fmp.sock`):
   - **目的**: メインphp-editorアプリケーションを実行
   - **セキュリティレベル**: 標準ウェブアプリケーションセキュリティ
   - **設定**: `/etc/php/8.3/fpm/pool.d/www.conf`

2. **www_userphpプール** (`/run/php/php8.3-fmp_userphp.sock`):
   - **目的**: ユーザー作成PHPプログラムを実行
   - **セキュリティレベル**: 制限的セキュリティ設定
   - **設定**: `/etc/php/8.3/fpm/pool.d/www_userphp.conf`
   - **制限**: 危険な関数の無効化、ファイル操作制限

**なぜ別プール？**
デュアルプールアーキテクチャは、エディタ自体に完全な機能を維持しながら、ユーザープログラムに厳格なセキュリティ設定を適用することで、ユーザーコードがメインアプリケーションを侵害することを防ぎます。

#### ユーザーPHPプール設定
ユーザープログラム用の別プール：

```ini
; ユーザープログラム用の'www_userphp'という名前の新しいプールを開始
[www_userphp]

; プロセスのUnixユーザー/グループ
user = www-data
group = www-data

; FastCGIリクエストを受け付けるアドレス
listen = /run/php/php8.3-fmp_userphp.sock

; Unixソケットの権限を設定
listen.owner = www-data
listen.group = www-data

; プロセスマネージャー設定
pm = dynamic
pm.max_children = 20
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5

; ユーザープログラム用追加セキュリティ
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
php_admin_flag[allow_url_fopen] = off
php_admin_flag[allow_url_include] = off

; セッションセキュリティ設定
php_admin_flag[session.cookie_httponly] = on
```

この別プールは以下を提供します：
- **分離**: ユーザーコードが別のプロセスプールで実行
- **セキュリティ**: ユーザープログラムの危険な関数を無効化
- **リソース制限**: ユーザープログラムのプロセス制限を低く設定
- **監視**: ユーザーコード実行の個別ログ記録と監視
- **セッションセキュリティ**: HTTP専用Cookieが PHPセッションへのJavaScriptアクセスを防止

#### ユーザープログラム用Composer設定
システムはユーザープログラム用のComposer依存関係をサポートします：

**Composerルートディレクトリ**: `/var/www/html/user-programs/.composer/`

**ユーザープログラム用Composerセットアップ**：
```bash
# composerディレクトリを作成
sudo mkdir -p /var/www/html/user-programs/.composer
sudo chown www-data:www-data /var/www/html/user-programs/.composer

# composerルートに移動してパッケージをインストール
cd /var/www/html/user-programs/.composer
sudo -u www-data composer install
```

**オートロード設定**：
Composerオートロードは2つの場所で設定されます：
1. **PHP-FMPプール** (`/etc/php/8.3/fmp/pool.d/www_userphp.conf`):
   ```ini
   php_admin_value[auto_prepend_file] = /var/www/html/user-programs/.composer/vendor/autoload.php
   ```

2. **ユーザープログラムPHP.ini** (`/var/www/html/user-programs/php.ini`):
   ```ini
   auto_prepend_file = /var/www/html/user-programs/.composer/vendor/autoload.php
   ```

#### 新しいPHP機能のテスト
新しいPHP機能を追加する際は、この手順に従ってテストしてください：

**1. ユーザーエクスペリエンステスト**：
   - **実行テスト**: "実行"ボタンを使用してコードが別ページで実行されるかテスト
   - **シンタックスチェックテスト**: "エラーチェック"ボタンを使用してシンタックス検証が動作するか確認

**2. 失敗したテストのトラブルシューティング**：

   **実行ボタンが失敗する場合**：
   1. PHP-FMPプール設定を確認：`/etc/php/8.3/fmp/pool.d/www_userphp.conf`
   2. 関数が`php_admin_value[disable_functions]`に含まれていないか確認
   3. PHP-FMPを再起動：`sudo systemctl restart php8.3-fmp`

   **エラーチェックボタンが失敗する場合**：
   1. ユーザープログラムPHP設定を確認：`/var/www/html/user-programs/php.ini`
   2. 関数が`disable_functions`に含まれていないか確認
   3. PHP-FMPを再起動：`sudo systemctl restart php8.3-fmp`

#### 完全セットアップコマンド

**1. Nginx設定を作成**：
```bash
sudo tee /etc/nginx/sites-available/php-editor > /dev/null << 'EOF'
server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root /var/www/html/php-editor;
	index index.html index.htm index.nginx-debian.html index.php;
	server_name _;
	charset UTF-8;
	
	location ~ /\. {
		return 404;
	}

	location ~ \.md$ {
		return 404;
	}

	location / {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;
	}

	location ~ ^/user-programs/ {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;

		# キャッシュ制御 
		add_header Cache-control "no-store";
		add_header Pragma "no-cache";

		# CORSヘッダー
		add_header 'Access-Control-Allow-Origin' https://example.com always;
	    	add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
	    	add_header 'Access-Control-Allow-Headers' 'X-Requested-With, Content-Type' always;

		location ~ \.php$ {
			include snippets/fastcgi-php.conf;
			fastcgi_pass unix:/run/php/php8.3-fmp_userphp.sock;
		}

		location ~ \.ini$ {
			return 404;		
		}
	}

	location ~ \.php$ {
		include snippets/fastcgi-php.conf;
		fastcgi_pass unix:/run/php/php8.3-fmp.sock;
	}
}
EOF
```

**2. ユーザーPHPプール設定を作成**：
```bash
sudo tee /etc/php/8.3/fmp/pool.d/www_userphp.conf > /dev/null << 'EOF'
; ユーザープログラム用の'www_userphp'という名前の新しいプールを開始
[www_userphp]

; プロセスのUnixユーザー/グループ
user = www-data
group = www-data

; FastCGIリクエストを受け付けるアドレス
listen = /run/php/php8.3-fmp_userphp.sock

; Unixソケットの権限を設定
listen.owner = www-data
listen.group = www-data

; プロセスマネージャー設定
pm = dynamic
pm.max_children = 20
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5

; ユーザープログラム用追加セキュリティ
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
php_admin_flag[allow_url_fopen] = off
php_admin_flag[allow_url_include] = off

; セッションセキュリティ設定
php_admin_flag[session.cookie_httponly] = on

; ユーザープログラム用Composerオートロード
php_admin_value[auto_prepend_file] = /var/www/html/user-programs/.composer/vendor/autoload.php
EOF
```

**3. PHP-FMPメイン設定を更新**（セッションセキュリティを追加）：
```bash
# メインPHP設定にセッションセキュリティを追加
echo 'session.cookie_httponly = On' | sudo tee -a /etc/php/8.3/fmp/php.ini
```

**4. ユーザープログラムPHP設定を作成**：
```bash
sudo mkdir -p /var/www/html/user-programs
sudo tee /var/www/html/user-programs/php.ini > /dev/null << 'EOF'
; ユーザープログラムPHP設定
; 危険な関数を無効化
disable_functions = exec,passthru,shell_exec,system,proc_open,popen

; ファイル操作制限
allow_url_fopen = Off
allow_url_include = Off

; Composerオートロード
auto_prepend_file = /var/www/html/user-programs/.composer/vendor/autoload.php

; セッションセキュリティ
session.cookie_httponly = On
EOF
```

**5. サイトを有効化してサービスを再起動**：
```bash
# nginxサイトを有効化
sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/

# 設定をテスト
sudo nginx -t
sudo php-fmp8.3 -t

# サービスを再起動
sudo systemctl restart nginx
sudo systemctl restart php8.3-fmp
```

#### 主要設定機能

- **開発用キャッシュ制御**: 反復開発をサポートするための`/user-programs/`ディレクトリの完全キャッシュ無効化
- **セキュリティヘッダー**: セキュリティ強化のためのX-Frame-Options、X-XSS-Protection、X-Content-Type-Options
- **ファイルアップロード**: 最大50MBファイルアップロード対応設定
- **ユーザープログラム**: `/user-programs/`ディレクトリの特別処理：
  - 動的コンテンツの完全キャッシュ無効化（ブラウザとCDNキャッシュを防止）
  - クロスオリジンリクエスト用CORSヘッダー（設定可能）
  - 拡張タイムアウト付き別PHP処理
  - 危険なファイルタイプ（.sh、.exeなど）のブロック
- **静的ファイルキャッシュ**: CSS、JS、画像の1ヶ月間有効期限での最適化キャッシュ
- **Gzip圧縮**: パフォーマンス向上のためのテキストベースファイル対応
- **セキュリティブロック**: 隠しファイル、markdownファイル、設定ファイル、バックアップファイルをブロック
- **ログ記録**: 監視用の個別アクセスおよびエラーログ

**キャッシュ制御詳細**：
`/user-programs/`ディレクトリは積極的なキャッシュ防止を使用：
```nginx
# キャッシュ制御 
add_header Cache-control "no-store";
add_header Pragma "no-cache";
```
この設定：
- 開発中のユーザープログラムのブラウザキャッシュを防止
- CDNキャッシュ（Cloudflareを含む）をバイパス
- テスト中のコード変更の即座反映を保証

#### インストール手順
1. **設定ファイルを作成**：
   ```bash
   sudo nano /etc/nginx/sites-available/php-editor
   ```

2. **完全設定をコピー**（完全セットアップコマンドセクションに記載）してカスタマイズ：
   - CORSヘッダーの`https://example.com`を実際のドメインに置換
   - インストールパスに応じて`/var/www/html/php-editor`を更新
   - 必要に応じてCORS設定を調整

3. **サイトを有効化**：
   ```bash
   sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/
   ```

4. **ユーザープログラム設定を作成**（完全セットアップコマンドセクションの完全設定を参照）

5. **nginxをテストしてリロード**：
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### PHP-FMP設定
PHP-FMPが適切に設定されているか確認：

```bash
# PHP-FMPステータスを確認
sudo systemctl status php8.3-fmp

# 必要に応じてPHP-FMPプール設定を編集
sudo nano /etc/php/8.3/fmp/pool.d/www.conf
```

確認すべき主要PHP-FMP設定：
- `listen = /run/php/php8.3-fmp.sock`
- `user = www-data`
- `group = www-data`
- `pm.max_requests = 500`（ニーズに応じて調整）

#### ディレクトリ構造と権限
サーバーディレクトリ構造と権限が正しく設定されているか確認：

```bash
# メインディレクトリを作成
sudo mkdir -p /var/www/html/php-editor

# 所有権を設定
sudo chown -R www-data:www-data /var/www/html/php-editor

# 基本権限を設定
sudo find /var/www/html/php-editor -type d -exec chmod 755 {} \;
sudo find /var/www/html/php-editor -type f -exec chmod 644 {} \;

# PHPファイルを実行可能にする
sudo find /var/www/html/php-editor -name "*.php" -exec chmod 644 {} \;

# user-programsディレクトリに特別権限を設定
sudo mkdir -p /var/www/html/php-editor/user-programs
sudo chmod 755 /var/www/html/php-editor/user-programs
sudo chown www-data:www-data /var/www/html/php-editor/user-programs
```

必要なディレクトリ構造：
```
/var/www/html/php-editor/          # メインアプリケーション (755)
├── api/                          # APIエンドポイント (755)
│   ├── ai.php                    # AI チャットAPI (644)
│   ├── ai_config.php             # AI設定 (600) - 制限付き
│   └── file_manager.php          # ファイル管理API (644)
├── user-programs/                # ユーザーコード実行エリア (755)
├── js/                          # JavaScriptファイル (755)
├── css/                         # スタイルシート (755)
├── templates/                   # HTMLテンプレート (755)
├── MEditor/                     # カスタムエディタコンポーネント (755)
├── index.php                    # メインエントリーポイント (644)
└── login.php                    # ログインページ (644)
```

**重要**: 機密ファイルに制限的権限を設定：
```bash
# AI設定ファイルを保護
sudo chmod 600 /var/www/html/php-editor/api/ai_config.php
sudo chown www-data:www-data /var/www/html/php-editor/api/ai_config.php
```

### 代替案: PHP内蔵サーバー（開発専用）
開発目的では、PHPの内蔵サーバーを使用できます：
```bash
cd /path/to/php-editor
php -S localhost:8000
```

**注意**: 内蔵サーバーは本番使用には推奨されません。

## 使用方法
1. システムにログイン
2. ファイルエクスプローラーを使用してファイルをナビゲートし作成
3. シンタックスハイライトと自動補完でコードを編集
4. コーディングヘルプと説明にAIチャットアシスタントを使用
5. AIが現在のファイルをコンテキスト認識アシスタンス用に自動分析
6. チャット履歴がセッション間で自動保存・復元
7. 内蔵シンタックスチェック付きでPHPスクリプトを保存・実行

## ファイル構造
- `api/`: バックエンドAPIエンドポイント
  - `ai.php`: AI チャットAPIエンドポイント
  - `ai_config.php`: AI設定（Gitで追跡されない）
  - `ai_config.sample.php`: サンプルAI設定テンプレート
  - `file_manager.php`: ファイル管理API
- `js/`: AIアシスタント含むJavaScriptファイル
  - `meditor.js`: AI統合付きメインエディタ機能
  - `ai_api.js`: AI APIクライアント
- `css/`: テーマサポート付きスタイルシート
- `templates/`: HTMLテンプレート
- `MEditor/`: AIチャットインターフェース付きカスタムエディタコンポーネント

## 設定ファイル
- `api/ai_config.php`: 機密APIキーを含む（Gitから除外）
- `api/ai_config.sample.php`: AI設定用テンプレート
- `.gitignore`: APIキー保護のため`api/ai_config.php`を含む
- `man.txt`: 設定詳細とトラブルシューティングノート付き内部ドキュメント
- **サーバー設定**（手動作成 - リポジトリ内になし）：
  - `/etc/nginx/sites-available/php-editor`: nginx バーチャルホスト設定
  - `/etc/php/8.3/fpm/pool.d/www_userphp.conf`: ユーザープログラムPHP-FMPプール
  - `/var/www/html/user-programs/php.ini`: ユーザープログラムPHP設定
- `user-programs/`: ユーザーコード実行ディレクトリ
  - `.composer/`: ユーザープログラム用Composer依存関係
  - `php.ini`: ユーザープログラム固有PHP設定

## セキュリティベストプラクティス
- APIキーをバージョン管理にコミットしない
- 機密データを分離するために提供された設定ファイル構造を使用
- `ai_config.php`ファイルはGit追跡から自動除外
- より良いセキュリティのためにAPIキーを定期的にローテーション

### 重要なセキュリティ設定

#### セッションセキュリティ
**session.cookie_httponly**: PHPセッションCookieへのJavaScriptアクセスを防ぐために有効にする必要があります。
- **設定場所**: `/etc/php/8.3/fmp/php.ini`
- **設定**: `session.cookie_httponly = On`
- **目的**: セッションCookieへのJavaScriptアクセスをブロックすることでユーザープログラムによるセッションハイジャックを防止
- **リスク**: この設定なしでは、ユーザープログラムがセッショントークンを盗む可能性があります

#### 機能制限
ユーザープログラムは危険なPHP関数への制限アクセスを持ちます：
- **無効化関数**: `exec`、`passthru`、`shell_exec`、`system`、`proc_open`、`popen`
- **ファイル操作**: `allow_url_fopen`と`allow_url_include`無効化
- **目的**: ユーザーコードがシステムコマンドを実行したり外部リソースにアクセスすることを防止

#### ディレクトリ分離
- メインアプリケーションは標準`www`プールで実行
- ユーザープログラムは制限された`www_userphp`プールで実行
- 別オートロード設定で依存関係競合を防止

## トラブルシューティング
### AIチャット問題
- **"AI設定ファイルが見つかりません"**: `ai_config.sample.php`を`ai_config.php`にコピーして設定を構成
- **"APIキーが設定されていません"**: `ai_config.php`の`api_key`値を実際のAPIキーで更新
- **チャット履歴が永続化されない**: ブラウザストレージ権限を確認し、破損したlocalStorageをクリア（必要に応じて）
- **AI応答がフォーマットされない**: AIエンドポイントが有効なmarkdownを返すことを確認し、コンソールでJavaScriptエラーをチェック

### 一般的な問題
- **ファイルアップロード失敗**: アップロードディレクトリのサーバー権限を確認
- **シンタックスエラーが表示されない**: PHP CLIが利用可能でウェブサーバーからアクセス可能か確認
- **テーマが切り替わらない**: ブラウザキャッシュをクリアしてCSSファイル権限を確認

### PHP機能テスト問題
新しいPHP機能が正常に動作しない場合：

#### 実行ボタンが動作しない
1. **PHP-FMPプール設定を確認**：
   ```bash
   sudo nano /etc/php/8.3/fmp/pool.d/www_userphp.conf
   ```
2. **関数が無効化関数リストに含まれていないか確認**：
   - `php_admin_value[disable_functions]`を探す
   - そこにリストされている場合は関数を削除
3. **PHP-FMPを再起動**：
   ```bash
   sudo systemctl restart php8.3-fmp
   ```

#### エラーチェックボタンが動作しない
1. **ユーザープログラムPHP設定を確認**：
   ```bash
   sudo nano /var/www/html/user-programs/php.ini
   ```
2. **関数が無効化関数リストに含まれていないか確認**：
   - `disable_functions`を探す
   - そこにリストされている場合は関数を削除
3. **PHP-FMPを再起動**：
   ```bash
   sudo systemctl restart php8.3-fmp
   ```

### Composer問題
- **オートロードが動作しない**: PHP-FMPプール設定とuser-programs php.iniの両方でオートロードパスを確認
- **権限エラー**: www-dataが`.composer`ディレクトリを所有しているか確認
- **パッケージインストール失敗**: composerコマンドをwww-dataユーザーとして実行

### サーバー設定問題
- **504 Gateway Timeout**: 
  - PHP-FMPが実行中か確認：`sudo systemctl status php8.3-fmp`
  - nginx設定でFastCGIタイムアウトを増加
  - プロセス制限についてPHP-FMPプール設定を確認

- **403 Forbidden**: 
  - ディレクトリ権限を確認：`ls -la /var/www/html/php-editor`
  - nginxユーザーに読み取りアクセスがあるか確認：`sudo -u www-data ls /var/www/html/php-editor`
  - インデックスファイルが存在し読み取り可能か確認

- **PHPファイルが実行されずダウンロードされる**: 
  - PHP-FMPソケットパスを確認：`/run/php/php8.3-fmp.sock`
  - php8.3-fmpサービスが実行中か確認
  - nginx設定をテスト：`sudo nginx -t`

- **ファイルアップロード失敗**: 
  - user-programsのディレクトリ権限を確認：`ls -la /var/www/html/php-editor/user-programs`
  - nginx `client_max_body_size`設定を確認
  - PHPアップロード設定を確認：`upload_max_filesize`と`post_max_size`

- **ユーザープログラムでCORSエラー**: 
  - nginx設定のAccess-Control-Allow-Originヘッダーを調整
  - 本番環境では`*`を特定ドメインに置換
  - 特定のCORSエラーメッセージについてブラウザ開発者ツールを確認

- **静的ファイルが読み込まれない**: 
  - ファイル権限を確認：`sudo find /var/www/html/php-editor -name "*.css" -o -name "*.js" | xargs ls -la`
  - nginxエラーログを確認：`sudo tail -f /var/log/nginx/php-editor.error.log`
  - nginxでgzipモジュールが有効か確認

**デバッグコマンド**：
```bash
# nginx設定を確認
sudo nginx -t

# nginxエラーログを表示
sudo tail -f /var/log/nginx/php-editor.error.log

# PHP-FMPステータスとログを確認
sudo systemctl status php8.3-fmp
sudo tail -f /var/log/php8.3-fmp.log

# ファイル権限をテスト
sudo -u www-data test -r /var/www/html/php-editor/index.php && echo "読み取り可能" || echo "読み取り不可能"

# ソケット可用性を確認
ls -la /run/php/php8.3-fmp.sock
```

## 開発
このプロジェクトは以下のブランチ構造で活発に開発されています：
- `main`: 安定リリースブランチ
- `beta`: 最新機能付きテストブランチ
- `AI`: AI機能開発ブランチ
- `dev`: 一般開発ブランチ

## 最近の更新
- ✅ より良い互換性のためOllamaからLMStudio APIに移行
- ✅ 別設定ファイルによるセキュアAPIキー管理を実装
- ✅ ブラウザlocalStorageを使用した永続チャット履歴を追加
- ✅ markdownレンダリングとテーマ統合でAIチャットインターフェースを強化
- ✅ セキュリティ向上のためGit履歴からAPIキーを削除
- ✅ 包括的エラーハンドリングとユーザーフィードバックを追加
- ✅ 本番デプロイメント用nginx設定ガイドラインを追加

## 貢献
1. リポジトリをフォーク
2. 機能ブランチを作成
3. サンプルテンプレートを使用してAPIキーが適切に設定されているか確認
4. 変更を提出する前にAI機能をテスト
5. 変更の詳細説明付きプルリクエストを提出

## ライセンス
このプロジェクトはプログラミング教育での教育目的のために設計されています。
