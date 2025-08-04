<?php
header('Content-Type: application/json; charset=utf-8');

session_start();

// フォーマットされたプロンプトメッセージを生成する関数
function formatPromptMessages($messages) {
    /*
    メッセージはuserとassistantのロールを交互に持つ必要があります。
    例:
    [
        ['role' => 'user', 'content' => 'ユーザーのメッセージ'],
        ['role' => 'assistant', 'content' => 'AIの応答'],
        ['role' => 'user', 'content' => '次のユーザーのメッセージ'],
        // ...
    ] 
    この関数では、メッセージのロールが正しく交互になっているかをチェックし、必要に応じてフォーマットします。

    */
    // まずメッセージのはじめがuserでない場合は、最初がuserになるまで先頭を削除
    while ($messages) {
        if ($messages[0]['role'] === 'user'){
            break;
        }
        else{
            array_shift($messages);
        }
    }

    //交互に並んでいるかチェックし、連続している箇所があれば連続しているもののうち、古いものを削除
    $formatted = [];
    $lastRole = null;
    foreach (array_reverse($messages) as $message) {
        if (!isset($message['role']) || !isset($message['content'])) {
            continue; // ロールまたはコンテンツがないメッセージはスキップ
        }
        if ($message['role'] !== $lastRole || $lastRole === null) {
            $formatted[] = $message; // ロールが変わった場合のみ追加
            $lastRole = $message['role'];
        } else {
            // 連続している場合は、古いものを削除
            continue;
        }
    }
    $formatted = array_reverse($formatted); // 元の順序に戻す
    return $formatted;
}

// 設定ファイルの読み込み
$configFile = __DIR__ . '/ai_config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'AI設定ファイルが見つかりません。ai_config.sample.phpを参考にai_config.phpを作成してください。']);
    exit;
}

$config = require $configFile;
$LMSTUDIO_API_URL = $config['lmstudio_base_url'] ?? '';
$API_KEY = $config['api_key'] ?? '';

if (empty($API_KEY) || $API_KEY === 'YOUR_API_KEY_HERE') {
    http_response_code(500);
    echo json_encode(['error' => 'APIキーが設定されていません。ai_config.phpで正しいAPIキーを設定してください。']);
    exit;
}

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
$messages = formatPromptMessages($messages);


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
    $chat_url = $LMSTUDIO_API_URL . '/chat/completions';
    $ch = curl_init($chat_url);
    if ($ch === false) {
        throw new Exception('cURL初期化エラー');
    }
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $API_KEY
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 600); // タイムアウトを600秒に設定
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_FAILONERROR, false); // HTTPエラーでも継続
    
    // エラーハンドリング用のバッファ
    $errorBuffer = '';
    $hasStreamStarted = false;
    $responseStarted = false;
    
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$errorBuffer, &$hasStreamStarted, &$responseStarted) {
        $responseStarted = true;
        
        // AIサーバーからのエラーレスポンスをチェック
        if (!$hasStreamStarted) {
            $errorBuffer .= $data;
            // JSONエラーレスポンスかチェック
            if (strpos($data, '{') !== false && strpos($data, 'error') !== false) {
                $jsonStart = strpos($errorBuffer, '{');
                if ($jsonStart !== false) {
                    $jsonPart = substr($errorBuffer, $jsonStart);
                    $decoded = json_decode($jsonPart, true);
                    if ($decoded && isset($decoded['error'])) {
                        // エラーレスポンスをそのまま返す
                        echo $data;
                        return strlen($data);
                    }
                }
            }
            // ストリーム開始の判定
            if (strpos($data, 'data:') !== false) {
                $hasStreamStarted = true;
            }
        }
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
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    if ($result === false) {
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => 'AIサーバーとの通信に失敗しました: ' . $curlError]);
        exit;
    }
    
    // レスポンスが全く受信されていない場合（サーバーダウン等）
    if (!$responseStarted) {
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => 'AIサーバーから応答がありません。サーバーがダウンしている可能性があります。']);
        exit;
    }
    
    // HTTPエラーコードのチェック
    if ($httpCode >= 400) {
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => "AIサーバーエラー (HTTP $httpCode)"]);
        exit;
    }
    
    curl_close($ch);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラー: ' . $e->getMessage()]);
    exit;
}
exit;
