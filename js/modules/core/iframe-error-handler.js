/**
 * WebプレビューでのJSエラー処理モジュール
 * iframe内のエラーをキャッチして表示
 */

export class IframeErrorHandler {
    constructor(webPreviewer, mConsole, options = {}) {
        this.webPreviewer = webPreviewer;
        this.mConsole = mConsole;
        this.errors = [];
        this.errorLoggerScript = null;
        this.messageListener = null;
        
        // エラー発生時のコールバック関数
        this.onError = options.onError || null;
        
        // エラーロガースクリプトを読み込み
        this.loadErrorLoggerScript();
        
        // メッセージリスナーを設定
        this.setupMessageListener();
    }
    
    /**
     * エラーロガースクリプトを読み込み
     */
    async loadErrorLoggerScript() {
        try {
            const response = await fetch('/js/iframe-error-logger.js');
            this.errorLoggerScript = await response.text();
        } catch (error) {
            console.error('Failed to load iframe error logger script:', error);
        }
    }
    
    /**
     * postMessageリスナーを設定
     */
    setupMessageListener() {
        this.messageListener = (event) => {
            // 同一オリジンのみ許可
            if (event.origin !== window.location.origin) {
                return;
            }
            
            const message = event.data;
            
            if (message.type === 'iframe-js-error') {
                this.handleIframeError(message.data);
            } else if (message.type === 'iframe-error-logger-ready') {
                console.log('✅ iframe error logger ready:', message.url);
            }
        };
        
        window.addEventListener('message', this.messageListener);
    }
    
    /**
     * iframe内エラーを処理
     */
    handleIframeError(errorData) {
        // エラーを記録
        this.errors.push({
            ...errorData,
            receivedAt: new Date().toISOString()
        });
        
        // コンソールに表示
        this.displayError(errorData);
        
        // 開発者コンソールにも出力
        console.error('[iframe Error]', errorData);
        
        // エラー発生時のコールバックを実行
        if (this.onError && typeof this.onError === 'function') {
            this.onError(errorData, this.errors.length);
        }
    }
    
    /**
     * エラーをmConsoleに表示
     */
    displayError(errorData) {
        let message = '';
        let errorIcon = '❌';
        
        switch (errorData.type) {
            case 'javascript_error':
                errorIcon = '⚠️';
                break;
            case 'console_error':
                errorIcon = '🔴';
                break;
            case 'unhandled_rejection':
                errorIcon = '🚫';
                break;
        }
        
        // ファイル名から最後の部分のみ取得
        const filename = errorData.filename ? errorData.filename.split('/').pop() : 'unknown';
        
        // メッセージを構築
        if (errorData.line) {
            message = `${errorIcon} [実行エラー] ${errorData.message}\n📍 ${filename}:${errorData.line}:${errorData.column}`;
        } else {
            message = `${errorIcon} [実行エラー] ${errorData.message}\n📍 ${filename}`;
        }
        
        // スタックトレースがある場合は追加（最初の3行のみ）
        if (errorData.stack) {
            const stackLines = errorData.stack.split('\n').slice(0, 3);
            if (stackLines.length > 0) {
                message += '\n\n' + stackLines.join('\n');
            }
        }
        
        this.mConsole.print(message, 'error');
    }
    
    /**
     * URLにエラーロガーを注入
     * fetchでHTMLを取得し、スクリプトを注入してからiframeに設定
     */
    async injectErrorLoggerAndLoad(url) {
        if (!this.errorLoggerScript) {
            console.warn('Error logger script not loaded yet, loading without injection');
            this.webPreviewer.setURL(url);
            return;
        }
        
        try {
            // HTMLを取得
            const response = await fetch(url);
            
            // Content-Typeを確認
            const contentType = response.headers.get('content-type') || '';
            
            // HTML以外の場合は注入せずに通常読み込み
            if (!contentType.includes('text/html')) {
                console.log('Non-HTML content, loading without injection:', contentType);
                this.webPreviewer.setURL(url);
                return;
            }
            
            let html = await response.text();
            
            // スクリプトを注入
            const injectedScript = `<script>\n${this.errorLoggerScript}\n</script>`;
            
            // </head>タグの前に注入（存在する場合）
            if (html.includes('</head>')) {
                html = html.replace('</head>', injectedScript + '</head>');
            } else if (html.includes('<body')) {
                // </head>がない場合は<body>の前に注入
                html = html.replace(/<body([^>]*)>/, injectedScript + '<body$1>');
            } else {
                // <body>もない場合は先頭に注入
                html = injectedScript + html;
            }
            
            // base URLを設定（相対パスが正しく動作するように）
            const baseTag = `<base href="${url}">`;
            if (html.includes('</head>')) {
                html = html.replace('</head>', baseTag + '</head>');
            } else {
                html = baseTag + html;
            }
            
            // Blob URLを作成してiframeに設定
            const blob = new Blob([html], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            
            // 古いBlob URLをクリーンアップ
            if (this.currentBlobUrl) {
                URL.revokeObjectURL(this.currentBlobUrl);
            }
            this.currentBlobUrl = blobUrl;
            
            // iframeに設定
            this.webPreviewer.setURL(blobUrl);
            
            console.log('✅ Error logger injected and iframe loaded');
            
        } catch (error) {
            console.error('Failed to inject error logger:', error);
            // エラー時は通常の方法で読み込み
            this.webPreviewer.setURL(url);
        }
    }
    
    /**
     * エラーをクリア
     */
    clearErrors() {
        this.errors = [];
    }
    
    /**
     * すべてのエラーを取得
     */
    getErrors() {
        return this.errors;
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        if (this.messageListener) {
            window.removeEventListener('message', this.messageListener);
        }
        
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
        }
    }
}
