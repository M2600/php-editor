/**
 * ローディングダイアログとエラー通知 (#27)
 *
 * 通常時は通信が一瞬で終わるため、一定時間(SHOW_DELAY_MS)経過するまで何も表示しない。
 * 表示した場合もちらつき防止のため最小表示時間(MIN_VISIBLE_MS)を確保する。
 */

const SHOW_DELAY_MS = 300;     // この時間を超えたらローディングを表示
const MIN_VISIBLE_MS = 400;    // 表示後の最小表示時間
const SLOW_NOTICE_MS = 5000;   // この時間を超えたら「時間がかかっています」とキャンセルを表示

const STYLE_ID = 'net-feedback-style';
const STYLE_TEXT = `
.net-loading-overlay {
    position: fixed; inset: 0; z-index: 9000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.35);
}
.net-loading-box, .net-relogin-box {
    background: var(--me-color-bg, #2b2b2b); color: var(--me-color-text, #eee);
    border: 1px solid var(--me-color-border, #666); border-radius: 8px;
    padding: 1.2em 1.6em; min-width: 16em; max-width: 90vw;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    display: flex; flex-direction: column; align-items: center; gap: 0.8em;
}
.net-loading-spinner {
    width: 1.8em; height: 1.8em;
    border: 3px solid #bbb; border-top-color: #4caf50; border-radius: 50%;
    animation: meditor-spin 1s linear infinite;
}
@keyframes meditor-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.net-loading-slow { display: none; flex-direction: column; align-items: center; gap: 0.5em; font-size: 0.9em; }
.net-loading-slow.visible { display: flex; }
.net-btn { cursor: pointer; padding: 0.3em 1em; border-radius: 4px; border: 1px solid #888; background: #444; color: #fff; }
.net-btn:hover { background: #555; }
.net-btn.primary { background: #2e7d32; border-color: #2e7d32; }
.net-toast-container {
    position: fixed; top: 0.8em; left: 50%; transform: translateX(-50%);
    z-index: 9500; display: flex; flex-direction: column; gap: 0.5em; max-width: 90vw;
}
.net-toast {
    display: flex; align-items: center; gap: 0.8em;
    padding: 0.6em 1em; border-radius: 6px; color: #fff;
    background: #c62828; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}
.net-toast.warning { background: #ef6c00; }
.net-toast-close { cursor: pointer; background: none; border: none; color: #fff; font-size: 1.1em; }
.net-relogin-overlay { z-index: 9800; }
.net-relogin-box input { padding: 0.4em; width: 14em; }
.net-relogin-error { color: #ff8a80; min-height: 1.2em; font-size: 0.9em; }
.net-relogin-row { display: flex; gap: 0.5em; flex-wrap: wrap; justify-content: center; }
`;

/** 共通スタイルを一度だけ挿入する */
export function ensureNetFeedbackStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
}

// 進行中のローディング: token -> { text, onCancel }
const activeTasks = new Map();
let nextToken = 1;
let overlay = null;
let showTimer = null;
let slowTimer = null;
let shownAt = 0;
let hideTimer = null;

function buildOverlay() {
    ensureNetFeedbackStyle();
    const el = document.createElement('div');
    el.className = 'net-loading-overlay';
    el.innerHTML = `
        <div class="net-loading-box" role="alertdialog" aria-live="polite">
            <div class="net-loading-spinner"></div>
            <div class="net-loading-text"></div>
            <div class="net-loading-slow">
                <div>通信に時間がかかっています…</div>
                <button type="button" class="net-btn net-loading-cancel">キャンセル</button>
            </div>
        </div>`;
    el.querySelector('.net-loading-cancel').addEventListener('click', () => {
        // 進行中の通信を全て中断する
        for (const task of Array.from(activeTasks.values())) {
            if (task.onCancel) task.onCancel();
        }
    });
    return el;
}

function showOverlay() {
    showTimer = null;
    if (activeTasks.size === 0) return;
    if (!overlay) overlay = buildOverlay();
    const last = Array.from(activeTasks.values()).pop();
    overlay.querySelector('.net-loading-text').textContent = last.text || '読み込み中...';
    overlay.querySelector('.net-loading-slow').classList.remove('visible');
    document.body.appendChild(overlay);
    shownAt = Date.now();
    slowTimer = setTimeout(() => {
        if (overlay) overlay.querySelector('.net-loading-slow').classList.add('visible');
    }, SLOW_NOTICE_MS);
}

function hideOverlay() {
    hideTimer = null;
    clearTimeout(slowTimer);
    slowTimer = null;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    shownAt = 0;
}

/**
 * ローディング開始。戻り値のトークンを endLoading に渡す。
 * @param {string} text 表示テキスト
 * @param {Function} onCancel キャンセル時に呼ばれる(通信の abort 用)
 */
export function beginLoading(text, onCancel) {
    const token = nextToken++;
    activeTasks.set(token, { text, onCancel });
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
    if (!showTimer && !shownAt) {
        showTimer = setTimeout(showOverlay, SHOW_DELAY_MS);
    }
    return token;
}

export function endLoading(token) {
    activeTasks.delete(token);
    if (activeTasks.size > 0) return;
    // 全て完了
    if (showTimer) {
        // まだ表示前なら何も表示せずに終了(通常時)
        clearTimeout(showTimer);
        showTimer = null;
        return;
    }
    if (shownAt) {
        const remain = MIN_VISIBLE_MS - (Date.now() - shownAt);
        if (remain > 0) {
            hideTimer = setTimeout(hideOverlay, remain);
        } else {
            hideOverlay();
        }
    }
}

let toastContainer = null;

/**
 * 画面上部にエラー通知を表示する (コンソールが閉じていても気づける)
 * @param {string} message
 * @param {{type?: 'error'|'warning', duration?: number}} options duration=0 で自動で消えない
 * @returns {Function} 閉じる関数
 */
export function showErrorToast(message, options = {}) {
    ensureNetFeedbackStyle();
    const { type = 'error', duration = 8000 } = options;
    if (!toastContainer || !toastContainer.isConnected) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'net-toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = 'net-toast' + (type === 'warning' ? ' warning' : '');
    const text = document.createElement('span');
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'net-toast-close';
    close.textContent = '×';
    const remove = () => toast.parentNode && toast.parentNode.removeChild(toast);
    close.addEventListener('click', remove);
    toast.append(text, close);
    toastContainer.appendChild(toast);
    if (duration > 0) setTimeout(remove, duration);
    return remove;
}
