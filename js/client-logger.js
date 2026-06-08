/**
 * クライアントログ送信クラス
 * エラー自動捕捉と任意レベルのログをサーバに送信する
 */

class ClientLogger {
    constructor(options = {}) {
        this.apiEndpoint = options.apiEndpoint || '/api/client_log.php';
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.enableConsoleIntercept = options.enableConsoleIntercept !== false;

        this._initErrorHandlers();
    }

    _initErrorHandlers() {
        window.addEventListener('error', (event) => {
            const data = {
                type: 'javascript_error',
                message: event.message || 'Unknown error',
                filename: event.filename || 'unknown',
                line: event.lineno || 0,
                column: event.colno || 0,
                stack: event.error ? event.error.stack : null,
                url: window.location.href,
            };
            this._logLocationToConsole(data);
            this._send(data);
        });

        window.addEventListener('unhandledrejection', (event) => {
            const data = {
                type: 'uncaught_exception',
                message: 'Unhandled Promise Rejection: ' + (event.reason || 'Unknown reason'),
                stack: event.reason && event.reason.stack ? event.reason.stack : null,
                url: window.location.href,
            };
            this._logLocationToConsole(data);
            this._send(data);
        });

        if (this.enableConsoleIntercept) {
            this._interceptConsoleError();
        }
    }

    _logLocationToConsole(data) {
        const parts = [];
        if (data.filename && data.filename !== 'unknown') {
            parts.push('📄 ' + (data.filename.split('/').pop() || data.filename));
        }
        if (data.line) parts.push('行 ' + data.line);
        if (data.column) parts.push('列 ' + data.column);
        if (parts.length > 0) {
            console.log(
                '%c📍 エラー発生箇所: %c' + parts.join(' / '),
                'color: #ff6b6b; font-weight: bold;',
                'color: #4ecdc4; font-weight: normal;'
            );
        }
    }

    _interceptConsoleError() {
        const original = console.error;
        const self = this;
        console.error = function (...args) {
            original.apply(console, args);

            const stack = new Error().stack;
            let filename = 'unknown', line = 0, column = 0;
            if (stack) {
                const callerLine = stack.split('\n').find(l =>
                    !l.includes('console.error') && !l.includes('_interceptConsoleError')
                );
                if (callerLine) {
                    const m = callerLine.match(/\((.+):(\d+):(\d+)\)|at (.+):(\d+):(\d+)/);
                    if (m) {
                        filename = m[1] || m[4];
                        line = parseInt(m[2] || m[5]);
                        column = parseInt(m[3] || m[6]);
                    }
                }
            }

            const data = {
                type: 'console_error',
                message: 'Console Error: ' + args.map(a =>
                    typeof a === 'object' ? JSON.stringify(a) : String(a)
                ).join(' '),
                filename, line, column,
                url: window.location.href,
            };
            self._logLocationToConsole(data);
            self._send(data);
        };
    }

    // --- 公開API ---

    /** 任意レベルでログを送信 */
    async log(level, message, data = {}) {
        await this._send({
            type: level,
            message,
            url: window.location.href,
            ...data,
        });
    }

    async logInfo(message, data = {}) {
        await this.log('info', message, data);
    }

    async logDebug(message, data = {}) {
        await this.log('debug', message, data);
    }

    async logWarning(message, data = {}) {
        await this.log('warning', message, data);
    }

    /** 後方互換: logError(type, message, additionalInfo) */
    async logError(type, message, additionalInfo = {}) {
        await this._send({
            type: type || 'error',
            message,
            url: window.location.href,
            ...additionalInfo,
        });
    }

    // --- 内部送信 ---

    async _send(data, attempt = 1) {
        data.timestamp = data.timestamp || new Date().toISOString();
        if (!data.additional_info) {
            data.additional_info = {
                browser: this._getBrowserInfo(),
                screen: { width: screen.width, height: screen.height },
                viewport: { width: window.innerWidth, height: window.innerHeight },
            };
        }

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            if (result.status !== 'success') throw new Error('Server error: ' + result.message);

        } catch (error) {
            if (attempt < this.maxRetries) {
                setTimeout(() => this._send(data, attempt + 1), this.retryDelay * attempt);
            } else {
                console.warn('client-logger: failed after', this.maxRetries, 'attempts:', error);
            }
        }
    }

    _getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari')) browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';
        else if (ua.includes('Opera')) browser = 'Opera';
        return { name: browser, userAgent: ua, language: navigator.language, platform: navigator.platform };
    }
}

document.addEventListener('DOMContentLoaded', function () {
    window.clientLogger = new ClientLogger({
        apiEndpoint: '/api/client_log.php',
        maxRetries: 3,
        retryDelay: 1000,
        enableConsoleIntercept: true,
    });

    console.log('Client logger initialized');
});

window.logInfo    = (msg, data) => window.clientLogger?.log('info', msg, data);
window.logDebug   = (msg, data) => window.clientLogger?.log('debug', msg, data);
window.logWarning = (msg, data) => window.clientLogger?.log('warning', msg, data);
window.logError   = (type, msg, data) => window.clientLogger?.logError(type, msg, data);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientLogger;
}
