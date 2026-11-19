/**
 * 再ログインモーダル (#27)
 *
 * セッション切れ時に表示し、ユーザーが作業を進める前に再ログインを促す。
 * 元の操作の自動リトライや未保存内容の自動送信は行わない。
 * 未保存の編集内容はエディタ上に残るので、再ログイン後にユーザーが保存し直す。
 */

import { ensureNetFeedbackStyle } from './loading.js';

let modalEl = null;

export function isReloginShown() {
    return !!modalEl;
}

/** 現在のログインユーザーID (2.php が埋め込む SESSION_DATA) */
function currentUserId() {
    return (window.SESSION_DATA && window.SESSION_DATA.id) || '';
}

/**
 * 再ログインモーダルを表示する。既に表示中なら何もしない(複数401の集約)。
 */
export function showReloginModal(reason) {
    if (modalEl) return;

    // 代理ログイン中は元の管理者セッションに戻す必要があるため、ログイン画面へ遷移させる
    if (window.SESSION_DATA && window.SESSION_DATA.is_proxy) {
        window.location.href = '/login.php';
        return;
    }

    ensureNetFeedbackStyle();
    const userId = currentUserId();

    modalEl = document.createElement('div');
    modalEl.className = 'net-loading-overlay net-relogin-overlay';
    modalEl.innerHTML = `
        <div class="net-relogin-box" role="alertdialog" aria-modal="true">
            <div><strong>セッションが切れました</strong></div>
            <div style="font-size:0.9em">編集中の内容はこの画面に残っています。<br>再ログインしてから、もう一度保存などの操作を行ってください。</div>
            <div class="net-relogin-user"></div>
            <input type="password" class="net-relogin-pw" placeholder="パスワード" autocomplete="current-password">
            <div class="net-relogin-error"></div>
            <div class="net-relogin-row">
                <button type="button" class="net-btn primary net-relogin-submit">再ログイン</button>
            </div>
            <div class="net-relogin-row" style="font-size:0.85em">
                <button type="button" class="net-btn net-relogin-open">別タブでログイン画面を開く</button>
                <button type="button" class="net-btn net-relogin-check">ログイン済みなら確認</button>
            </div>
        </div>`;
    modalEl.querySelector('.net-relogin-user').textContent = 'ユーザー: ' + userId;
    const pwInput = modalEl.querySelector('.net-relogin-pw');
    const errEl = modalEl.querySelector('.net-relogin-error');
    if (reason) errEl.textContent = reason;

    const close = () => {
        if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
        modalEl = null;
    };

    // サーバーのセッションが同じユーザーで有効か確認して、有効なら閉じる
    const verifyAndClose = async () => {
        try {
            const res = await fetch('/api/session_check.php', { credentials: 'same-origin' });
            if (!res.ok) {
                errEl.textContent = 'まだログインされていません。';
                return false;
            }
            const data = await res.json();
            if (data.user_id !== userId) {
                errEl.textContent = '別のユーザー(' + data.user_id + ')でログインされています。ページを再読み込みしてください。';
                return false;
            }
            close();
            return true;
        } catch (e) {
            errEl.textContent = '通信に失敗しました。ネットワークを確認してください。';
            return false;
        }
    };

    const submit = async () => {
        const pw = pwInput.value;
        if (!pw) {
            errEl.textContent = 'パスワードを入力してください。';
            return;
        }
        errEl.textContent = '';
        const btn = modalEl.querySelector('.net-relogin-submit');
        btn.disabled = true;
        try {
            const res = await fetch('/api/login.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, pw: pw })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.status !== 'success') {
                errEl.textContent = data.message || 'ログインに失敗しました。';
                return;
            }
            await verifyAndClose();
        } catch (e) {
            errEl.textContent = '通信に失敗しました。ネットワークを確認してください。';
        } finally {
            if (modalEl) btn.disabled = false;
        }
    };

    modalEl.querySelector('.net-relogin-submit').addEventListener('click', submit);
    pwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });
    // BitArrow SSO などパスワード以外のログイン方法向け
    modalEl.querySelector('.net-relogin-open').addEventListener('click', () => {
        window.open('/login.php', '_blank');
    });
    modalEl.querySelector('.net-relogin-check').addEventListener('click', verifyAndClose);

    document.body.appendChild(modalEl);
    pwInput.focus();
}
