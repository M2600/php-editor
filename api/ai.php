<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json; charset=utf-8');

// ログイン認証チェック
requireLogin();
// セッション情報を早期に取得（AI処理前に必要な情報を全て取得）
$sessionId = session_id();
$userId = isset($_SESSION['id']) ? $_SESSION['id'] : null;

// セッションの排他ロックを解除（他のリクエストをブロックしないため）
session_write_close();

// コンテキスト圧縮機能を読み込み
require_once __DIR__ . '/ai_context_compression.php';

/**
 * AIサーバーにリクエストを送信してストリーミングレスポンスを処理する
 */
function sendAIRequest($apiUrl, $apiKey, $payload) {
    try {
        $chat_url = $apiUrl . '/chat/completions';
        $ch = curl_init($chat_url);
        if ($ch === false) {
            throw new Exception('cURL初期化エラー');
        }
        
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            //'x-api-key: ' . $apiKey,
            'Authorization: Bearer ' . $apiKey
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
}

// オブジェクト(辞書形式)をjson形式のテキストに変換する関数
function objectToJsonText($obj) {
    if (is_array($obj) || is_object($obj)) {
        $json = json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return 'JSONエンコードエラー: ' . json_last_error_msg();
        }
        return $json;
    } else {
        return (string)$obj; // 文字列に変換
    }
}


// フォーマットされたプロンプトメッセージを生成する関数
function formatPromptMessages($messages) {
    /*
    メッセージはuserとassistantのロールを交互に持つ必要があります。
    ただし、tool呼び出しとtoolレスポンスは例外として扱います。
    例:
    [
        ['role' => 'user', 'content' => 'ユーザーのメッセージ'],
        ['role' => 'assistant', 'content' => 'AIの応答'],
        ['role' => 'user', 'content' => '次のユーザーのメッセージ'],
        // ツール使用の場合:
        ['role' => 'assistant', 'content' => '', 'tool_calls' => [...]],
        ['role' => 'tool', 'tool_call_id' => '...', 'content' => '...'],
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
        if (!isset($message['role'])) {
            continue; // ロールがないメッセージはスキップ
        }
        
        // toolメッセージは常に追加（tool_call_idとnameが必須）
        if ($message['role'] === 'tool') {
            if (isset($message['tool_call_id']) && isset($message['content'])) {
                $formatted[] = $message;
            }
            continue;
        }
        
        // assistantメッセージでtool_callsがある場合も常に追加
        if ($message['role'] === 'assistant' && isset($message['tool_calls'])) {
            $formatted[] = $message;
            $lastRole = 'assistant';
            continue;
        }
        
        // 通常のメッセージ（contentが必須）
        if (!isset($message['content'])) {
            continue;
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
    echo json_encode(['error' => 'AI configuration error']);
    exit;
}

$config = require $configFile;
$API_URL = $config['api_base_url'] ?? '';
$API_KEY = $config['api_key'] ?? '';



if (empty($API_KEY) || $API_KEY === 'YOUR_API_KEY_HERE') {
    http_response_code(500);
    echo json_encode(['error' => 'APIkey is not set']);
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

// カスタムURL及びAPIキーの処理
$customUrl = isset($input['customUrl']) && !empty($input['customUrl']) ? $input['customUrl'] : null;
$customApiKey = isset($input['customApiKey']) && !empty($input['customApiKey']) ? $input['customApiKey'] : null;

// カスタム設定がある場合は上書き
if ($customUrl) {
    $API_URL = rtrim($customUrl, '/'); // 末尾のスラッシュを削除
    error_log("Using custom API URL: " . $API_URL);
}
if ($customApiKey) {
    $API_KEY = $customApiKey;
    error_log("Using custom API Key (length: " . strlen($API_KEY) . ")");
}

// コンテキスト圧縮を実行（AI要約機能付き）
$messages = compressContext($messages, 2500, $API_URL, $API_KEY);


// $logDir = __DIR__ . '/../log';
//$logDir = '/var/log/php_editor';
$userRoot = $user = posix_getpwuid(posix_getuid())["dir"];
$LOG_DIR = $userRoot . "/data/php_editor/log/";
if(!file_exists($LOG_DIR)){
    mkdir($LOG_DIR, 0777, true);
}
$logFile = $LOG_DIR . "chat.log";

// ログ出力関数
function log_chat_request($logFile, $content, $userId = null) {
    $ts = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '-';
    $user = $userId ?? '-';
    $request = $content ? $content : '';
    $log = [
        'timestamp' => $ts,
        'user' => $user,
        'ip' => $ip,
        'request' => $request
    ];

    $line = json_encode($log, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    file_put_contents($logFile, $line, FILE_APPEND|LOCK_EX);
}

$basePrompt = [
    [
        'role' => 'system',
        'content' => <<<EOF
あなたはPHPEditorに常駐するAI開発アシスタントです。

# ミッション
あなたの使命は、PHP・HTML・CSS・JavaScriptを学ぶ初級〜中級者のWeb開発をサポートし、生産性を最大化することです。安全で実用的なコードを提供してください。
# PHPEditorの環境制約
    サーバーサイド言語はPHPのみです。
    ファイルは作成時点でWebサーバーに公開されます。
    サーバー構築や環境設定に関するアドバイスは一切不要です。
# 技術スタックの制約
    許可される技術:
        PHP: サーバーサイド処理。フレームワークは使用せず、標準関数やビルトイン機能のみを利用してください。
        HTML: Webページの構造定義。
        CSS: スタイリング。フレームワーク（Bootstrap, Tailwind CSS等）は使用しないでください。
        JavaScript: クライアントサイドの動的な処理。フレームワークやライブラリ（jQuery, React, Vue.js等）は使用せず、Vanilla JS（素のJavaScript）で記述してください。
        データ保存: データベース（MySQL, SQLite等）は利用できません。データの永続化が必要な場合は、JSONファイルやCSVファイルへの読み書きで対応してください。
    禁止される技術:
        PHPのフレームワーク (Laravel, Symfony, CakePHPなど)
        JavaScriptのフレームワーク・ライブラリ (jQuery, React, Vue, Angularなど)
        CSSのフレームワーク (Bootstrap, Tailwind CSSなど)
        パッケージマネージャ (Composer, npm, yarnなど)
        データベース (MySQL, PostgreSQL, SQLiteなど)
        Node.js, Python, RubyなどのPHP以外のサーバーサイド技術
# 回答の絶対原則
    【コード第一】 最初に必ず完成形のコード全体を提示し、その後に必要な説明を簡潔に記述してください。
    【動作保証】 提案するコードは、必ず上記の制約内で実行可能なものに限ります。
    【高品質なコード】 変数名や関数名は分かりやすく命名し、必要なコメントを含めてください。
    【形式】
        全ての回答はMarkdown形式で出力してください。
        コードブロックには必ず言語（php, htmlなど）を指定してください。
        複数ファイルを提示する場合は、コードブロックの冒頭にコメントでファイルパスを明記してください。（例: // index.php）
# コンテキストの利用
    ユーザーから提供されたファイルやディレクトリの情報を基に、具体的で実践的な回答を生成してください。
    情報が不足している場合は、追加の情報を要求してください。
EOF
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

// ディレクトリ情報が送信されていればsystemメッセージとして追加
if (isset($input['dirContext']) && !empty($input['dirContext']['structure'])) {
    $dirMsg = [
        'role' => 'system',
        'content' => '[PHPエディタのカレントディレクトリ]: ' . objectToJsonText($input['dirContext']['structure']),
    ];
    array_unshift($messages, $dirMsg);
}

$payload = [
    'model' => isset($input['model']) ? $input['model'] : 'default',
    'messages' => array_merge($basePrompt, $messages),
    'stream' => true
];

// ツール定義が送信されていれば追加
if (isset($input['tools']) && is_array($input['tools']) && !empty($input['tools'])) {
    $payload['tools'] = $input['tools'];
    $payload['tool_choice'] = 'auto'; // AIが必要に応じてツールを使用
}

// ログ保存（早期取得したセッション情報を使用）
log_chat_request($logFile, $payload, $userId);

// AIサーバーにリクエストを送信
//sendAIRequest($API_URL, $API_KEY, $payload);
sendAIRequest($API_URL, $API_KEY, $payload);
exit;
