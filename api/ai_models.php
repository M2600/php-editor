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
$EXCLUDED_MODELS = $config['excluded_models'] ?? []; // 除外するモデルリスト

// 別途用意したデフォルトモデルのURL
$LMSTUDIO_DEFAULT_MODEL_URL = 'https://kanemune_ai.dolittle.cc/lmstudio_default.html';


// デフォルトモデルID取得
$defaultModelId = null;
try {
    $ch = curl_init($LMSTUDIO_DEFAULT_MODEL_URL);
    if ($ch === false) {
        $defaultModelId = null;
    } else {
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        $result = curl_exec($ch);
        if ($result === false) {
            curl_close($ch);
            $defaultModelId = null;
        } else {
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($status === 200) {
                $defaultModelId = trim($result);
            } else {
                $defaultModelId = null;
            }
        }
    }
} catch (Throwable $e) {
    $defaultModelId = null;
}

// モデル一覧取得
try {
    $ch = curl_init($LMSTUDIO_MODELS_URL);
    if ($ch === false) {
        http_response_code(500);
        echo json_encode(['error' => 'モデル一覧の取得に失敗しました。']);
        exit;
    }
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    $result = curl_exec($ch);
    if ($result === false) {
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => 'モデル一覧の取得に失敗しました。']);
        exit;
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status !== 200) {
        http_response_code(500);
        echo json_encode(['error' => 'モデル一覧の取得に失敗しました。']);
        exit;
    }
    $models = json_decode($result, true);
    if (!isset($models['data']) || !is_array($models['data'])) {
        http_response_code(500);
        echo json_encode(['error' => 'モデル一覧の取得に失敗しました。']);
        exit;
    }

    // name項目を追加し、除外モデルをフィルタリング
    $filteredModels = [];
    foreach ($models['data'] as $model) {
        // 除外モデルをスキップ
        if (in_array($model['id'], $EXCLUDED_MODELS, true)) {
            continue;
        }
        
        if ($defaultModelId && $model['id'] === $defaultModelId) {
            $model['name'] = "Default({$defaultModelId})";
        } else {
            $model['name'] = $model['id'];
        }
        $filteredModels[] = $model;
    }

    echo json_encode(['data' => $filteredModels]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'モデル一覧の取得中にエラーが発生しました。', 'detail' => $e->getMessage()]);
}



