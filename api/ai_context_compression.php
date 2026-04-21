<?php

/**
 * AIチャット用コンテキスト圧縮機能
 * 
 * このファイルはAIチャットでのコンテキスト溢れを防ぐための
 * 各種圧縮機能を提供します。
 */

/**
 * メッセージの文字数を概算でカウント（トークン数の近似）
 */
function estimateTokenCount($messages) {
    $totalChars = 0;
    foreach ($messages as $msg) {
        // contentが文字列の場合
        if (isset($msg['content']) && is_string($msg['content'])) {
            $totalChars += mb_strlen($msg['content'], 'UTF-8');
        }
        // contentが配列の場合（tool messageなど）
        elseif (isset($msg['content']) && is_array($msg['content'])) {
            $totalChars += mb_strlen(json_encode($msg['content'], JSON_UNESCAPED_UNICODE), 'UTF-8');
        }
        // tool_callsがある場合
        if (isset($msg['tool_calls']) && is_array($msg['tool_calls'])) {
            $totalChars += mb_strlen(json_encode($msg['tool_calls'], JSON_UNESCAPED_UNICODE), 'UTF-8');
        }
    }
    // 1トークン ≈ 4文字（日本語）として概算
    return intval($totalChars / 4);
}

/**
 * メッセージからソースコードを除去・要約する
 */
function removeCodeFromMessages($messages) {
    $processedMessages = [];
    
    foreach ($messages as $message) {
        if (!isset($message['content'])) {
            $processedMessages[] = $message;
            continue;
        }
        
        // contentが配列の場合（tool messageなど）はそのまま
        if (is_array($message['content'])) {
            $processedMessages[] = $message;
            continue;
        }
        
        $content = $message['content'];
        $originalLength = mb_strlen($content);
        
        // コードブロック（```）を検出して置換
        $content = preg_replace_callback('/```(\w*)\n(.*?)\n```/s', function($matches) {
            $language = $matches[1] ?: '不明';
            $code = $matches[2];
            $lines = explode("\n", $code);
            $lineCount = count($lines);
            
            // コードの簡単な要約を作成
            $summary = "[$language コード: {$lineCount}行]";
            
            // 重要そうなキーワードを抽出（関数名、クラス名など）
            $keywords = [];
            if (preg_match_all('/(?:function|class|const|var|let)\s+(\w+)/i', $code, $keywordMatches)) {
                $keywords = array_unique($keywordMatches[1]);
                if (count($keywords) > 0) {
                    $summary .= " 含む要素: " . implode(', ', array_slice($keywords, 0, 3));
                    if (count($keywords) > 3) $summary .= "など";
                }
            }
            
            return $summary;
        }, $content);
        
        // インラインコード（`code`）も短縮
        $content = preg_replace_callback('/`([^`]+)`/', function($matches) {
            $code = $matches[1];
            if (mb_strlen($code) > 20) {
                return "`" . mb_substr($code, 0, 15) . "...`";
            }
            return $matches[0];
        }, $content);
        
        $message['content'] = $content;
        $processedMessages[] = $message;
    }
    
    return $processedMessages;
}

/**
 * 重要なツール結果かどうかを判定
 * ファイル内容参照に必要なツール結果は削除しない
 */
function isImportantToolMessage($msg) {
    if ($msg['role'] !== 'tool') {
        return false;
    }
    
    // 重要なツール（ファイル読み込み、検索結果）
    $importantTools = [
        'readFile',
        'searchFiles',
        'readDir',
        'getFileInfo'
    ];
    
    $name = $msg['name'] ?? '';
    return in_array($name, $importantTools, true);
}

/**
 * 会話履歴を圧縮
 * トークン数制限内でできるだけ多くの履歴を保持する
 * 重要なツール結果（readFileなど）は優先的に保護する
 */
function compressMessages($messages, $maxTokens = 3000) {
    // 現在のトークン数を概算
    $currentTokens = estimateTokenCount($messages);
    
    if ($currentTokens <= $maxTokens) {
        return $messages; // 圧縮不要
    }
    
    // ツールメッセージと通常メッセージを分離
    $toolMessages = [];
    $normalMessages = [];
    
    foreach ($messages as $msg) {
        if (isImportantToolMessage($msg)) {
            $toolMessages[] = $msg;
        } else {
            $normalMessages[] = $msg;
        }
    }
    
    // 最新のメッセージから必須メッセージ数を決定
    // 最低でも最新3往復分（6件）は保護する
    $minProtectedCount = 6;
    $protectedMessages = array_slice($normalMessages, -$minProtectedCount);
    $protectedTokens = estimateTokenCount($protectedMessages) + estimateTokenCount($toolMessages);
    
    // 保護メッセージだけで既に上限を超えている場合は保護メッセージのみ返す
    if ($protectedTokens >= $maxTokens) {
        // AIの制約により、会話履歴は必ず'role': 'user'から始める必要がある
        $finalMessages = array_merge($toolMessages, $protectedMessages);
        while (count($finalMessages) > 0 && $finalMessages[0]['role'] !== 'user') {
            array_shift($finalMessages);
        }
        return $finalMessages;
    }
    
    // 利用可能なトークン数
    $availableTokens = $maxTokens - $protectedTokens;
    
    // 古いメッセージから順に追加していく
    $oldMessages = array_slice($normalMessages, 0, -$minProtectedCount);
    $selectedMessages = [];
    $selectedTokens = 0;
    
    // 古いメッセージを逆順（新しい方から）で選別
    for ($i = count($oldMessages) - 1; $i >= 0; $i--) {
        $msg = $oldMessages[$i];
        $msgTokens = estimateTokenCount([$msg]);
        
        // このメッセージを追加してもトークン数の制限内か確認
        if ($selectedTokens + $msgTokens <= $availableTokens) {
            array_unshift($selectedMessages, $msg);
            $selectedTokens += $msgTokens;
        } else {
            // トークン数の制限に達した場合は古いメッセージを要約
            if (count($oldMessages) - $i - 1 > 0) {
                // 選別されなかったメッセージを要約
                $unselectedMessages = array_slice($oldMessages, 0, count($oldMessages) - $i - 1);
                $summaryContent = "これまでの会話要約:\n";
                
                $topics = [];
                foreach ($unselectedMessages as $msg) {
                    if ($msg['role'] === 'user') {
                        $content = $msg['content'];
                        if (!is_string($content)) {
                            continue;
                        }
                        if (mb_strlen($content) > 100) {
                            $content = mb_substr($content, 0, 100) . '...';
                        }
                        $topics[] = "- " . $content;
                    }
                }
                
                if (count($topics) > 0) {
                    $summaryContent .= implode("\n", $topics);
                    $summaryMessage = [
                        'role' => 'system',
                        'content' => $summaryContent
                    ];
                    $selectedMessages = array_merge([$summaryMessage], $selectedMessages);
                }
            }
            break;
        }
    }
    
    // 最終的なメッセージを構築
    // ツールメッセージを最初に保持し、その後通常メッセージを続ける
    $finalMessages = array_merge($toolMessages, $selectedMessages, $protectedMessages);
    
    // AIの制約により、会話履歴は必ず'role': 'user'から始める必要がある
    // 先頭がuserでない場合は、userになるまでメッセージをカット
    while (count($finalMessages) > 0 && $finalMessages[0]['role'] !== 'user') {
        array_shift($finalMessages);
    }
    
    return $finalMessages;
}

/**
 * ファイルコンテキストを圧縮
 */
function compressFileContext($messages) {
    foreach ($messages as &$message) {
        if ($message['role'] === 'system' && 
            isset($message['content']) && 
            is_string($message['content']) &&
            strpos($message['content'], '[ファイル内容]') === 0) {
            
            $content = $message['content'];
            
            // ファイル内容部分を抽出
            if (preg_match('/\[ファイル内容\] (.*?)\n(.*)/s', $content, $matches)) {
                $fileName = $matches[1];
                $fileContent = $matches[2];
                
                // ファイルの簡単な分析
                $lines = explode("\n", $fileContent);
                $lineCount = count($lines);
                
                // 長すぎる場合は要約
                if ($lineCount > 50 || mb_strlen($fileContent) > 2000) {
                    // 重要な情報のみ抽出
                    $summary = "[ファイル内容] {$fileName}\n";
                    $summary .= "ファイル概要: {$lineCount}行\n";
                    
                    // 主要な構造を抽出
                    $structures = [];
                    foreach ($lines as $line) {
                        $line = trim($line);
                        if (preg_match('/^(class|function|const|var|let)\s+(\w+)/i', $line, $match)) {
                            $structures[] = $match[1] . " " . $match[2];
                        }
                    }
                    
                    if (count($structures) > 0) {
                        $summary .= "主要な要素: " . implode(', ', array_slice($structures, 0, 5));
                        if (count($structures) > 5) $summary .= " など";
                    }
                    
                    $message['content'] = $summary;
                }
            }
        }
    }
    
    return $messages;
}

/**
 * AIを使用して会話履歴を要約する
 */
function compressMessagesWithAI($messages, $apiUrl, $apiKey) {
    // 最新3往復分を保護
    $protectedCount = 6;
    $protectedMessages = array_slice($messages, -$protectedCount);
    $oldMessages = array_slice($messages, 0, -$protectedCount);
    
    if (count($oldMessages) === 0) {
        return $messages; // 圧縮対象がない
    }
    
    // 圧縮対象のメッセージを文字列化
    $conversationText = "";
    foreach ($oldMessages as $msg) {
        $role = $msg['role'] === 'user' ? 'ユーザー' : 'AI';
        $content = $msg['content'];
        // contentが配列の場合はJSON化
        if (is_array($content)) {
            $content = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        }
        $conversationText .= "【{$role}】\n" . $content . "\n\n";
    }
    
    // AI要約用プロンプト
    $summaryPrompt = [
        [
            'role' => 'system',
            'content' => 'あなたは会話要約の専門家です。与えられた会話履歴を簡潔に要約してください。重要なポイント、質問内容、解決策を含めて、元の会話の本質を保持しながら大幅に短縮してください。'
        ],
        [
            'role' => 'user',
            'content' => "以下の会話履歴を要約してください：\n\n" . $conversationText
        ]
    ];
    
    $summaryPayload = [
        'model' => 'default',
        'messages' => $summaryPrompt,
        'stream' => false,
        'max_tokens' => 500
    ];
    
    try {
        // AI要約リクエストを送信（非ストリーミング）
        $summary = sendAIRequestForSummary($apiUrl, $apiKey, $summaryPayload);
        
        if ($summary) {
            $summaryMessage = [
                'role' => 'system',
                'content' => "これまでの会話要約:\n" . $summary
            ];
            
            $result = array_merge([$summaryMessage], $protectedMessages);
            
            // AIの制約により、会話履歴は必ず'role': 'user'から始める必要がある
            // 先頭がuserでない場合は、userになるまでメッセージをカット
            while (count($result) > 0 && $result[0]['role'] !== 'user') {
                array_shift($result);
            }
            
            return $result;
        }
    } catch (Exception $e) {
        // AI要約に失敗した場合は従来の方法にフォールバック
        error_log("AI要約エラー: " . $e->getMessage());
    }
    
    // フォールバック: 従来の要約方法
    return compressMessages($messages);
}

/**
 * AI要約専用のリクエスト関数（非ストリーミング）
 */
function sendAIRequestForSummary($apiUrl, $apiKey, $payload) {
    $ch = curl_init($apiUrl . '/chat/completions');
    if ($ch === false) {
        throw new Exception('cURL初期化エラー');
    }
    
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($response === false || $httpCode !== 200) {
        curl_close($ch);
        throw new Exception('AI要約リクエスト失敗');
    }
    
    curl_close($ch);
    
    $data = json_decode($response, true);
    if (isset($data['choices'][0]['message']['content'])) {
        return trim($data['choices'][0]['message']['content']);
    }
    
    throw new Exception('AI要約レスポンス解析失敗');
}

/**
 * コンテキスト圧縮のメイン処理
 * 段階的に圧縮を実行する
 */
function compressContext($messages, $maxTokens = 2500, $apiUrl = null, $apiKey = null) {
    // Step 1: ソースコードを除去・要約
    //$messages = removeCodeFromMessages($messages);
    
    // Step 2: トークン数を確認し、必要に応じてさらに圧縮
    $estimatedTokens = estimateTokenCount($messages);
    if ($estimatedTokens > $maxTokens) {
        // ファイルコンテキストも圧縮
        //$messages = compressFileContext($messages);
        
        // それでも多い場合は履歴圧縮
        $estimatedTokens = estimateTokenCount($messages);
        if ($estimatedTokens > $maxTokens * 0.8) {
            // AIによる要約を試行（API情報が提供されている場合）
            // if ($apiUrl && $apiKey) {
            //     error_log("AIによるコンテキスト圧縮を試行: トークン数 {$estimatedTokens} > {$maxTokens}");
            //     // AIを使用してメッセージを圧縮
            //     $messages = compressMessagesWithAI($messages, $apiUrl, $apiKey);
            // } else {
            //     // フォールバック: 従来の圧縮方法
            //     $messages = compressMessages($messages, $maxTokens * 0.8);
            // }
            $messages = compressMessages($messages, $maxTokens * 0.8);
        }
    }
    
    // 最終確認: AIの制約により、会話履歴は必ず'role': 'user'から始める必要がある
    // 先頭がuserでない場合は、userになるまでメッセージをカット
    while (count($messages) > 0 && isset($messages[0]['role']) && $messages[0]['role'] !== 'user') {
        error_log("コンテキスト圧縮: 先頭が'user'でないため削除 - role: " . $messages[0]['role']);
        array_shift($messages);
    }
    
    return $messages;
}
