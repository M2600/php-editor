<?php
/**
 * ユーザ一覧取得API
 * admin ロールのみアクセス可能
 */

// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

// admin ロール専用機能
requireLogin('admin');

/**
 * CSVからユーザデータを読み込む
 */
function getAllUsers() {
	$userRoot = posix_getpwuid(posix_getuid())["dir"];
    $userFile = $userRoot . '/data/php_editor/user.csv';
    
    if (!file_exists($userFile)) {
        return [];
    }
    
    $users = [];
    $handle = fopen($userFile, 'r');
    
    if ($handle) {
        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if (empty($line)) {
                continue;
            }
            
            $data = str_getcsv($line);
            if (count($data) >= 3) {
                $users[] = [
                    'id' => $data[0],
                    'role' => $data[2]
                ];
            }
            else if(count($data) == 2) {
                $users[] = [
                    'id' => $data[0],
                    'role' => 'user' // デフォルトロール
                ];
            }
        }
        fclose($handle);
    }
    
    return $users;
}

try {
    $users = getAllUsers();
    
    // 現在ログイン中のユーザIDを取得
    $currentUserId = $_SESSION['id'] ?? null;
    
    // 代理ログイン中かどうか
    $isProxy = isProxyLogin();
    $proxyInfo = null;
    
    if ($isProxy) {
        $proxyInfo = [
            'target_user' => $_SESSION['id'],
            'admin_id' => $_SESSION['proxy_login']['admin_id'] ?? null,
            'readonly' => $_SESSION['proxy_login']['readonly'] ?? false,
            'login_time' => $_SESSION['proxy_login']['login_time'] ?? null
        ];
    }
    
    echo json_encode([
        'status' => 'success',
        'users' => $users,
        'current_user' => $currentUserId,
        'is_proxy' => $isProxy,
        'proxy_info' => $proxyInfo
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'Failed to retrieve user list',
        'message' => $e->getMessage()
    ]);
}
