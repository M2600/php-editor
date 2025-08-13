/**
 * ブラウザエラーキャッチャー
 * JavaScriptエラーをサーバに送信する機能
 */

class ErrorLogger {
    constructor(options = {}) {
        this.apiEndpoint = options.apiEndpoint || '/api/error_logger.php';
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.enableConsoleLog = options.enableConsoleLog !== false;
        
        this.init();
    }
    
    init() {
        // グローバルエラーハンドラー（JavaScript実行エラー）
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript_error',
                message: event.message || 'Unknown error',
                filename: event.filename || 'unknown',
                line: event.lineno || 0,
                column: event.colno || 0,
                stack: event.error ? event.error.stack : null,
                url: window.location.href
            });
        });
        
        // 未処理のPromise拒否
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'uncaught_exception',
                message: 'Unhandled Promise Rejection: ' + (event.reason || 'Unknown reason'),
                stack: event.reason && event.reason.stack ? event.reason.stack : null,
                url: window.location.href
            });
        });
        
        // コンソールエラーのインターセプト（オプション）
        if (this.enableConsoleLog) {
            this.interceptConsoleError();
        }
    }
    
    // コンソールエラーをインターセプト
    interceptConsoleError() {
        const originalError = console.error;
        console.error = (...args) => {
            // 元のconsole.errorを実行
            originalError.apply(console, args);
            
            // サーバにも送信
            this.handleError({
                type: 'warning',
                message: 'Console Error: ' + args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                ).join(' '),
                url: window.location.href
            });
        };
    }
    
    // エラー処理のメインメソッド
    async handleError(errorData) {
        try {
            // タイムスタンプを追加
            errorData.timestamp = new Date().toISOString();
            
            // 追加情報を収集
            errorData.additional_info = {
                browser: this.getBrowserInfo(),
                screen: {
                    width: screen.width,
                    height: screen.height
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };
            
            // サーバに送信（リトライ機能付き）
            await this.sendToServer(errorData);
            
        } catch (e) {
            console.warn('Failed to log error to server:', e);
        }
    }
    
    // 手動でエラーを送信するメソッド
    async logError(type, message, additionalInfo = {}) {
        await this.handleError({
            type: type,
            message: message,
            url: window.location.href,
            ...additionalInfo
        });
    }
    
    // サーバにデータを送信（リトライ機能付き）
    async sendToServer(errorData, attempt = 1) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(errorData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error('Server returned error: ' + result.message);
            }
            
        } catch (error) {
            if (attempt < this.maxRetries) {
                // リトライ
                setTimeout(() => {
                    this.sendToServer(errorData, attempt + 1);
                }, this.retryDelay * attempt);
            } else {
                console.warn('Failed to send error to server after', this.maxRetries, 'attempts:', error);
            }
        }
    }
    
    // ブラウザ情報を取得
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        
        if (ua.indexOf('Chrome') > -1) {
            browser = 'Chrome';
        } else if (ua.indexOf('Firefox') > -1) {
            browser = 'Firefox';
        } else if (ua.indexOf('Safari') > -1) {
            browser = 'Safari';
        } else if (ua.indexOf('Edge') > -1) {
            browser = 'Edge';
        } else if (ua.indexOf('Opera') > -1) {
            browser = 'Opera';
        }
        
        return {
            name: browser,
            userAgent: ua,
            language: navigator.language,
            platform: navigator.platform
        };
    }
}

// 使用例とグローバル設定
document.addEventListener('DOMContentLoaded', function() {
    // エラーロガーを初期化
    window.errorLogger = new ErrorLogger({
        apiEndpoint: '/api/error_logger.php',
        maxRetries: 3,
        retryDelay: 1000,
        enableConsoleLog: true
    });
    
    console.log('Error logger initialized');
});

// 手動でエラーをログするためのヘルパー関数をグローバルに公開
window.logError = function(type, message, additionalInfo) {
    if (window.errorLogger) {
        return window.errorLogger.logError(type, message, additionalInfo);
    }
};

// エクスポート（モジュールとして使用する場合）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorLogger;
}
