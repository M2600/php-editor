<?php
header('Content-Type: application/json');

session_start();
if(!isset($_SESSION["id"])){
    echo json_encode(array("status" => "session_error", "error" => "Not logged in"));
    exit();
}

require_once("ai_config.php");

if(!$_SERVER["REQUEST_METHOD"] == "POST"){
    echo json_encode(array("status" => "error", "error" => "Invalid request method"));
    exit();
}

$params = json_decode(file_get_contents('php://input'), true);
$action = $params["action"];

// Get AI configuration
$config = getAIConfig();
$OLLAMA_SERVER = $config['OLLAMA_SERVER'];
$OLLAMA_MODEL = $config['OLLAMA_MODEL'];
$TIMEOUT = $config['TIMEOUT'];

function callOllama($prompt, $model = null) {
    $config = getAIConfig();
    $OLLAMA_SERVER = $config['OLLAMA_SERVER'];
    $TIMEOUT = $config['TIMEOUT'];
    
    if ($model === null) {
        $model = $config['OLLAMA_MODEL'];
    }
    
    $url = $OLLAMA_SERVER . "/api/generate";
    
    $data = array(
        "model" => $model,
        "prompt" => $prompt,
        "stream" => false
    );
    
    $options = array(
        'http' => array(
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => json_encode($data),
            'timeout' => $TIMEOUT
        )
    );
    
    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    if ($result === FALSE) {
        return array("status" => "error", "error" => "Failed to connect to Ollama server at " . $OLLAMA_SERVER);
    }
    
    $response = json_decode($result, true);
    
    if (isset($response['response'])) {
        return array("status" => "success", "response" => $response['response']);
    } else {
        return array("status" => "error", "error" => "Invalid response from Ollama: " . json_encode($response));
    }
}

// Function to extract code from AI response
function extractCodeFromResponse($response) {
    // Remove <think> tags and content
    $cleaned = preg_replace('/<think>.*?<\/think>/s', '', $response);
    
    // Extract code blocks (```language ... ```)
    if (preg_match_all('/```(?:php|javascript|html|css|sql|json)?\s*\n(.*?)\n```/s', $cleaned, $matches)) {
        return implode("\n\n", $matches[1]);
    }
    
    // Extract code blocks without language specification
    if (preg_match_all('/```\s*\n(.*?)\n```/s', $cleaned, $matches)) {
        return implode("\n\n", $matches[1]);
    }
    
    // If no code blocks found, clean the response and return
    $cleaned = trim($cleaned);
    
    // Remove common AI explanation patterns
    $patterns = [
        '/^.*?以下.*?コード.*?[:：]\s*/s',
        '/^.*?修正.*?[:：]\s*/s',
        '/^.*?リファクタリング.*?[:：]\s*/s',
        '/^.*?提案.*?[:：]\s*/s',
        '/^.*?補完.*?[:：]\s*/s',
    ];
    
    foreach ($patterns as $pattern) {
        $cleaned = preg_replace($pattern, '', $cleaned);
    }
    
    return trim($cleaned);
}

if($action == "code_suggestion"){
    $code = $params["code"];
    $cursor_position = $params["cursor_position"];
    $file_type = $params["file_type"];
    
    // Create a prompt for code suggestion
    $prompt = "あなたはプログラミングアシスタントです。以下のコードの文脈を理解して、役立つコードの提案や補完を行ってください。コードブロック（```で囲む）を使用してコードのみを返してください。\n\n";
    $prompt .= "ファイルタイプ: " . $file_type . "\n";
    $prompt .= "コード:\n" . $code . "\n\n";
    $prompt .= "現在のカーソル位置に対するコード提案:";
    
    $result = callOllama($prompt);
    
    if ($result['status'] === 'success') {
        $extractedCode = extractCodeFromResponse($result['response']);
        $result['response'] = $extractedCode;
        $result['raw_response'] = $result['response']; // Keep original for debugging
    }
    
    echo json_encode($result);
    exit();
}

if($action == "code_completion"){
    $code = $params["code"];
    $current_line = $params["current_line"];
    $file_type = $params["file_type"];
    
    // Create a prompt for code completion
    $prompt = "以下のコードを補完してください。コードブロック（```で囲む）を使用してコードのみを返してください。\n\n";
    $prompt .= "ファイルタイプ: " . $file_type . "\n";
    $prompt .= "コード:\n" . $code . "\n";
    $prompt .= "補完する行: " . $current_line . "\n\n";
    $prompt .= "補完コード:";
    
    $result = callOllama($prompt);
    
    if ($result['status'] === 'success') {
        $extractedCode = extractCodeFromResponse($result['response']);
        $result['response'] = $extractedCode;
        $result['raw_response'] = $result['response']; // Keep original for debugging
    }
    
    echo json_encode($result);
    exit();
}

if($action == "code_explanation"){
    $code = $params["code"];
    $selected_code = $params["selected_code"];
    $file_type = $params["file_type"];
    
    // Create a prompt for code explanation
    $prompt = "以下のコードについて、分かりやすく日本語で説明してください。プログラミング初心者にも理解できるように説明してください。\n\n";
    $prompt .= "ファイルタイプ: " . $file_type . "\n";
    if (!empty($selected_code)) {
        $prompt .= "選択されたコード:\n" . $selected_code . "\n\n";
    } else {
        $prompt .= "コード:\n" . $code . "\n\n";
    }
    $prompt .= "説明:";
    
    $result = callOllama($prompt);
    echo json_encode($result);
    exit();
}

if($action == "code_fix"){
    $code = $params["code"];
    $error_message = $params["error_message"];
    $file_type = $params["file_type"];
    
    // Create a prompt for code fixing
    $prompt = "以下のコードにエラーがあります。エラーメッセージを参考に修正してください。コードブロック（```で囲む）を使用してコードのみを返してください。\n\n";
    $prompt .= "ファイルタイプ: " . $file_type . "\n";
    $prompt .= "エラーメッセージ: " . $error_message . "\n";
    $prompt .= "コード:\n" . $code . "\n\n";
    $prompt .= "修正されたコード:";
    
    $result = callOllama($prompt);
    
    if ($result['status'] === 'success') {
        $extractedCode = extractCodeFromResponse($result['response']);
        $result['response'] = $extractedCode;
        $result['raw_response'] = $result['response']; // Keep original for debugging
    }
    
    echo json_encode($result);
    exit();
}

if($action == "code_refactor"){
    $code = $params["code"];
    $selected_code = $params["selected_code"];
    $file_type = $params["file_type"];
    
    // Create a prompt for code refactoring
    $prompt = "以下のコードをより綺麗で効率的になるようにリファクタリングしてください。コードブロック（```で囲む）を使用してコードのみを返してください。\n\n";
    $prompt .= "ファイルタイプ: " . $file_type . "\n";
    if (!empty($selected_code)) {
        $prompt .= "リファクタリング対象のコード:\n" . $selected_code . "\n\n";
    } else {
        $prompt .= "リファクタリング対象のコード:\n" . $code . "\n\n";
    }
    $prompt .= "リファクタリングされたコード:";
    
    $result = callOllama($prompt);
    
    if ($result['status'] === 'success') {
        $extractedCode = extractCodeFromResponse($result['response']);
        $result['response'] = $extractedCode;
        $result['raw_response'] = $result['response']; // Keep original for debugging
    }
    
    echo json_encode($result);
    exit();
}

echo json_encode(array("status" => "error", "error" => "Invalid action"));
?>
