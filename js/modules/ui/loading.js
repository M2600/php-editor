/**
 * 通信まわりの軽量なUI部品 (#27)
 *  - delayedIndicator: 一瞬で終わる処理では何も出さない遅延表示 (スピナー用)
 *  - showEditorBanner: エディタ上部に出すエラー/警告バナー
 */

const SHOW_DELAY_MS = 300;   // この時間を超えたらスピナーを表示
const MIN_VISIBLE_MS = 400;  // 表示後の最小表示時間 (ちらつき防止)
const SLOW_NOTICE_MS = 5000; // この時間を超えたら「時間がかかっています」を通知

/**
 * 遅延表示のインジケーターを開始する。戻り値の関数を呼ぶと終了する。
 * @param {Function} show スピナー表示
 * @param {Function} hide スピナー非表示
 * @param {Function} onSlow 5秒超過時に呼ばれる (任意)。戻り値の関数は終了時に呼ばれる
 */
export function delayedIndicator(show, hide, onSlow) {
    let shownAt = 0;
    let finished = false;
    let cleanupSlow = null;
    const showTimer = setTimeout(() => {
        if (finished) return;
        shownAt = Date.now();
        show();
    }, SHOW_DELAY_MS);
    const slowTimer = onSlow ? setTimeout(() => {
        if (!finished) cleanupSlow = onSlow();
    }, SLOW_NOTICE_MS) : null;

    return function stop() {
        if (finished) return;
        finished = true;
        clearTimeout(showTimer);
        clearTimeout(slowTimer);
        if (typeof cleanupSlow === 'function') cleanupSlow();
        if (!shownAt) return; // 表示前に終了(通常時): 何も出さない
        const remain = MIN_VISIBLE_MS - (Date.now() - shownAt);
        if (remain > 0) setTimeout(hide, remain);
        else hide();
    };
}

export const slowNoticeText = '通信に時間がかかっています…';
export { SLOW_NOTICE_MS };

// ---- バナー ----
const STYLE_ID = 'net-banner-style';
const STYLE_TEXT = `
.net-banner-area { display: flex; flex-direction: column; }
.net-banner-area.net-banner-fixed { position: fixed; top: 0; left: 0; right: 0; z-index: 9500; }
.net-banner {
    display: flex; align-items: center; gap: 0.8em;
    padding: 0.5em 0.9em; font-size: 0.9em; line-height: 1.4;
    border-bottom: 1px solid; background: #fdecec; color: #9b1c1c; border-color: #f2b8b8;
}
.net-banner.warning { background: #fff4e0; color: #8a4b00; border-color: #f0c987; }
body[theme="dark"] .net-banner { background: #3a1a1a; color: #ffb4b4; border-color: #6e2c2c; }
body[theme="dark"] .net-banner.warning { background: #3a2c12; color: #f5c97a; border-color: #6b5120; }
.net-banner-msg { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.net-banner button {
    font: inherit; cursor: pointer; color: inherit; background: transparent;
    border: 1px solid currentColor; border-radius: 4px; padding: 0.1em 0.8em;
}
.net-banner .net-banner-close { border: none; padding: 0 0.3em; font-size: 1.1em; }
`;

let bannerArea = null;
let bannerHost = null;
let bannerBefore = null;

/** バナーを表示するエディタ要素を登録する (hostの中、beforeの直前に差し込む) */
export function setBannerHost(host, before) {
    bannerHost = host;
    bannerBefore = before || null;
    if (bannerArea && bannerArea.parentNode) bannerArea.parentNode.removeChild(bannerArea);
    bannerArea = null;
}

function ensureArea() {
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLE_TEXT;
        document.head.appendChild(style);
    }
    if (bannerArea && bannerArea.isConnected) return bannerArea;
    bannerArea = document.createElement('div');
    bannerArea.className = 'net-banner-area';
    if (bannerHost && bannerHost.isConnected) {
        bannerHost.insertBefore(bannerArea, bannerBefore && bannerBefore.parentNode === bannerHost ? bannerBefore : null);
    } else {
        bannerArea.classList.add('net-banner-fixed');
        document.body.appendChild(bannerArea);
    }
    return bannerArea;
}

/**
 * エディタ上部にバナーを表示する。閉じるまで残る。
 * @param {{message: string, type?: 'error'|'warning', onRetry?: Function}} options
 * @returns {Function} バナーを閉じる関数
 */
export function showEditorBanner({ message, type = 'error', onRetry }) {
    const area = ensureArea();
    const banner = document.createElement('div');
    banner.className = 'net-banner' + (type === 'warning' ? ' warning' : '');
    banner.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.className = 'net-banner-msg';
    text.textContent = (type === 'warning' ? '' : '⚠ ') + message;
    banner.appendChild(text);
    const remove = () => banner.parentNode && banner.parentNode.removeChild(banner);
    if (onRetry) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = '再試行';
        retry.addEventListener('click', () => { remove(); onRetry(); });
        banner.appendChild(retry);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'net-banner-close';
    close.setAttribute('aria-label', '閉じる');
    close.textContent = '✕';
    close.addEventListener('click', remove);
    banner.appendChild(close);
    area.appendChild(banner);
    return remove;
}

/** 互換用: 旧トースト API。バナーとして表示する */
export function showErrorToast(message, options = {}) {
    const remove = showEditorBanner({ message, type: options.type || 'error' });
    if (options.duration > 0) setTimeout(remove, options.duration);
    return remove;
}
