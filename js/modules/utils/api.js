/**
 * API通信ユーティリティ
 * - タイムアウト / ネットワーク断 / 非JSON応答 / セッション切れを ApiError に統一 (#27)
 */

import { showErrorToast } from '../ui/loading.js';
import { redirectToLogin } from './helpers.js';

const DEFAULT_TIMEOUT_MS = 15000;

// 実行系は時間がかかり得るためタイムアウトを設けない
const NO_TIMEOUT_ACTIONS = ['run', 'cgi_run'];

/** API通信エラー。kind: timeout | network | parse | http | session | aborted */
export class ApiError extends Error {
    constructor(kind, message, extra = {}) {
        super(message);
        this.name = 'ApiError';
        this.kind = kind;
        this.status = extra.status;
        // 既に画面に通知済みか (呼び出し側で二重通知しないため)
        this.notified = !!extra.notified;
    }
}

/**
 * @param {string} url
 * @param {object} body
 * @param {{timeout?: number, notify?: boolean}} options
 *   timeout: ms (0で無制限) / notify: false でエラーバナー抑制
 */
export async function api(url, body = {}, options = {}) {
    const action = body && body.action;
    const timeoutMs = options.timeout !== undefined
        ? options.timeout
        : (NO_TIMEOUT_ACTIONS.includes(action) ? 0 : DEFAULT_TIMEOUT_MS);
    const notify = options.notify !== false;

    const controller = new AbortController();
    let timedOut = false;
    let timer = null;
    if (timeoutMs > 0) {
        timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    }

    const fail = (error) => {
        if (notify && error.kind !== 'session') {
            showErrorToast(error.message);
            error.notified = true;
        }
        if (window.errorLogger) {
            window.errorLogger.logError('api_error', error.message, { url, kind: error.kind, status: error.status });
        }
        return error;
    };

    try {
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } catch (e) {
            if (timedOut) {
                throw fail(new ApiError('timeout', 'サーバーからの応答がありません(タイムアウト)。ネットワークを確認してください。'));
            }
            if (e.name === 'AbortError') {
                throw new ApiError('aborted', '通信をキャンセルしました。', { notified: true });
            }
            throw fail(new ApiError('network', 'サーバーに接続できません。ネットワーク接続を確認してください。'));
        }

        // セッション切れ: 再ログインを促し、元の処理は中断する(リトライはしない)
        if (response.status === 401) {
            redirectToLogin();
            throw new ApiError('session', '未ログインまたはセッションが無効です。再度ログインしてください。', { status: 401, notified: true });
        }
        if (!response.ok) {
            throw fail(new ApiError('http', `サーバーエラーが発生しました (HTTP ${response.status})`, { status: response.status }));
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            if (timedOut) {
                throw fail(new ApiError('timeout', 'サーバーからの応答がありません(タイムアウト)。ネットワークを確認してください。'));
            }
            if (controller.signal.aborted) {
                throw new ApiError('aborted', '通信をキャンセルしました。', { notified: true });
            }
            throw fail(new ApiError('parse', 'サーバーから不正な応答が返されました。'));
        }
        // 200 でも session_error が返るエンドポイントへの保険
        if (data && data.status === 'session_error') {
            redirectToLogin();
            throw new ApiError('session', data.message || 'セッションが無効です。', { status: 401, notified: true });
        }
        return data;
    } finally {
        if (timer) clearTimeout(timer);
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
