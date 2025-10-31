/**
 * API通信ユーティリティ
 */

// API関数を定義 (既存のコードから抽出)
export async function api(url, body = {}) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorMessage = `HTTP error! status: ${response.status}`;
            // エラーロガーがあれば API エラーを記録
            if (window.errorLogger) {
                window.errorLogger.logError('api_error', errorMessage, {
                    url: url,
                    status: response.status,
                    statusText: response.statusText
                });
            }
            throw new Error(errorMessage);
        }
        
        return await response.json();
    } catch (error) {
        // ネットワークエラーやパースエラーを記録
        if (window.errorLogger && error.message !== `HTTP error! status: ${error.status}`) {
            window.errorLogger.logError('api_network_error', error.message, {
                url: url,
                error_type: error.name
            });
        }
        throw error;
    }
}

// Path操作のユーティリティ（既存のコードから推定される内容）
export const Path = {
    join(...parts) {
        return parts.join('/').replace(/\/+/g, '/');
    },
    
    joinAsFile(dir, filename) {
        if (dir.endsWith('/')) {
            return dir + filename;
        }
        return dir + '/' + filename;
    }
};

// グローバルAPIアクセス用
window.api = api;
window.Path = Path;
