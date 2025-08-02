// ai_api.js
// AIチャットAPI通信・ストリーム処理モジュール

export async function fetchAIChat({messages, model, fileContext, onDelta, onError, signal}) {
    try {
        const res = await fetch("/api/ai.php", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({messages, model, fileContext: fileContext ?? null}),
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
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        let hasValidStream = false; // ストリーム開始を検出するフラグ
        
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
                        // delta.contentがあればonDeltaに渡す
                        const delta = chunk.choices?.[0]?.delta;
                        if (delta && typeof delta.content === "string") {
                            onDelta && onDelta(delta.content, chunk);
                        }
                    } catch(e) {
                        // JSONパースエラーは無視
                    }
                }
            }
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
