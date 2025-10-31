php-editorの設定やトラブルシューティングをまとめるファイル

環境(2025/5/10)
Linux Mint 21.3 x86_64 (bitecool34)
nginx 1.18.0
php-fpm 8.3
php-curl
php-cgi
composer


poolについて
    phpeditorでは2つのphp poolを使い分けている。
    1. www
        phpeditor自体の実行用。
    2. www_userphp
        phpeditor上でユーザが作ったphpを実行する用。

    それぞれの設定ファイルは/etc/php/{version}/fpm/pool.d
    分けている理由としてはセキュリティの設定等を分けるため。
    つまり、www_userphpのほうが厳しめ。
    


セキュリティ設定
    session.cookie関連
        session.cookie_httponlyを有効に。
            現状は/etc/php/8.3/fpm/php.iniで設定している。
            これを有効にすることでJavaScriptからPHPセッションのクッキー窃取を防げる。
            設定しないとユーザプログラムでセッションハイジャックされる。


composer
    composer-root: /var/www/html/user-programs/.composer/
    compoer-root内でcomposerコマンドを実行する。

    ロードさせる設定
        /etc/php/8.3/fpm/pool.d/www_userphp.confのphp_admin_value[auto_prepend_file]にautoload.phpを指定している。
        /var/www/html/user-programs/php.iniのauto_prepend_fileにautoload.phpを指定している。


phpの機能や関数を追加した場合
    1. ユーザ目線で機能が使えるか確認
        1. 実行ボタンを押して別ページ上で動作するか
        2. エラーチェックボタンで動作するか

    2. 動作しない場合
        1. 実行ボタンが動作しない場合
            1. phpの設定の確認
                /etc/php/{version}/fpm/www_userphp.conf
                php_admin_value[disable_functions] の項目が禁止関数を指定している。ココに含まれていないか確認
                sudo systemctl restart php{version}-fpm.service
        2. エラーチェックボタンが動作しない場合
            1. php.iniの設定の確認
                path/to/user-programs/php.ini
                disable_functions の項目が禁止関数をしている。ここに含まれていないか確認
                sudo systemctl restart php{version}-fpm.service

キャッシュコントロール
    基本的に`/user-programs/`以下のファイルにはキャッシュをかけたくない。
    開発環境で繰り返し変更実行を行うのにキャッシュがあると邪魔
    nginxの設定で`/user-programs/`ディレクティブに
    ```
    # Cache control
    add_header Cache-control "no-store";
    add_header Pragma "no-cache";
    ```
    を設定することでブラウザにキャッシュを保存させないように指示できる
    (cloudflareキャッシュについてもこの方法でバイパスできそう)