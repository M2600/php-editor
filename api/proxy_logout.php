<?php
/**
 * 代理ログイン解除API
 * 代理ログイン中の管理者が元のセッションに戻る
 */

// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

// ログイン認証チェック
requireLogin();

// 代理ログイン中かチェック
if (!isProxyLogin()) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'error' => 'Not in proxy mode',
        'message' => '代理ログイン中ではありません。'
    ]);
    exit();
}

try {
    // 元の管理者情報を取得
    $adminId = $_SESSION['proxy_login']['admin_id'] ?? null;
    $adminRole = $_SESSION['proxy_login']['admin_role'] ?? 'admin';
    $targetUserId = $_SESSION['id'];
    
    if (!$adminId) {
        throw new Exception('管理者情報が見つかりません。');
    }
    
    // 監査ログを記録
    logProxyLogin($adminId, $targetUserId, 'logout');
    
    // 代理ログイン情報を削除
    unset($_SESSION['proxy_login']);
    
    // セッションを管理者に戻す
    $_SESSION['id'] = $adminId;
    $_SESSION['role'] = $adminRole;
    
    // セッションIDを再生成（セキュリティ向上）
    session_regenerate_id(true);
    
    echo json_encode([
        'status' => 'success',
        'message' => '代理ログインを解除しました。',
        'admin_id' => $adminId
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'Proxy logout failed',
        'message' => '代理ログイン解除に失敗しました: ' . $e->getMessage()
    ]);
}
