<?php
header('Content-Type: application/json');

// Session cookie settings: enable secure only when HTTPS is used
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', $secure ? 1 : 0);

session_start();

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
