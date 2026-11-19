/**
 * Session Pulse - セッション生存確認機能
 * 定期的にサーバーにリクエストを送り、PHPセッションが有効かを確認する
 */

class SessionPulse {
    constructor(options = {}) {
        this.interval = options.interval || 60000; // 60秒間隔
        this.endpoint = options.endpoint || '/api/session_check.php';
        this.onSessionValid = options.onSessionValid || this.onSessionValid;
        this.onSessionExpired = options.onSessionExpired || this.defaultSessionExpiredHandler;
        this.onError = options.onError || this.defaultErrorHandler;
        this.intervalId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.checkSession();
        }, this.interval);
        
        // タブ復帰・ネットワーク復帰時は次の周期を待たず即チェック (スリープ/バックグラウンド後の期限切れ検知)
        this.onVisible = () => {
            if (document.visibilityState === 'visible') this.checkSession();
        };
        this.onOnline = () => this.checkSession();
        document.addEventListener('visibilitychange', this.onVisible);
        window.addEventListener('online', this.onOnline);

        console.log('Session pulse started');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        if (this.onVisible) document.removeEventListener('visibilitychange', this.onVisible);
        if (this.onOnline) window.removeEventListener('online', this.onOnline);
        console.log('Session pulse stopped');
    }

    async checkSession() {
        try {
            const response = await fetch(this.endpoint, {
                method: 'GET',
                credentials: 'same-origin', // セッションクッキーを含める
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // 401 はセッション切れ (サーバーは session_error を 401 で返す)
            if (response.status === 401) {
                console.warn('Session expired or invalid');
                this.onSessionExpired({ status: 'session_error' });
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'error' || !data.authenticated) {
                console.warn('Session expired or invalid');
                this.onSessionExpired(data);
                return;
            }

            // セッション有効時の処理（必要に応じて）
            this.onSessionValid(data);

        } catch (error) {
            console.error('Session check failed:', error);
            this.onError(error);
        }
    }

    onSessionValid(data) {
        // セッション有効時の処理（オーバーライド可能）
        console.debug('Session is valid', data);
    }

    defaultSessionExpiredHandler(data) {
        // デフォルトのセッション期限切れ処理
        alert('セッションが期限切れです。再ログインしてください。');
        window.location.href = '/login.php';
    }

    defaultErrorHandler(error) {
        // デフォルトのエラーハンドリング（一時的な接続エラーなど）
        console.error('Session pulse error:', error);
        // ネットワークエラーの場合は継続（サーバーが一時的にダウンしても止めない）
    }
}

// グローバルインスタンス
let sessionPulse = null;

// 初期化関数
function initSessionPulse(options = {}) {
    if (sessionPulse) {
        sessionPulse.stop();
    }
    
    sessionPulse = new SessionPulse(options);
    return sessionPulse;
}

// 自動開始（ページロード後）
function startSessionPulse(options = {}) {
    const pulse = initSessionPulse(options);
    pulse.start();
    return pulse;
}

// ES Module エクスポート
export { SessionPulse, initSessionPulse, startSessionPulse };
