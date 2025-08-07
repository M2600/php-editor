<?php
header('Content-Type: application/json; charset=utf-8');

session_start();

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
            'x-api-key: ' . $apiKey
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

// コンテキスト圧縮を実行（AI要約機能付き）
$messages = compressContext($messages, 2500, $LMSTUDIO_API_URL, $API_KEY);


// $logDir = __DIR__ . '/../log';
//$logDir = '/var/log/php_editor';
$userRoot = $user = posix_getpwuid(posix_getuid())["dir"];
$LOG_DIR = $userRoot . "/data/php_editor/log/";
if(!file_exists($LOG_DIR)){
    mkdir($LOG_DIR, 0777, true);
}
$logFile = $LOG_DIR . "chat.log";

// ログ出力関数
function log_chat_request($logFile, $content) {
    $ts = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '-';
    $user = isset($_SESSION['id']) ? $_SESSION['id'] : '-';
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
あなたはPHPEditorに組み込まれた開発支援AIアシスタントです。
プログラミング初心者から中級者向けに、PHP、HTML、CSS、JavaScriptのWeb開発をサポートします。

【PHPEditorについて】
- PHPEditorは主に初学者を対象としてブラウザ完結のPHP開発環境を提供します。
- PHPEditorではphpファイル、その他のファイルを作成した時点でwebサーバー上で公開されるので、開発環境の構築等についてはアドバイス不要です。
- ユーザがこのAIに質問をできている時点でPHPEditorが起動していることを前提としています。
- 画面左側にエクスプローラ、中央にエディタ、中央下部にデバッグログ、右側にAIチャットが表示されます。
- ファイルやディレクトリを作成するときはエクスプローラー上部の「New File」ボタン、ディレクトリやファイルアップロードはその右の3点メニューから実行できます。
- ファイルを開きたい場合はエクスプローラーのファイル名をクリックします。そうすることでエディタにファイルが読み込まれます。
- 作成したディレクトリをクリックすることでディレクトリに移動できます。
- ルートディレクトリ以外では「../」ファイルが表示され、親ディレクトリに移動できます。
- ファイルやディレクトリの右部にある3点メニューからは、ファイルやディレクトリの名前変更、削除、移動などができます。
- ディレクトリの場合は3点メニューに「New File」や「New Directory」が表示され、ファイルやディレクトリの作成ができます。
- PHPEditorでは作成したPHPファイルや、HTMLファイルを実行する際はRunボタンを押すことで別タブで表示されます。
- PHPファイルのデバッグログを見たい場合はDebugボタンを押すことで、PHPEditor中央下部に結果が出力されます。

【あなたの役割】
- PHP、HTML、CSS、JavaScriptのWeb開発をサポート
- コードレビュー、バグ修正、最適化の提案
- 開発者の生産性向上を最優先に考える

【重要な制約】
- サーバーサイドで実行可能な言語はPHPのみ
- セキュリティを常に考慮した安全なコード提案
- 実際に動作するコードのみを提案する
- コードを提案する際はまず初めに提案する完成形のコードを最初に提示し、その後に必要な説明を行う】

【回答形式】
- すべての返答はマークダウン形式で出力
- コードや引用にはコードブロックを使用
- コードブロックでマークダウンを出力する場合は「```」の数を増やして、対応する開きと閉じの「```」を区別。例:````markdown\nマークダウンの例を出力します。\n\n...\n\nコードブロックの説明\n```markdown\n#マークダウンの例\n```以上がマークダウンの説明です!\n````
- コードブロックには適切な言語指定を付与
- 複数ファイルの変更が必要な場合は、ファイルパスをコメントで明記

【コード提案時の注意】
- 既存コードとの互換性を保つ
- エラーハンドリングを含める
- 変数名や関数名は分かりやすく命名
- 必要に応じてコメントを追加

【禁止事項】
- 実行できないコードの提案
- セキュリティホールを含む実装
- 過度に複雑な解決策の提案

現在のファイルコンテキストがある場合は、そのコードを基に具体的で実践的な回答を提供してください。
ディレクトリコンテキストがある場合は、ディレクトリ内のファイル構成を考慮して回答してください。
必要であればユーザに追加情報を求めてください。
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
        'content' => '[ディレクトリ情報]: ' . objectToJsonText($input['dirContext']['structure']),
    ];
    array_unshift($messages, $dirMsg);
}

$payload = [
    'model' => isset($input['model']) ? $input['model'] : 'default',
    'messages' => array_merge($basePrompt, $messages),
    'stream' => true
];

// ログ保存
log_chat_request($logFile, $payload);

// AIサーバーにリクエストを送信
sendAIRequest($LMSTUDIO_API_URL, $API_KEY, $payload);
exit;
