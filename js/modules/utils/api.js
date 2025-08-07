/**
 * API通信ユーティリティ
 */

// API関数を定義 (既存のコードから抽出)
export async function api(url, body = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
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
