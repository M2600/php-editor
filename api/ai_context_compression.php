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
        $totalChars += mb_strlen($msg['content'] ?? '', 'UTF-8');
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
 * 会話履歴を圧縮
 */
function compressMessages($messages, $maxTokens = 3000) {
    // 現在のトークン数を概算
    $currentTokens = estimateTokenCount($messages);
    
    if ($currentTokens <= $maxTokens) {
        return $messages; // 圧縮不要
    }
    
    // 重要なメッセージを保護（最新N件は必ず残す）
    $protectedCount = 6; // 最新3往復分
    $protectedMessages = array_slice($messages, -$protectedCount);
    $oldMessages = array_slice($messages, 0, -$protectedCount);
    
    // 古いメッセージを要約
    if (count($oldMessages) > 0) {
        $summaryContent = "これまでの会話要約:\n";
        
        // 主要なトピックを抽出
        $topics = [];
        foreach ($oldMessages as $msg) {
            if ($msg['role'] === 'user') {
                // ユーザーの質問から主要キーワードを抽出
                $content = $msg['content'];
                if (mb_strlen($content) > 100) {
                    $content = mb_substr($content, 0, 100) . '...';
                }
                $topics[] = "- " . $content;
            }
        }
        
        $summaryContent .= implode("\n", array_slice($topics, -5)); // 最新5トピック
        
        $summaryMessage = [
            'role' => 'system',
            'content' => $summaryContent
        ];
        
        return array_merge([$summaryMessage], $protectedMessages);
    }
    
    return $protectedMessages;
}

/**
 * ファイルコンテキストを圧縮
 */
function compressFileContext($messages) {
    foreach ($messages as &$message) {
        if ($message['role'] === 'system' && 
            isset($message['content']) && 
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
        $conversationText .= "【{$role}】\n" . $msg['content'] . "\n\n";
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
            
            return array_merge([$summaryMessage], $protectedMessages);
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
            if ($apiUrl && $apiKey) {
                $messages = compressMessagesWithAI($messages, $apiUrl, $apiKey);
            } else {
                // フォールバック: 従来の圧縮方法
                $messages = compressMessages($messages, $maxTokens * 0.8);
            }
        }
    }
    
    return $messages;
}
