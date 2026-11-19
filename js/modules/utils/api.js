/**
 * API通信ユーティリティ
 * - タイムアウト / ネットワーク断 / 非JSON応答 / セッション切れを ApiError に統一 (#27)
 * - 時間のかかる通信ではローディングダイアログを表示
 */

import { beginLoading, endLoading, showErrorToast } from '../ui/loading.js';
import { showReloginModal } from '../ui/relogin.js';

const DEFAULT_TIMEOUT_MS = 15000;

// ローディングダイアログを出す file_manager のアクション
const LOADING_ACTIONS = {
    get: 'ファイルを読み込み中...',
    save: 'ファイルを保存中...',
    delete: 'ファイルを削除中...',
    deleteDir: 'フォルダを削除中...',
    duplicate: 'ファイルを複製中...',
    rename: '名前を変更中...',
    mkdir: 'フォルダを作成中...',
    touch: 'ファイルを作成中...',
    'list-object': 'フォルダを読み込み中...',
};
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
 * @param {{timeout?: number, loading?: boolean|string, notify?: boolean}} options
 *   timeout: ms (0で無制限) / loading: false で非表示、文字列で表示テキスト指定 / notify: false でエラートースト抑制
 */
export async function api(url, body = {}, options = {}) {
    const action = body && body.action;
    const loadingText = options.loading !== undefined
        ? (options.loading === true ? '通信中...' : options.loading)
        : LOADING_ACTIONS[action];
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
    const loadingToken = loadingText ? beginLoading(loadingText, () => controller.abort()) : null;

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
            showReloginModal();
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
            showReloginModal();
            throw new ApiError('session', data.message || 'セッションが無効です。', { status: 401, notified: true });
        }
        return data;
    } finally {
        if (timer) clearTimeout(timer);
        if (loadingToken !== null) endLoading(loadingToken);
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
