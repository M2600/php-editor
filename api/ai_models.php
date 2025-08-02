<?php
header('Content-Type: application/json; charset=utf-8');

// 設定
// 設定ファイルの読み込み
$configFile = __DIR__ . '/ai_config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'AI設定ファイルが見つかりません。ai_config.sample.phpを参考にai_config.phpを作成してください。']);
    exit;
}

$config = require $configFile;
$LMSTUDIO_API_URL = $config['lmstudio_base_url'] ?? '';
$LMSTUDIO_MODELS_URL = $LMSTUDIO_API_URL . '/models'; // lmstudioのモデル一覧API

// 別途用意したデフォルトモデルのURL
$LMSTUDIO_DEFAULT_MODEL_URL = 'https://kanemune_ai.dolittle.cc/lmstudio_default.html';


// デフォルトモデルID取得
$defaultModelId = null;
try {
    $defaultModelId = @file_get_contents($LMSTUDIO_DEFAULT_MODEL_URL);
    if ($defaultModelId !== false) {
        $defaultModelId = trim($defaultModelId);
    } else {
        $defaultModelId = null;
    }
} catch (Throwable $e) {
    $defaultModelId = null;
}

// モデル一覧取得
try {
    $ch = curl_init($LMSTUDIO_MODELS_URL);
    if ($ch === false) {
        // エラーは返さない
        echo json_encode(['data' => []]);
        exit;
    }
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    $result = curl_exec($ch);
    if ($result === false) {
        curl_close($ch);
        echo json_encode(['data' => []]);
        exit;
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status !== 200) {
        echo json_encode(['data' => []]);
        exit;
    }
    $models = json_decode($result, true);
    if (!isset($models['data']) || !is_array($models['data'])) {
        echo json_encode(['data' => []]);
        exit;
    }

    // name項目を追加
    foreach ($models['data'] as &$model) {
        if ($defaultModelId && $model['id'] === $defaultModelId) {
            $model['name'] = "Default({$defaultModelId})";
        } else {
            $model['name'] = $model['id'];
        }
    }
    unset($model);

    echo json_encode(['data' => $models['data']]);
} catch (Throwable $e) {
    // エラーは返さない
    echo json_encode(['data' => []]);
}



