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
 */
function requireLogin() {
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
