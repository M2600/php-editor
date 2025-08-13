<?php

/**
 * 強化されたログシステム
 * 日付別ファイル分割とログレベル対応
 */

// ログレベル定数
define('LOG_LEVEL_DEBUG', 0);
define('LOG_LEVEL_INFO', 1);
define('LOG_LEVEL_WARNING', 2);
define('LOG_LEVEL_ERROR', 3);
define('LOG_LEVEL_CRITICAL', 4);

// デフォルトログディレクトリを設定
$userRoot = posix_getpwuid(posix_getuid())["dir"];
$DEFAULT_LOG_DIR = $userRoot . "/data/php_editor/log/";

class Logger {
    private $logDir;
    private $logLevel;
    private $maxLogFiles;
    
    public function __construct($logDir = null, $logLevel = LOG_LEVEL_INFO, $maxLogFiles = 30) {
        global $LOG_DIR, $DEFAULT_LOG_DIR;
        // 優先順位: 引数 > グローバル変数 > デフォルト値
        $this->logDir = $logDir ?: ($LOG_DIR ?? $DEFAULT_LOG_DIR);
        $this->logLevel = $logLevel;
        $this->maxLogFiles = $maxLogFiles;
        
        // ログディレクトリが存在しない場合は作成
        if (!file_exists($this->logDir)) {
            mkdir($this->logDir, 0777, true);
        }
    }
    
    /**
     * ログレベル名を取得
     */
    private function getLevelName($level) {
        $levels = [
            LOG_LEVEL_DEBUG => 'DEBUG',
            LOG_LEVEL_INFO => 'INFO',
            LOG_LEVEL_WARNING => 'WARNING',
            LOG_LEVEL_ERROR => 'ERROR',
            LOG_LEVEL_CRITICAL => 'CRITICAL'
        ];
        return $levels[$level] ?? 'UNKNOWN';
    }
    
    /**
     * 今日の日付でログファイル名を生成
     */
    private function getTodayLogFile() {
        $dateStr = date('Y-m-d');
        return $this->logDir . "php_editor_{$dateStr}.log";
    }
    
    /**
     * 古いログファイルを削除
     */
    private function cleanupOldLogs() {
        $logFiles = glob($this->logDir . "php_editor_*.log");
        if (count($logFiles) > $this->maxLogFiles) {
            // ファイル名でソートして古いものから削除
            sort($logFiles);
            $filesToDelete = array_slice($logFiles, 0, count($logFiles) - $this->maxLogFiles);
            foreach ($filesToDelete as $file) {
                @unlink($file);
            }
        }
    }
    
    /**
     * ログメッセージを書き込み
     */
    public function log($level, $message, $context = []) {
        if ($level < $this->logLevel) {
            return; // ログレベルが設定値未満の場合はスキップ
        }
        
        $timestamp = date("Y-m-d H:i:s");
        $levelName = $this->getLevelName($level);
        $processId = getmypid();
        
        // セッションIDを安全に取得
        $sessionId = isset($_SESSION["id"]) ? $_SESSION["id"] : 'NO_SESSION';
        
        // コンテキスト情報があれば追加
        $contextStr = '';
        if (!empty($context)) {
            $contextStr = ' | Context: ' . json_encode($context, JSON_UNESCAPED_UNICODE);
        }
        
        $logLine = "[{$timestamp}] [{$levelName}] [PID:{$processId}] [User:{$sessionId}] {$message}{$contextStr}\n";
        
        $logFile = $this->getTodayLogFile();
        file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
        
        // 定期的に古いログを削除（10回に1回実行）
        if (rand(1, 10) === 1) {
            $this->cleanupOldLogs();
        }
    }
    
    /**
     * 便利メソッド群
     */
    public function debug($message, $context = []) {
        $this->log(LOG_LEVEL_DEBUG, $message, $context);
    }
    
    public function info($message, $context = []) {
        $this->log(LOG_LEVEL_INFO, $message, $context);
    }
    
    public function warning($message, $context = []) {
        $this->log(LOG_LEVEL_WARNING, $message, $context);
    }
    
    public function error($message, $context = []) {
        $this->log(LOG_LEVEL_ERROR, $message, $context);
    }
    
    public function critical($message, $context = []) {
        $this->log(LOG_LEVEL_CRITICAL, $message, $context);
    }
    
    /**
     * パフォーマンス計測用ヘルパー
     */
    public function logPerformance($operation, $startTime, $additionalInfo = []) {
        $endTime = microtime(true);
        $duration = round(($endTime - $startTime) * 1000, 2);
        $context = array_merge(['duration_ms' => $duration], $additionalInfo);
        $this->info("Performance: {$operation} completed", $context);
        return $endTime;
    }
    
    /**
     * ファイル操作用ログヘルパー
     */
    public function logFileOperation($operation, $path, $success = true, $additionalInfo = []) {
        $level = $success ? LOG_LEVEL_INFO : LOG_LEVEL_ERROR;
        $status = $success ? 'SUCCESS' : 'FAILED';
        $context = array_merge(['path' => $path, 'status' => $status], $additionalInfo);
        $this->log($level, "File Operation: {$operation}", $context);
    }
}

// グローバルロガーインスタンス
$GLOBAL_LOGGER = new Logger();

/**
 * 既存のmyLog関数との互換性を保つ
 */
function myLog($message) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->info($message);
}

/**
 * 新しいログ関数群（推奨）
 */
function logDebug($message, $context = []) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->debug($message, $context);
}

function logInfo($message, $context = []) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->info($message, $context);
}

function logWarning($message, $context = []) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->warning($message, $context);
}

function logError($message, $context = []) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->error($message, $context);
}

function logCritical($message, $context = []) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->critical($message, $context);
}

/**
 * パフォーマンス計測ヘルパー
 */
function logPerformanceStart($operation) {
    logDebug("Performance: {$operation} started");
    return microtime(true);
}

function logPerformanceEnd($operation, $startTime, $additionalInfo = []) {
    global $GLOBAL_LOGGER;
    return $GLOBAL_LOGGER->logPerformance($operation, $startTime, $additionalInfo);
}

/**
 * ファイル操作ログヘルパー
 */
function logFileOp($operation, $path, $success = true, $additionalInfo = []) {
    global $GLOBAL_LOGGER;
    $GLOBAL_LOGGER->logFileOperation($operation, $path, $success, $additionalInfo);
}

?>
