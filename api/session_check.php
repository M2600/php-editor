<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

// ログイン認証チェック
requireLogin();

function json_response($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // セッションが有効かチェック
    if (isset($_SESSION['id']) && !empty($_SESSION['id'])) {
        // セッション有効
        json_response([
            'status' => 'success',
            'authenticated' => true,
            'user_id' => $_SESSION['id'],
            'role' => $_SESSION['role'] ?? 'user',
            'session_id' => session_id()
        ]);
    } else {
        // セッション無効または期限切れ
        json_response([
            'status' => 'error',
            'authenticated' => false,
            'message' => 'Session expired or invalid'
        ], 401);
    }
} else {
    json_response([
        'status' => 'error',
        'message' => 'Method not allowed'
    ], 405);
}
?>
