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
                    if (!line.startsWith("data:")) continue;
                    let jsonStr = line.slice(5).trim();
                    if (jsonStr === "[DONE]") {
                        done = true;
                        break;
                    }
                    if (!jsonStr) continue;
                    try {
                        const chunk = JSON.parse(jsonStr);
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
    } catch(e) {
        onError && onError(e.message || e);
    }
}
