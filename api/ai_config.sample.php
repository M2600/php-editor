<?php
// AI API設定ファイル（サンプル）
// ai_config.phpをコピーして実際の設定値を入力してください

return [
    'api_base_url' => 'https://your-api-endpoint.com/v1',
    'user_apikey_required' => false, // ユーザがAPIキーを提供するかどうか
    'api_key' => 'YOUR_API_KEY_HERE', // 実際のAPIキーを設定してください
    'excluded_models' => [], // 除外するモデルのIDを配列で指定（例: ['model1', 'model2']）
     // APIの種類: 'OpenAI' または 'klab_generic' などを指定
    'api_type' => 'OpenAI',
    'generation_timeout' => 600, // 応答生成のタイムアウト時間（秒）
];
