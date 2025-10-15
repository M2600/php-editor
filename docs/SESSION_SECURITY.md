# セッションセキュリティに関する重要な情報

## 問題の概要

PHPEditorのセッションCookieがユーザー開発プログラム（`/user-programs/`）に送信される可能性があります。

## セキュリティリスク

### 1. セッションCookieの漏洩

**問題：**
- デフォルトでは、PHPのセッションCookieはPath `/`で送信される
- `/user-programs/`配下のユーザーコードにもエディタのセッションCookieが送信される
- ユーザーが`$_COOKIE['PHP_EDITOR_SID']`を読み取れる可能性がある

**攻撃シナリオ：**
```php
<?php
// /user-programs/malicious.php
// エディタのセッションCookieを窃取
$editorSession = $_COOKIE['PHP_EDITOR_SID'] ?? null;
if ($editorSession) {
    // 外部に送信したり、ログに記録したりできる
    error_log("Stolen session: " . $editorSession);
}
?>
```

### 2. セッションハイジャック

**問題：**
- ユーザーコードで`session_name('PHP_EDITOR_SID')`を呼び出せる
- エディタのセッションを乗っ取れる可能性がある

**攻撃シナリオ：**
```php
<?php
// /user-programs/hijack.php
session_name('PHP_EDITOR_SID');
session_id($_COOKIE['PHP_EDITOR_SID']);
session_start();

// エディタのセッション情報を読み取り・改ざん
var_dump($_SESSION);
$_SESSION['id'] = 'attacker';
?>
```

## 実施した対策

### 1. セッション名の分離 ✅

**エディタ側（`session_init.php`）：**
```php
ini_set('session.name', 'PHP_EDITOR_SID');
```

**ユーザープログラム側（`user-programs/php.ini`）：**
```ini
session.name = USER_PROGRAM_SID
```

これにより、異なるセッション名を使用し、基本的な分離を実現。

### 2. SameSite属性の強化 ✅

**変更前：**
```php
ini_set('session.cookie_samesite', 'Lax');
```

**変更後：**
```php
ini_set('session.cookie_samesite', 'Strict');
```

`Strict`に変更することで、クロスサイトリクエストでのCookie送信を完全にブロック。

### 3. HttpOnly属性の維持 ✅

```php
ini_set('session.cookie_httponly', 1);
```

JavaScriptからのアクセスは既に防止済み。

## 残存するリスクと追加推奨対策

### ⚠️ 同一オリジンの問題

現在の設定では、エディタとユーザープログラムが同一オリジン（同じドメイン）で動作しています。

**問題点：**
- Cookie Pathでは完全に分離できない（`/user-programs/`は`/`の配下）
- 同一オリジンなので、技術的にはCookieが送信される可能性がある

### 🔐 推奨される完全な解決策

#### オプション1: サブドメイン分離（最も推奨）

**構成：**
```
エディタ: https://editor.example.com/
ユーザープログラム: https://programs.example.com/
```

**セッション設定：**
```php
// session_init.php
ini_set('session.cookie_domain', '.editor.example.com');
```

**メリット：**
- 完全に異なるオリジン
- Cookieが物理的に送信されない
- 最も安全

#### オプション2: ポート分離

**構成：**
```
エディタ: https://example.com:443/
ユーザープログラム: https://example.com:8080/
```

**メリット：**
- サブドメイン不要
- 異なるオリジンとして扱われる

#### オプション3: リバースプロキシでのCookie除外

**Nginx設定：**
```nginx
location ~ ^/user-programs/ {
    # エディタのセッションCookieを除外
    proxy_set_header Cookie "";
    
    # または特定のCookieのみ除外
    # fastcgi_param HTTP_COOKIE $cookie_without_php_editor_sid;
    
    fastcgi_pass unix:/run/php/php8.3-fpm_userphp.sock;
}
```

### 📋 実装チェックリスト

現在の状態：
- [x] セッション名の分離（`PHP_EDITOR_SID` vs `USER_PROGRAM_SID`）
- [x] SameSite=Strict
- [x] HttpOnly=1
- [x] ユーザープログラム側のPHP設定分離
- [ ] サブドメイン分離（本番環境で推奨）
- [ ] Cookie除外設定（Nginxレベル）
- [ ] セッション保存パスの完全分離

### 🧪 セキュリティテスト

以下のテストを実施して、セッション漏洩がないことを確認してください：

**テスト1: Cookie読み取りテスト**
```php
<?php
// /user-programs/test_cookie.php
var_dump($_COOKIE);
// PHP_EDITOR_SIDが含まれていないことを確認
?>
```

**テスト2: セッション分離テスト**
```php
<?php
// /user-programs/test_session.php
session_start();
echo "Session Name: " . session_name(); // USER_PROGRAM_SID であること
echo "Session ID: " . session_id();
var_dump($_SESSION); // エディタのセッション情報が含まれていないこと
?>
```

**テスト3: セッションハイジャック試行**
```php
<?php
// /user-programs/test_hijack.php
session_name('PHP_EDITOR_SID');
if (isset($_COOKIE['PHP_EDITOR_SID'])) {
    session_id($_COOKIE['PHP_EDITOR_SID']);
    session_start();
    var_dump($_SESSION); // 空または読み取れないこと
}
?>
```

## まとめ

### 現在の対策レベル
**中程度の保護** - 基本的な分離は実現しているが、完全ではない

### 本番環境での推奨
**サブドメイン分離**を強く推奨します：
```
エディタ: https://editor.yourdomain.com/
ユーザープログラム: https://apps.yourdomain.com/
```

これにより、物理的にCookieが送信されなくなり、最も安全な構成となります。

## 参考資料

- [PHP Session Security](https://www.php.net/manual/en/session.security.php)
- [OWASP Session Management](https://owasp.org/www-community/attacks/Session_hijacking_attack)
- [Cookie SameSite Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
