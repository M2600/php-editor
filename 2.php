<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/api/session_init.php');

// ログイン認証チェック
requireLogin();

// セッション情報をJavaScriptに渡す
$sessionData = [
    'id' => $_SESSION['id'] ?? null,
    'role' => $_SESSION['role'] ?? null,
    'is_proxy' => isProxyLogin(),
    'proxy_info' => null
];

if (isProxyLogin() && isset($_SESSION['proxy_login'])) {
    $sessionData['proxy_info'] = [
        'admin_id' => $_SESSION['proxy_login']['admin_id'] ?? null,
        'readonly' => $_SESSION['proxy_login']['readonly'] ?? false,
        'login_time' => $_SESSION['proxy_login']['login_time'] ?? null
    ];
}

echo '<script>window.SESSION_DATA = ' . json_encode($sessionData, JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>';

require("templates/editor.html");


?>
