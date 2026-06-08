<?php
require_once(__DIR__ . '/session_init.php');
requireLogin();
require_once(__DIR__ . '/logger.php');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    exit();
}

try {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON data");
    }

    if (!isset($data['message'])) {
        throw new Exception("Missing required field: message");
    }

    $type = strtolower($data['type'] ?? 'info');

    $logLevel = 'INFO';
    switch ($type) {
        case 'javascript_error':
        case 'uncaught_exception':
        case 'console_error':
        case 'error':
            $logLevel = 'ERROR';
            break;
        case 'warning':
            $logLevel = 'WARNING';
            break;
        case 'debug':
            $logLevel = 'DEBUG';
            break;
        case 'info':
        default:
            $logLevel = 'INFO';
            break;
    }

    $context = [
        'source'           => $data['source'] ?? 'browser',
        'type'             => $type,
        'client_timestamp' => $data['timestamp'] ?? null,
        'user_agent'       => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'remote_addr'      => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'session_id'       => session_id(),
    ];

    foreach (['url', 'line', 'column', 'stack', 'filename', 'additional_info'] as $field) {
        if (isset($data[$field])) {
            $context[$field] = $data[$field];
        }
    }

    $prefix = ($context['source'] !== 'browser' ? ucfirst($context['source']) : 'Browser') . ': ';

    switch ($logLevel) {
        case 'DEBUG':
            logDebug($prefix . $data['message'], $context);
            break;
        case 'WARNING':
            logWarning($prefix . $data['message'], $context);
            break;
        case 'ERROR':
            logError($prefix . $data['message'], $context);
            break;
        default:
            logInfo($prefix . $data['message'], $context);
            break;
    }

    echo json_encode([
        "status"    => "success",
        "message"   => "Logged successfully",
        "log_level" => $logLevel,
    ]);

} catch (Exception $e) {
    logCritical("client_log API failed", [
        'error'      => $e->getMessage(),
        'input_data' => $input ?? 'null',
    ]);

    http_response_code(500);
    echo json_encode([
        "status"  => "error",
        "message" => "Failed to log: " . $e->getMessage(),
    ]);
}
?>
