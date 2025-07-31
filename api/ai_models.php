<?php
header('Content-Type: application/json; charset=utf-8');

// 設定
$LMSTUDIO_MODELS_URL = 'https://kanemune_ai.dolittle.cc/lmstudio/v1/models'; // lmstudioのモデル一覧API

try {
    $ch = curl_init($LMSTUDIO_MODELS_URL);
    if ($ch === false) {
        throw new Exception('cURL初期化エラー');
    }
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    $result = curl_exec($ch);
    if ($result === false) {
        $err = curl_error($ch);
        curl_close($ch);
        http_response_code(500);
        echo json_encode(['error' => 'cURL実行エラー: ' . $err]);
        exit;
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status !== 200) {
        http_response_code($status);
        echo json_encode(['error' => 'lmstudio APIエラー: HTTP ' . $status]);
        exit;
    }
    // 取得したJSONをそのまま返す
    echo $result;
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラー: ' . $e->getMessage()]);
    exit;
}
