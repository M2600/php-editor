<?php
/**
 * カスタムAI APIのモデル一覧取得エンドポイント
 * POSTリクエストでbaseUrlとapiKeyを受け取り、モデル一覧を返す
 */

header('Content-Type: application/json; charset=utf-8');

// POSTメソッドのみ受け付ける
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Use POST.']);
    exit;
}

// POSTデータを取得
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON in request body']);
    exit;
}

$baseUrl = $data['baseUrl'] ?? '';
$apiKey = $data['apiKey'] ?? '';

// バリデーション
if (empty($baseUrl)) {
    http_response_code(400);
    echo json_encode(['error' => 'baseUrl is required']);
    exit;
}

if (empty($apiKey)) {
    http_response_code(400);
    echo json_encode(['error' => 'apiKey is required']);
    exit;
}

// モデルエンドポイントのURL構築
// OpenAI互換APIを想定
$modelsUrl = rtrim($baseUrl, '/') . '/models';

// モデル一覧を取得
try {
    $ch = curl_init($modelsUrl);
    if ($ch === false) {
        http_response_code(500);
        echo json_encode(['error' => 'curl initialization failed']);
        exit;
    }

    // リクエストヘッダー設定
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ];

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // 10秒でタイムアウト
    
    $result = curl_exec($ch);
    
    if ($result === false) {
        $error = curl_error($ch);
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch models', 'detail' => $error]);
        exit;
    }

    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // ステータスコードチェック
    if ($status !== 200) {
        http_response_code(502);
        echo json_encode([
            'error' => 'Custom API returned error',
            'status' => $status,
            'response' => $result
        ]);
        exit;
    }

    // レスポンスをパース
    $parsed = json_decode($result, true);
    
    if (!$parsed) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to parse API response']);
        exit;
    }

    // OpenAI互換フォーマットを想定（data配列にモデルリスト）
    $normalized = [];
    $items = $parsed['data'] ?? [];

    foreach ($items as $model) {
        $id = $model['id'] ?? ($model['model'] ?? null);
        if (!$id) continue;

        $normalized[] = [
            'id' => $id,
            'name' => $model['name'] ?? $id,
            'raw' => $model
        ];
    }

    // レスポンス返却
    echo json_encode([
        'data' => $normalized,
        'count' => count($normalized)
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Exception occurred while fetching models',
        'detail' => $e->getMessage()
    ]);
}
