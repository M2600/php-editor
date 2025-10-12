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
$API_URL = $config['api_base_url'] ?? '';
$API_KEY = $config['api_key'] ?? '';
$API_TYPE = $config['api_type'] ?? 'OpenAI';
$MODELS_PATH = $config['models_path'] ?? null;
$EXCLUDED_MODELS = $config['excluded_models'] ?? []; // 除外するモデルリスト

// Determine models endpoint
if ($MODELS_PATH && strlen($MODELS_PATH) > 0) {
    $API_MODELS_URL = rtrim($API_URL, '/') . '/' . ltrim($MODELS_PATH, '/');
} else {
    if (strtolower($API_TYPE) === 'openai' || strtolower($API_TYPE) === 'openai_compatible') {
        $API_MODELS_URL = rtrim($API_URL, '/') . '/models';
    } else {
        $API_MODELS_URL = rtrim($API_URL, '/') . '/models'; // generic default
    }
}

// 別途用意したデフォルトモデルのURL
$API_DEFAULT_MODEL_URL = 'https://kanemune_ai.dolittle.cc/lmstudio_default.html';


// デフォルトモデルID取得
$defaultModelId = null;
try {
    $ch = curl_init($API_DEFAULT_MODEL_URL);
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
    $ch = curl_init($API_MODELS_URL);
    if ($ch === false) {
        http_response_code(500);
        echo json_encode(['error' => 'curl initialization failed']);
        exit;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        //'x-api-key: ' . $API_KEY, // APIキーをヘッダーに追加
        'Authorization: Bearer ' . $API_KEY,
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    $result = curl_exec($ch);
    if ($result === false) {
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => 'curl_exec failed']);
        exit;
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status !== 200) {
        http_response_code(500);
        echo json_encode(['error' => 'server status ' . $status]);
        exit;
    }
    $parsed = json_decode($result, true);
    $normalized = [];

    if (strtolower($API_TYPE) === 'openai' || strtolower($API_TYPE) === 'openai_compatible') {
        $items = $parsed['data'] ?? [];
        foreach ($items as $m) {
            $id = $m['id'] ?? ($m['model'] ?? null);
            if (!$id) continue;
            if (in_array($id, $EXCLUDED_MODELS, true)) continue;
            $normalized[] = [
                'id' => $id,
                'name' => $m['name'] ?? $id,
                'raw' => $m
            ];
        }
    } else if (strtolower($API_TYPE) === 'klab_generic') {
        $items = $parsed['data'] ?? [];
        foreach ($items['servers'] as $server) {
            foreach($server['models'] as $model) {
                $id = $model['id'] ?? ($model['name'] ?? null);
                if (!$id) continue;
                if (in_array($id, $EXCLUDED_MODELS, true)) continue;
                $normalized[] = [
                    'id' => $server['id'] . '/' . $id,
                    'name' => $server['id'] . '/' . ($model['name'] ?? $server['id'] . '/' . $id),
                    'raw' => $model
                ];
            }
        }
    } else {
        // generic providers: try common shapes
        if (isset($parsed['models']) && is_array($parsed['models'])) {
            $items = $parsed['models'];
        } else if (isset($parsed['data']) && is_array($parsed['data'])) {
            $items = $parsed['data'];
        } else if (is_array($parsed)) {
            $items = $parsed;
        } else {
            $items = [];
        }

        foreach ($items as $m) {
            if (is_string($m)) {
                $id = $m;
                $name = $m;
                $raw = $m;
            } else if (is_array($m)) {
                $id = $m['id'] ?? ($m['name'] ?? null);
                $name = $m['name'] ?? $id;
                $raw = $m;
            } else {
                continue;
            }
            if (!$id) continue;
            if (in_array($id, $EXCLUDED_MODELS, true)) continue;
            $normalized[] = ['id' => $id, 'name' => $name, 'raw' => $raw];
        }
    }

    // mark default
    foreach ($normalized as &$m) {
        if ($defaultModelId && $m['id'] === $defaultModelId) {
            $m['name'] = "Default({$defaultModelId})";
            break;
        }
    }

    echo json_encode(['data' => $normalized]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'モデル一覧の取得中にエラーが発生しました。', 'detail' => $e->getMessage()]);
}



