<?php
/**
 * セッション初期化モジュール
 * 
 * 全てのPHPファイルで一貫したセッション設定を使用するための共通モジュール
 * このファイルをrequire_onceすることで、セッション設定の不整合を防ぎます
 */

// セッションが既に開始されている場合は何もしない
if (session_status() === PHP_SESSION_ACTIVE) {
    return;
}

// HTTPS接続かどうかを判定
$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ||
    (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
);

// セッションCookie設定（全ファイルで統一）
ini_set('session.use_only_cookies', 1);          // URLパラメータでのセッションID送信を無効化
ini_set('session.cookie_httponly', 1);           // JavaScriptからのアクセスを防止
ini_set('session.cookie_secure', $isHttps ? 1 : 0);  // HTTPS時のみセキュアCookieを使用
ini_set('session.cookie_samesite', 'Strict');    // CSRF対策（Strictに変更）

// セッションCookieのDomainを設定してサブドメイン分離を推奨
// 本番環境では editor.example.com と user-programs.example.com のように
// 異なるサブドメインでホストすることを強く推奨
// ini_set('session.cookie_domain', '.editor.example.com');

// セッション名の設定（デフォルトのPHPSESSIDから変更してセキュリティ向上）
ini_set('session.name', 'PHP_EDITOR_SID');

// セッション開始
session_start();

/**
 * ログイン認証チェック
 * ログインが必要なページで呼び出す
 * @param string | array $role 必要なユーザーロール（'user'または'admin', ['teacher', 'admin']など。空文字列の場合は全てのユーザーを許可）
 */
function requireLogin(string|array $role = '') {
    if (!isset($_SESSION["id"]) || empty($_SESSION["id"])) {
        // APIリクエストの場合はJSONでエラーを返す
        if (isApiRequest()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode([
                "status" => "session_error", 
                "error" => "Not logged in",
                "message" => "認証が必要です。ログインしてください。"
            ]);
            exit();
        }
        
        // 通常のページの場合はログインページにリダイレクト
        // 現在のURLをセッションに保存（ログイン後にリダイレクトするため）
        $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'];
        header("Location: /login.php");
        exit();
    }

    // ユーザーロールのチェック
    $roleExists = !empty($role);
    $sessionRoleExists = isset($_SESSION["role"]);
    $roleIsString = is_string($role);
    $roleIsArray = is_array($role);
    $roleMatches = $roleIsString && $_SESSION["role"] === $role
        || $roleIsArray && in_array($_SESSION["role"], $role);
    if ($roleExists && (!$sessionRoleExists || !$roleMatches)) {
        // APIリクエストの場合はJSONでエラーを返す
        if (isApiRequest()) {
            header('Content-Type: application/json');
            http_response_code(403);
            echo json_encode([
                "status" => "permission_error",
                "error" => "Forbidden",
                "message" => "この操作には権限がありません。"
            ]);
            exit();
        }

        // 通常のページの場合は403エラーページにリダイレクト
        //header("Location: /403.php");
        http_response_code(403);
        echo "<h1>403 Forbidden</h1><p>この操作には権限がありません。</p>";
        exit();
    }
}

/**
 * APIリクエストかどうかを判定
 */
function isApiRequest() {
    // APIディレクトリ内のファイルまたはContent-TypeがJSONのリクエスト
    $scriptPath = $_SERVER['SCRIPT_FILENAME'] ?? '';
    $isApiPath = strpos($scriptPath, '/api/') !== false;
    
    // AJAXリクエストの判定
    $isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && 
              strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
    
    return $isApiPath || $isAjax;
}

/**
 * 代理ログイン中かどうかを判定
 */
function isProxyLogin() {
    return isset($_SESSION['proxy_login']) && 
           isset($_SESSION['proxy_login']['is_proxy']) && 
           $_SESSION['proxy_login']['is_proxy'] === true;
}

/**
 * 読み取り専用モードかどうかを判定
 */
function isReadOnlyMode() {
    if (!isProxyLogin()) {
        return false;
    }
    return isset($_SESSION['proxy_login']['readonly']) && 
           $_SESSION['proxy_login']['readonly'] === true;
}

/**
 * ファイル編集可能かどうかを判定
 * 読み取り専用モードでもユーザプログラムからの呼び出しは許可
 */
function canEditFiles() {
    // 代理ログインでない場合は常に編集可能
    if (!isProxyLogin()) {
        return true;
    }
    
    // 読み取り専用モードでない場合は編集可能
    if (!isReadOnlyMode()) {
        return true;
    }
    
    // ユーザプログラムからの呼び出しかチェック
    return isCalledFromUserScript();
}

/**
 * ユーザスクリプトからの呼び出しかどうかを判定
 * cgi_run アクションの実行中はユーザプログラムからの呼び出しとみなす
 */
function isCalledFromUserScript() {
    // バックトレースから呼び出し元を確認
    $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
    
    // cgi_run の実行中かチェック
    foreach ($backtrace as $trace) {
        if (isset($trace['file']) && strpos($trace['file'], 'user-programs') !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * 実際の管理者IDを取得
 * 代理ログイン中の場合は元の管理者ID、そうでない場合は現在のセッションID
 */
function getActualAdminId() {
    if (isProxyLogin() && isset($_SESSION['proxy_login']['admin_id'])) {
        return $_SESSION['proxy_login']['admin_id'];
    }
    return $_SESSION['id'] ?? null;
}

/**
 * 代理ログインの監査ログを記録
 */
function logProxyLogin($adminId, $targetUserId, $action = 'login') {
    $logDir = $_SERVER['HOME'] . '/data/php_editor/logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/proxy_login.log';
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    $logEntry = sprintf(
        "[%s] %s: Admin=%s, Target=%s, IP=%s, UA=%s\n",
        $timestamp,
        strtoupper($action),
        $adminId,
        $targetUserId,
        $ip,
        $userAgent
    );
    
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * dev ロールかどうかを判定
 */
function isDevRole() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
}

/**
 * dev ロール専用のアクセス制限
 */
function requireDevRole() {
    requireLogin();
    
    if (!isDevRole()) {
        if (isApiRequest()) {
            header('Content-Type: application/json');
            http_response_code(403);
            echo json_encode([
                "status" => "error",
                "error" => "Access denied",
                "message" => "この機能は管理者のみ使用できます。"
            ]);
            exit();
        }
        
        header("Location: /index.php");
        exit();
    }
}
