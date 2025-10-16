<?php

require_once(__DIR__ . "/logger.php");

class Debug {
    /**
     * POSTデータを含むPHPスクリプトを実行
     * 
     * @param string $scriptPath 実行するスクリプトのパス
     * @param array $postData POSTデータ
     * @param array $getData GETパラメータ
     * @param string $contentType Content-Type（デフォルト: application/x-www-form-urlencoded）
     * @return array 実行結果
     */
    public static function executeWithPost(
        $scriptPath, 
        $postData = [], 
        $getData = [], 
        $contentType = 'application/x-www-form-urlencoded'
    ) {
        // execute()メソッドに委譲
        return self::execute($scriptPath, 'POST', $postData, $getData, $contentType);
    }
    
    /**
     * GETリクエストとしてPHPスクリプトを実行（後方互換性のため）
     * 
     * @param string $scriptPath 実行するスクリプトのパス
     * @param array $getData GETパラメータ
     * @return array 実行結果
     */
    public static function executeWithGet($scriptPath, $getData = []) {
        return self::execute($scriptPath, 'GET', [], $getData);
    }
    
    /**
     * リクエストメソッドを指定してPHPスクリプトを実行
     * 
     * @param string $scriptPath 実行するスクリプトのパス
     * @param string $method HTTPメソッド（GET, POST, PUT, DELETE など）
     * @param array $postData POSTデータ（POST, PUT, PATCH の場合）
     * @param array $getData GETパラメータ
     * @param string $contentType Content-Type
     * @return array 実行結果
     */
    public static function execute(
        $scriptPath,
        $method = 'GET',
        $postData = [],
        $getData = [],
        $contentType = 'application/x-www-form-urlencoded'
    ) {
        $method = strtoupper($method);
        
        // スクリプトパスの検証
        if (!file_exists($scriptPath)) {
            return [
                'success' => false,
                'error' => 'Script file not found: ' . $scriptPath,
                'output' => '',
                'errors' => '',
                'exit_code' => -1
            ];
        }
        
        // POST系メソッドの場合はPOSTデータを処理
        $hasBody = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE']);
        
        if ($hasBody && !empty($postData)) {
            // POSTデータのシリアライズ
            switch ($contentType) {
                case 'application/json':
                    $postString = json_encode($postData);
                    break;
                
                case 'application/x-www-form-urlencoded':
                default:
                    $postString = http_build_query($postData);
                    break;
            }
        } else {
            $postString = '';
        }
        
        $contentLength = strlen($postString);
        
        // 環境変数を設定
        $env = [
            'REQUEST_METHOD' => $method,
            'QUERY_STRING' => http_build_query($getData),
            'SCRIPT_FILENAME' => $scriptPath,
            'REDIRECT_STATUS' => '200',
        ];
        
        // POSTデータがある場合のみContent-Type等を設定
        if ($hasBody && $contentLength > 0) {
            $env['CONTENT_TYPE'] = $contentType;
            $env['CONTENT_LENGTH'] = $contentLength;
        }
        
        // ユーザーのルートディレクトリを取得（セキュリティのためopen_basedirを設定）
        require_once(__DIR__ . '/file_functions.php');
        $userRoot = getUserRoot();

        $systemUserRoot = posix_getpwuid(posix_getuid())["dir"];
        
        // ライブラリ自動ロードスクリプトのパス
        // ユーザーのルートディレクトリに _autoload.php があれば自動的にロード
        $autoloadScript = $systemUserRoot . 'data/php_editor/sandbox/php.ini';
        
        // コマンドを構築（open_basedirでユーザーディレクトリに制限）
        // PHPエラー出力設定:
        // - display_errors=0: HTMLエスケープされたエラーをstdoutに出力しない
        // - html_errors=0: HTMLタグを使用しない（プレーンテキストのみ）
        // - log_errors=1: エラーをstderr（エラーログ）に出力
        // - auto_prepend_file: スクリプト実行前に自動的にロードするファイル
        // $phpOptions = [
        //     'open_basedir=' . escapeshellarg($FILE_ROOT),
        //     'display_errors=0',
        //     'html_errors=0',
        //     'log_errors=1'
        // ];
        
        $cmd = 'php-cgi';
        
        // _autoload.php が存在する場合は自動ロードを設定
        if (file_exists($autoloadScript)) {
            $cmd .= ' -c ' . escapeshellarg($autoloadScript);
        }
        
        // foreach ($phpOptions as $option) {
        //     $cmd .= ' -d ' . $option;
        // }
        $cmd .= ' ' . escapeshellarg($scriptPath);
        
        // 環境変数を追加
        foreach ($env as $key => $value) {
            $cmd = "$key=" . escapeshellarg((string)$value) . " $cmd";
        }
        
        error_log("[Debug] Executing command with method $method: " . $cmd);
        
        // プロセスを起動
        $descriptors = [
            0 => ["pipe", "r"], // stdin
            1 => ["pipe", "w"], // stdout
            2 => ["pipe", "w"]  // stderr
        ];
        
        $process = proc_open($cmd, $descriptors, $pipes);
        
        if (!is_resource($process)) {
            return [
                'success' => false,
                'error' => 'Failed to start process',
                'output' => '',
                'errors' => '',
                'exit_code' => -1
            ];
        }
        
        // POSTデータを書き込む
        if ($hasBody && $contentLength > 0) {
            fwrite($pipes[0], $postString);
        }
        fclose($pipes[0]);
        
        // 出力を読み取る
        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        
        // エラーを読み取る
        $errors = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        
        // プロセスを終了
        $exitCode = proc_close($process);
        
        error_log("[Debug] Exit code: " . $exitCode);
        
        // CGIヘッダーを除去
        $output = preg_replace('/^.*?\r?\n\r?\n/s', '', $output, 1);
        
        // サーバーの内部パスをユーザーパスに変換（セキュリティのため）
        $output = sanitizeOutputPaths($output);
        $errors = sanitizeOutputPaths($errors);
        
        return [
            'success' => $exitCode === 0,
            'output' => $output,
            'errors' => $errors,
            'exit_code' => $exitCode,
            'method' => $method,
            'post_data' => $hasBody ? $postData : null,
            'get_data' => $getData,
            'content_type' => $hasBody ? $contentType : null
        ];
    }
}