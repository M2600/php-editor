/**
 * iframe用エラーロガー（軽量版）
 * iframe内で発生したJavaScriptエラーを親ウィンドウに送信
 */

(function() {
    'use strict';
    
    // 親ウィンドウのオリジンを取得（同一オリジンのみ）
    const parentOrigin = window.location.origin;
    
    /**
     * エラー情報を親ウィンドウに送信
     */
    function sendErrorToParent(errorData) {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'iframe-js-error',
                    data: errorData,
                    timestamp: new Date().toISOString()
                }, parentOrigin);
            }
        } catch (e) {
            console.warn('Failed to send error to parent:', e);
        }
    }
    
    /**
     * エラー情報を整形
     */
    function formatErrorData(type, message, filename, line, column, error) {
        return {
            type: type,
            message: message || 'Unknown error',
            filename: filename || 'unknown',
            line: line || 0,
            column: column || 0,
            stack: error && error.stack ? error.stack : null,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
    }
    
    // グローバルエラーハンドラー（JavaScript実行エラー）
    window.addEventListener('error', function(event) {
        const errorData = formatErrorData(
            'javascript_error',
            event.message,
            event.filename,
            event.lineno,
            event.colno,
            event.error
        );
        
        sendErrorToParent(errorData);
        
        // 元のエラー処理は継続
        return false;
    });
    
    // 未処理のPromise拒否
    window.addEventListener('unhandledrejection', function(event) {
        const errorData = formatErrorData(
            'unhandled_rejection',
            'Unhandled Promise Rejection: ' + (event.reason || 'Unknown reason'),
            'unknown',
            0,
            0,
            event.reason
        );
        
        sendErrorToParent(errorData);
    });
    
    // console.errorをインターセプト
    const originalError = console.error;
    console.error = function(...args) {
        // 元のconsole.errorを実行
        originalError.apply(console, args);
        
        // スタックトレースから呼び出し元情報を抽出
        const stack = new Error().stack;
        let filename = 'unknown';
        let line = 0;
        let column = 0;
        
        if (stack) {
            const lines = stack.split('\n');
            // console.error呼び出し元を探す
            const callerLine = lines.find(l => 
                !l.includes('console.error') && 
                l.includes('http')
            );
            
            if (callerLine) {
                const locationMatch = callerLine.match(/\((.+):(\d+):(\d+)\)|at (.+):(\d+):(\d+)/);
                if (locationMatch) {
                    filename = locationMatch[1] || locationMatch[4];
                    line = parseInt(locationMatch[2] || locationMatch[5]);
                    column = parseInt(locationMatch[3] || locationMatch[6]);
                }
            }
        }
        
        const errorData = formatErrorData(
            'console_error',
            'Console Error: ' + args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '),
            filename,
            line,
            column,
            null
        );
        
        sendErrorToParent(errorData);
    };
    
    // 初期化完了を通知
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'iframe-error-logger-ready',
            url: window.location.href
        }, parentOrigin);
    }
    
    console.log('📡 iframe error logger initialized');
})();
