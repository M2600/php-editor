/**
 * エクスプローラー自動リロードモジュール
 * 
 * 定期的にファイルエクスプローラーを自動リロードする機能を提供
 */

export class ExplorerAutoReload {
    constructor(config = {}) {
        this.interval = config.interval || 30000; // デフォルト30秒
        this.enabled = config.enabled !== false; // デフォルト有効
        this.reloadFunction = null;
        this.timerId = null;
        this.oneTimeTimerId = null; // 一回限りのタイマーID
        this.lastReloadTime = null;
        this.debug = config.debug || false;
    }

    /**
     * リロード関数を設定
     * @param {Function} func - リロード時に実行する関数
     */
    setReloadFunction(func) {
        if (typeof func !== 'function') {
            throw new Error('Reload function must be a function');
        }
        this.reloadFunction = func;
    }

    /**
     * 自動リロードを開始
     */
    start() {
        if (!this.enabled) {
            this.log('Auto reload is disabled');
            return;
        }

        if (this.interval <= 0) {
            this.log('Auto reload interval is 0 or negative, auto reload disabled');
            return;
        }

        if (!this.reloadFunction) {
            console.warn('ExplorerAutoReload: Reload function not set');
            return;
        }

        // 既存のタイマーをクリア
        this.stop();

        this.log(`Starting auto reload with interval: ${this.interval}ms`);
        
        this.timerId = setInterval(() => {
            this.reload();
        }, this.interval);

        // 開始時の時刻を記録
        this.lastReloadTime = Date.now();
    }

    /**
     * 自動リロードを停止
     */
    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
            this.log('Auto reload stopped');
        }
    }

    /**
     * 一回限りのタイマーをキャンセル
     */
    cancelScheduledReload() {
        if (this.oneTimeTimerId) {
            clearTimeout(this.oneTimeTimerId);
            this.oneTimeTimerId = null;
            this.log('Scheduled reload cancelled');
            return true;
        }
        return false;
    }

    /**
     * 即座にリロードを実行
     */
    async reload() {
        if (!this.reloadFunction) {
            console.warn('ExplorerAutoReload: Reload function not set');
            return;
        }

        try {
            this.log('Reloading explorer...');
            await this.reloadFunction();
            this.lastReloadTime = Date.now();
            this.log('Explorer reloaded successfully');
        } catch (error) {
            console.error('ExplorerAutoReload: Reload failed', error);
        }
    }

    /**
     * 指定時間後にリロードを実行（一回限り）
     * @param {number} delay - 遅延時間（ミリ秒）
     * @returns {Promise} - タイマーIDを持つPromise（キャンセル用）
     */
    async reloadAfter(delay) {
        if (!this.reloadFunction) {
            console.warn('ExplorerAutoReload: Reload function not set');
            return Promise.reject(new Error('Reload function not set'));
        }

        if (typeof delay !== 'number' || delay < 0) {
            console.warn('ExplorerAutoReload: Invalid delay value:', delay);
            return Promise.reject(new Error('Invalid delay value'));
        }

        // 既存の一回限りのタイマーをキャンセル
        this.cancelScheduledReload();

        this.log(`Scheduling reload after ${delay}ms`);

        return new Promise((resolve, reject) => {
            this.oneTimeTimerId = setTimeout(async () => {
                try {
                    this.log('Executing scheduled reload...');
                    await this.reloadFunction();
                    this.lastReloadTime = Date.now();
                    this.oneTimeTimerId = null;
                    this.log('Scheduled reload completed successfully');
                    resolve();
                } catch (error) {
                    console.error('ExplorerAutoReload: Scheduled reload failed', error);
                    this.oneTimeTimerId = null;
                    reject(error);
                }
            }, delay);
        });
    }

    /**
     * 自動リロード間隔を変更
     * @param {number} interval - 新しい間隔（ミリ秒）
     */
    setInterval(interval) {
        const wasRunning = this.isRunning();
        this.interval = interval;
        
        if (wasRunning) {
            this.start(); // 再起動
        }
        
        this.log(`Interval changed to: ${interval}ms`);
    }

    /**
     * 自動リロードの有効/無効を切り替え
     * @param {boolean} enabled - 有効にする場合true
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        
        if (enabled) {
            this.start();
        } else {
            this.stop();
        }
        
        this.log(`Auto reload ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 自動リロードが動作中かどうか
     * @returns {boolean}
     */
    isRunning() {
        return this.timerId !== null;
    }

    /**
     * 最後のリロード時刻を取得
     * @returns {number|null} タイムスタンプ
     */
    getLastReloadTime() {
        return this.lastReloadTime;
    }

    /**
     * 次のリロードまでの残り時間を取得（ミリ秒）
     * @returns {number|null}
     */
    getTimeUntilNextReload() {
        if (!this.isRunning() || !this.lastReloadTime) {
            return null;
        }
        
        const elapsed = Date.now() - this.lastReloadTime;
        const remaining = this.interval - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * デバッグログを出力
     */
    log(message) {
        if (this.debug) {
            console.log(`[ExplorerAutoReload] ${message}`);
        }
    }

    /**
     * スケジュールされたリロードが存在するかどうか
     * @returns {boolean}
     */
    hasScheduledReload() {
        return this.oneTimeTimerId !== null;
    }

    /**
     * 現在の設定を取得
     * @returns {Object}
     */
    getConfig() {
        return {
            interval: this.interval,
            enabled: this.enabled,
            isRunning: this.isRunning(),
            lastReloadTime: this.lastReloadTime,
            timeUntilNextReload: this.getTimeUntilNextReload(),
            hasScheduledReload: this.hasScheduledReload()
        };
    }
}
