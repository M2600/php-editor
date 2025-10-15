<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

// ログイン認証チェック
requireLogin();

// 強化されたログシステムを読み込み
require_once(__DIR__ . '/logger.php');

// CORS対応（必要に応じて）
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array("status" => "error", "message" => "Method not allowed"));
    exit();
}

try {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if(json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON data");
    }
    
    // 必要なフィールドをチェック
    $requiredFields = ['type', 'message', 'timestamp'];
    foreach($requiredFields as $field) {
        if(!isset($data[$field])) {
            throw new Exception("Missing required field: " . $field);
        }
    }
    
    // エラータイプに応じてログレベルを決定
    $logLevel = 'ERROR';
    switch(strtolower($data['type'])) {
        case 'javascript_error':
        case 'uncaught_exception':
            $logLevel = 'ERROR';
            break;
        case 'warning':
            $logLevel = 'WARNING';
            break;
        case 'info':
            $logLevel = 'INFO';
            break;
        case 'debug':
            $logLevel = 'DEBUG';
            break;
        default:
            $logLevel = 'ERROR';
    }
    
    // ログに記録するコンテキスト情報を準備
    $context = array(
        'client_type' => 'browser',
        'error_type' => $data['type'],
        'client_timestamp' => $data['timestamp'],
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'session_id' => session_id()
    );
    
    // オプションのフィールドを追加
    if(isset($data['url'])) {
        $context['page_url'] = $data['url'];
    }
    if(isset($data['line'])) {
        $context['line_number'] = $data['line'];
    }
    if(isset($data['column'])) {
        $context['column_number'] = $data['column'];
    }
    if(isset($data['stack'])) {
        $context['stack_trace'] = $data['stack'];
    }
    if(isset($data['filename'])) {
        $context['filename'] = $data['filename'];
    }
    if(isset($data['additional_info'])) {
        $context['additional_info'] = $data['additional_info'];
    }
    
    // ログに記録
    switch($logLevel) {
        case 'DEBUG':
            logDebug("Browser: " . $data['message'], $context);
            break;
        case 'INFO':
            logInfo("Browser: " . $data['message'], $context);
            break;
        case 'WARNING':
            logWarning("Browser: " . $data['message'], $context);
            break;
        case 'ERROR':
        default:
            logError("Browser: " . $data['message'], $context);
            break;
    }
    
    // 成功レスポンス
    echo json_encode(array(
        "status" => "success",
        "message" => "Error logged successfully",
        "log_level" => $logLevel
    ));
    
} catch(Exception $e) {
    // エラーログAPIでエラーが発生した場合
    logCritical("Error logger API failed", array(
        'error' => $e->getMessage(),
        'input_data' => $input ?? 'null'
    ));
    
    http_response_code(500);
    echo json_encode(array(
        "status" => "error", 
        "message" => "Failed to log error: " . $e->getMessage()
    ));
}
?>
