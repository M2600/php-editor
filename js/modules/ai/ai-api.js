// ai_api.js
// AIチャットAPI通信・ストリーム処理モジュール

/**
 * スムーズな文字出力を行うクラス
 */
class SmoothTextStreamer {
    constructor(onUpdate, intervalMs = 50) {
        this.onUpdate = onUpdate;
        this.intervalMs = intervalMs;
        this.buffer = '';
        this.currentText = '';
        this.timer = null;
        this.isRunning = false;
    }

    addText(text) {
        this.buffer += text;
        if (!this.isRunning) {
            this.start();
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        this.timer = setInterval(() => {
            if (this.buffer.length === 0) {
                return;
            }

            // バッファから一度に出力する文字数を計算
            const remainingBuffer = this.buffer.length;
            const charsToOutput = Math.max(1, Math.min(10, Math.ceil(remainingBuffer / 5)));
            
            // バッファから文字を取り出して出力
            const outputText = this.buffer.substring(0, charsToOutput);
            this.buffer = this.buffer.substring(charsToOutput);
            this.currentText += outputText;
            
            this.onUpdate(this.currentText);
        }, this.intervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        
        // 残りのバッファを全て出力
        if (this.buffer.length > 0) {
            this.currentText += this.buffer;
            this.buffer = '';
            this.onUpdate(this.currentText);
        }
    }

    clear() {
        this.stop();
        this.buffer = '';
        this.currentText = '';
    }
}

export async function fetchAIChat({messages, model, fileContext, dirContext, tools, onDelta, onError, signal, smoothOutput = true, customUrl = null, customApiKey = null, customPrompt = null}) {
    try {
        // リクエストボディを作成
        const requestBody = {
            messages, 
            model, 
            fileContext: fileContext ?? null, 
            dirContext: dirContext ?? null,
            tools: tools ?? null  // AI tools (OpenAI Function Calling format)
        };
        
        // カスタムURL及びAPIキーがある場合は追加
        if (customUrl) {
            requestBody.customUrl = customUrl;
        }
        if (customApiKey) {
            requestBody.customApiKey = customApiKey;
        }
        if (customPrompt) {
            requestBody.userCustomPrompt = customPrompt;
        }
        
        const res = await fetch("/api/ai.php", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(requestBody),
            signal
        });
        if (!res.ok) {
            let errMsg = `サーバエラー: ${res.status} ${res.statusText}`;
            try {
                const errJson = await res.json();
                if (errJson && errJson.error) {
                    errMsg = `サーバエラー: ${errJson.error}`;
                }
            } catch(_) {}
            onError && onError(errMsg);
            return;
        }
        if (!res.body) {
            onError && onError("No stream");
            return;
        }

        // スムーズ出力用のストリーマーを初期化
        let textStreamer = null;
        if (smoothOutput && onDelta) {
            textStreamer = new SmoothTextStreamer((text) => {
                onDelta(text, null, true); // 第3引数でスムーズ出力であることを示す
            });
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        let hasValidStream = false; // ストリーム開始を検出するフラグ
        let fullText = ""; // 完全なテキストを保持
        
        while (!done) {
            const {done: doneRead, value} = await reader.read();
            done = doneRead;
            if (value) {
                buffer += decoder.decode(value, {stream:true});
                // ストリームデータを分割して処理
                let lines = buffer.split(/\r?\n/);
                buffer = lines.pop(); // 最後は未完了の可能性
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    // JSONエラーレスポンスの検出（ストリーム開始前）
                    if (!hasValidStream && line.startsWith("{")) {
                        try {
                            const errorObj = JSON.parse(line);
                            if (errorObj && errorObj.error) {
                                onError && onError(errorObj.error);
                                return;
                            }
                        } catch(e) {
                            // JSONパースエラーは続行
                        }
                    }
                    
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    
                    // 正常なストリームが開始された
                    hasValidStream = true;
                    let jsonStr = line.slice(5).trim();
                    if (jsonStr === "[DONE]") {
                        done = true;
                        break;
                    }
                    if (!jsonStr) continue;
                    try {
                        const chunk = JSON.parse(jsonStr);
                        // エラー応答の検出
                        if (chunk && (chunk.error || chunk.code)) {
                            let errMsg = chunk.error || (chunk.code ? `AIサーバーエラー: ${chunk.code}` : "AIサーバーエラー");
                            onError && onError(errMsg);
                            return;
                        }
                        // delta.contentがあれば処理
                        const delta = chunk.choices?.[0]?.delta;
                        if (delta && typeof delta.content === "string") {
                            fullText += delta.content;
                            
                            if (smoothOutput && textStreamer) {
                                // スムーズ出力の場合はストリーマーに追加
                                textStreamer.addText(delta.content);
                            } else {
                                // 通常出力の場合は直接コールバック
                                onDelta && onDelta(delta.content, chunk);
                            }
                        }
                        
                        // tool_callsがあれば処理
                        if (delta && delta.tool_calls) {
                            // ツール呼び出し情報をコールバックに渡す
                            onDelta && onDelta('', chunk, false, delta.tool_calls);
                        }
                    } catch(e) {
                        // JSONパースエラーは無視
                    }
                }
            }
        }

        // ストリーム終了時の処理
        if (textStreamer) {
            textStreamer.stop();
        }
        
        // ストリーム終了後、正常なレスポンスが一度も受信されていない場合
        if (!hasValidStream) {
            onError && onError("AIサーバーから正常な応答がありませんでした。サーバーがダウンしている可能性があります。");
            return;
        }
    } catch(e) {
        // fetch自体のエラーやネットワークエラー
        let errMsg = e && e.message ? e.message : String(e);
        if (errMsg.includes('aborted')) {
            errMsg = 'リクエストがキャンセルされました';
        } else if (errMsg.includes('network')) {
            errMsg = 'ネットワークエラーが発生しました';
        } else {
            errMsg = `サーバー通信エラー: ${errMsg}`;
        }
        onError && onError(errMsg);
    }
}
