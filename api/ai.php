<?php
header('Content-Type: application/json; charset=utf-8');

session_start();
// 設定
$LMSTUDIO_API_URL = 'https://kanemune_ai.dolittle.cc/lmstudio/v1/chat/completions'; // lmstudioのAPIエンドポイント
$API_KEY = '***REMOVED***'; // 必要に応じて環境変数や設定ファイルから取得

// POSTデータ取得
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

$messages = isset($input['messages']) ? $input['messages'] : [];
if (!is_array($messages) || count($messages) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'No messages']);
    exit;
}

// $logDir = __DIR__ . '/../log';
//$logDir = '/var/log/php_editor';
$userRoot = $user = posix_getpwuid(posix_getuid())["dir"];
$LOG_DIR = $userRoot . "/data/php_editor/log/";
if(!file_exists($LOG_DIR)){
    mkdir($LOG_DIR, 0777, true);
}
$logFile = $LOG_DIR . "chat.log";

// ログ出力関数
function log_chat_request($logFile, $input, $messages) {
    $ts = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '-';
    $user = isset($_SESSION['id']) ? $_SESSION['id'] : '-';
    $model = $input['model'] ?? 'default';
    $fileContext = isset($input['fileContext']) && !empty($input['fileContext']['content']) ? 'yes' : 'no';
    $log = [
        'time' => $ts,
        'user' => $user,
        'ip' => $ip,
        'model' => $model,
        'fileContext' => $fileContext,
        'messages' => $messages
    ];
    $line = json_encode($log, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . "\n";
    file_put_contents($logFile, $line, FILE_APPEND|LOCK_EX);
}

// ログ保存
log_chat_request($logFile, $input, $messages);
$basePrompt = [
    [
        'role' => 'system',
        'content' => 'あなたは親切なAIアシスタントです。すべての返答はマークダウン形式で出力してください。'
    ]
];



// ファイル内容が送信されていればsystemメッセージとして追加
if (isset($input['fileContext']) && is_array($input['fileContext']) && !empty($input['fileContext']['content'])) {
    $fileMsg = [
        'role' => 'system',
        'content' => '[ファイル内容] ' . ($input['fileContext']['name'] ?? 'ファイル') . "\n" . $input['fileContext']['content']
    ];
    array_unshift($messages, $fileMsg);
}

$payload = [
    'model' => isset($input['model']) ? $input['model'] : 'default',
    'messages' => array_merge($basePrompt, $messages),
    'stream' => true
];

// cURL処理は下のtryブロックでのみ実行

try {
    $ch = curl_init($LMSTUDIO_API_URL);
    if ($ch === false) {
        throw new Exception('cURL初期化エラー');
    }
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $API_KEY
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
        echo $data;
        return strlen($data);
    });

    // ストリームで返す
    curl_setopt($ch, CURLOPT_HEADER, false);
    @ob_end_clean();
    header('X-Accel-Buffering: no');
    header('Cache-Control: no-cache');
    header('Content-Encoding: none');
    flush();

    $result = curl_exec($ch);
    if ($result === false) {
        $err = curl_error($ch);
        curl_close($ch);
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'cURL実行エラー: ' . $err]);
        exit;
    }
    curl_close($ch);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'サーバーエラー: ' . $e->getMessage()]);
    exit;
}
exit;
