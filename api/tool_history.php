<?php
/**
 * AIツール実行履歴のログAPI
 * 
 * 既存のlogger.phpを使用してツール実行履歴を記録します。
 * 教育用途での学生の操作追跡、セキュリティ監査に使用。
 */

// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json; charset=utf-8');

// ログイン認証チェック
requireLogin();

// logger.phpを読み込み
require_once(__DIR__ . '/logger.php');

// POSTデータ取得
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

$action = isset($input['action']) ? $input['action'] : '';

if ($action === 'logToolExecution') {
    // ツール実行履歴をログに記録
    
    $userId = isset($_SESSION['id']) ? $_SESSION['id'] : 'unknown';
    $tool = isset($input['tool']) ? $input['tool'] : 'unknown';
    $parameters = isset($input['parameters']) ? $input['parameters'] : [];
    $status = isset($input['status']) ? $input['status'] : 'unknown';
    $result = isset($input['result']) ? $input['result'] : null;
    $approvalTime = isset($input['approvalTime']) ? $input['approvalTime'] : null;
    $model = isset($input['model']) ? $input['model'] : 'unknown';
    
    // ログメッセージの構築
    $logData = [
        'tool' => $tool,
        'parameters' => $parameters,
        'status' => $status,
        'result' => $result,
        'approvalTime' => $approvalTime,
        'model' => $model
    ];
    
    // Loggerクラスを使ってログに記録
    $logger = new Logger();
    $logger->info("AI_TOOL_EXECUTION", $logData);
    
    echo json_encode([
        'success' => true,
        'message' => 'Tool execution logged'
    ]);
    exit;
    
} else if ($action === 'getToolHistory') {
    // ツール実行履歴を取得（将来的な拡張用）
    
    $userId = isset($_SESSION['id']) ? $_SESSION['id'] : 'unknown';
    $limit = isset($input['limit']) ? intval($input['limit']) : 100;
    
    // ログファイルから履歴を読み込む（logger.phpの形式に合わせる）
    $userRoot = posix_getpwuid(posix_getuid())["dir"];
    $logDir = $userRoot . "/data/php_editor/log/";
    $dateStr = date('Y-m-d');
    $logFile = $logDir . "php_editor_{$dateStr}.log";
    
    if (!file_exists($logFile)) {
        echo json_encode([
            'success' => true,
            'history' => []
        ]);
        exit;
    }
    
    $logLines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $toolHistory = [];
    
    // ログから AI_TOOL_EXECUTION エントリを抽出
    foreach (array_reverse($logLines) as $line) {
        $data = json_decode($line, true);
        if ($data && isset($data['message']) && $data['message'] === 'AI_TOOL_EXECUTION') {
            $toolHistory[] = [
                'timestamp' => $data['timestamp'] ?? null,
                'userId' => $data['user_id'] ?? null,
                'tool' => $data['context']['tool'] ?? null,
                'parameters' => $data['context']['parameters'] ?? null,
                'status' => $data['context']['status'] ?? null,
                'result' => $data['context']['result'] ?? null,
                'approvalTime' => $data['context']['approvalTime'] ?? null,
                'model' => $data['context']['model'] ?? 'unknown'
            ];
        }
        
        if (count($toolHistory) >= $limit) {
            break;
        }
    }
    
    echo json_encode([
        'success' => true,
        'history' => $toolHistory
    ]);
    exit;
    
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
    exit;
}
