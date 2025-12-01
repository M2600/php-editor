<?php
/**
 * 代理ログインAPI
 * admin ロールの管理者が他のユーザとして代理ログインする
 */

// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

// admin ロール専用機能
requireLogin('admin');

// POSTリクエストのみ受け付ける
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'error' => 'Method not allowed',
        'message' => 'POSTメソッドのみ使用できます。'
    ]);
    exit();
}

// リクエストボディを取得
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!isset($data['target_user']) || empty($data['target_user'])) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'error' => 'Invalid parameter',
        'message' => 'target_user パラメータが必要です。'
    ]);
    exit();
}

$targetUserId = $data['target_user'];
$readonly = isset($data['readonly']) ? (bool)$data['readonly'] : true;

/**
 * ユーザの存在チェック
 */
function userExists($userId) {
	$userRoot = posix_getpwuid(posix_getuid())["dir"];
    $userFile = $userRoot . '/data/php_editor/user.csv';
    
    if (!file_exists($userFile)) {
        return false;
    }
    
    $handle = fopen($userFile, 'r');
    if (!$handle) {
        return false;
    }
    
    $found = false;
    while (($line = fgets($handle)) !== false) {
        $line = trim($line);
        if (empty($line)) {
            continue;
        }
        
        $data = str_getcsv($line);
        if (count($data) >= 1 && $data[0] === $userId) {
            $found = true;
            break;
        }
    }
    fclose($handle);
    
    return $found;
}

/**
 * ユーザのロールを取得
 */
function getUserRole($userId) {
    $userFile = $_SERVER['HOME'] . '/data/php_editor/user.csv';
    
    if (!file_exists($userFile)) {
        return null;
    }
    
    $handle = fopen($userFile, 'r');
    if (!$handle) {
        return null;
    }
    
    $role = null;
    while (($line = fgets($handle)) !== false) {
        $line = trim($line);
        if (empty($line)) {
            continue;
        }
        
        $data = str_getcsv($line);
        if (count($data) >= 3 && $data[0] === $userId) {
            $role = $data[2];
            break;
        }
    }
    fclose($handle);
    
    return $role;
}

try {
    // ターゲットユーザの存在チェック
    if (!userExists($targetUserId)) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'error' => 'User not found',
            'message' => '指定されたユーザが見つかりません。'
        ]);
        exit();
    }
    
    // 現在の管理者情報を保存
    $adminId = $_SESSION['id'];
    $adminRole = $_SESSION['role'];
    
    // ターゲットユーザのロールを取得
    $targetRole = getUserRole($targetUserId);
    
    // セッションを代理ログイン用に更新
    $_SESSION['proxy_login'] = [
        'is_proxy' => true,
        'admin_id' => $adminId,
        'admin_role' => $adminRole,
        'readonly' => $readonly,
        'login_time' => date('Y-m-d H:i:s')
    ];
    
    // セッションのユーザIDとロールを変更
    $_SESSION['id'] = $targetUserId;
    $_SESSION['role'] = $targetRole ?? 'user';
    
    // 監査ログを記録
    logProxyLogin($adminId, $targetUserId, 'login');
    
    // セッションIDを再生成（セキュリティ向上）
    session_regenerate_id(true);
    
    echo json_encode([
        'status' => 'success',
        'message' => '代理ログインしました。',
        'target_user' => $targetUserId,
        'admin_id' => $adminId,
        'readonly' => $readonly
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'Proxy login failed',
        'message' => '代理ログインに失敗しました: ' . $e->getMessage()
    ]);
}
