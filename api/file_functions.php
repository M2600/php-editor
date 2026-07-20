<?php

// 強化されたログシステムを読み込み
require_once(__DIR__ . '/logger.php');

require_once(__DIR__ . '/debug.php');

//$iniConf = parse_ini_file("../config.ini");
//error_log(print_r($iniConf, true));

$userRoot = posix_getpwuid(posix_getuid())["dir"];

$LOG_DIR = $userRoot . "/data/php_editor/log/";
if(!file_exists($LOG_DIR)){
    mkdir($LOG_DIR, 0777, true);
}

$FILE_ROOT = $userRoot . "/data/php_editor/sandbox/";
$USER_SCRIPT_PHP_INI = $userRoot . "/data/php_editor/sandbox/php.ini";
//error_log($FILE_ROOT);

// 既存のmyLog関数は logger.php で定義済み（後方互換性のため）


/**
 * ユーザーのルートディレクトリを取得
 * @return string ユーザーのルートディレクトリの絶対パス（末尾に/付き）
 */
function getUserRoot(){
    global $FILE_ROOT;
    $classAdminId = basename($_SESSION['class_admin_id'] ?? '_system_');
    $classId      = basename($_SESSION['class_id']       ?? '_system_');
    $userId       = basename($_SESSION['id']);
    return $FILE_ROOT . $classAdminId . '/' . $classId . '/' . $userId . '/';
}

/**
 * パスがユーザーのルートディレクトリ内にあるか検証
 * ディレクトリトラバーサル攻撃を防ぐための重要な関数
 * @param string $path 検証するパス
 * @param string $userRoot ユーザーのルートディレクトリ
 * @return bool ユーザーのルートディレクトリ内であればtrue、外であればfalse
 */
function isPathInUserRoot($path, $userRoot){
    // パスを正規化
    $realPath = realpath($path);
    $realUserRoot = realpath($userRoot);
    
    // ファイルが存在しない場合はrealpathがfalseを返すので、親ディレクトリで検証
    if($realPath === false){
        $parentDir = dirname($path);
        // 親ディレクトリが存在するか確認
        if(file_exists($parentDir)){
            $realPath = realpath($parentDir) . '/' . basename($path);
        } else {
            // 親ディレクトリも存在しない場合は再帰的にチェック
            return isPathInUserRoot($parentDir, $userRoot) && basename($path) !== '..';
        }
    }
    
    $realUserRoot = realpath($userRoot);
    if($realUserRoot === false){
        logError("User root directory does not exist", ['user_root' => $userRoot]);
        return false;
    }
    
    // パスがユーザールート配下にあるかチェック
    // strpos() === 0 は「文字列が指定した文字列で始まる」という意味
    $isInside = strpos($realPath, $realUserRoot) === 0;
    
    if(!$isInside){
        logWarning("Path traversal attempt detected", [
            'attempted_path' => $path,
            'real_path' => $realPath,
            'user_root' => $realUserRoot,
            'user_id' => $_SESSION["id"] ?? 'unknown'
        ]);
    }
    
    return $isInside;
}

/**
 * .git ディレクトリへのパスであれば例外を投げる
 */
function assertNotGitPath($userPath){
    if (preg_match('#(^|/)\.git(/|$)#', $userPath)) {
        throw new Exception('.git directory is protected');
    }
}

/**
 * クラスの .owner ファイルパスを取得
 */
function getClassOwnerFilePath($classId){
    global $FILE_ROOT;
    return $FILE_ROOT . '_bitarrow_/' . basename($classId) . '/.owner';
}

/**
 * クラスを所有する教員ID一覧を取得（未有効化なら空配列）
 * .owner は1行1教員IDのリスト形式
 */
function getClassOwners($classId){
    $path = getClassOwnerFilePath($classId);
    if (!file_exists($path)) return [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    return array_values(array_unique(array_map('trim', $lines)));
}

/**
 * クラスが有効化済みかどうか（オーナーが1人以上いるか）
 */
function isClassActivated($classId){
    return count(getClassOwners($classId)) > 0;
}

/**
 * クラスのオーナーに教員IDを追加登録（冪等）。
 * 既に他の教員が登録されていても上書きせず追加する（複数教員を許容）。
 * @return bool 新規に追加した場合のみtrue。既に登録済み・クラスID未指定の場合はfalse
 */
function addClassOwner($classId, $teacherId){
    if ($classId === '') {
        return false;
    }
    $owners = getClassOwners($classId);
    if (in_array($teacherId, $owners, true)) {
        return false; // 既に登録済み（新規アクティベートではない）
    }
    $path = getClassOwnerFilePath($classId);
    $dir  = dirname($path);
    if (!file_exists($dir)) {
        mkdir($dir, 0777, true);
    }
    $owners[] = $teacherId;
    file_put_contents($path, implode("\n", $owners) . "\n");
    logInfo('Class owner registered', ['class' => $classId, 'teacher' => $teacherId, 'owners' => $owners]);
    return true;
}

/**
 * パスを安全化（危険な文字列を除去）
 * @deprecated この関数は十分なセキュリティを提供しません。isPathInUserRoot()と併用してください
 * @param string $path 安全化するパス
 * @return string 安全化されたパス
 */
function safePath($path){
    // Null byteを除去
    $safe = str_replace("\0", "", $path);
    // 単純な../の置換（注意: これだけでは不十分）
    $safe = str_replace("../", "./", $safe);
    
    return $safe;
}

/**
 * ユーザーパスをサーバーパスに変換し、セキュリティチェックを実施
 * @param string $path ユーザーが指定したパス
 * @return string サーバー上の絶対パス
 * @throws Exception パスがユーザーのルートディレクトリ外の場合
 */
function convertUserPath($path){
    $userRoot = getUserRoot();
    
    // ユーザールートが存在しない場合は作成
    if(!file_exists($userRoot)){
        mkdir($userRoot, 0777, true);
        logInfo("Created user root directory", ['user_root' => $userRoot]);
    }
    
    // パスを安全化
    $safePath = safePath($path);
    
    // サーバーパスを構築
    $serverPath = $userRoot . $safePath;
    $serverPath = str_replace("//", "/", $serverPath);
    
    // セキュリティチェック: パスがユーザールート内にあるか検証
    if(!isPathInUserRoot($serverPath, $userRoot)){
        logError("Unauthorized path access attempt", [
            'user_id' => $_SESSION["id"] ?? 'unknown',
            'requested_path' => $path,
            'resolved_path' => $serverPath,
            'user_root' => $userRoot
        ]);
        throw new Exception("Access denied: Path is outside user directory");
    }
    
    //error_log("userpath: ".$serverPath);
    return $serverPath;
}

/**
 * サーバーパスをユーザーパスに変換
 * ユーザーに表示する際にサーバーの内部構造を隠すために使用
 * シンボリックリンクの実態パスも考慮する
 * @param string $path サーバー上の絶対パス
 * @return string ユーザー向けの相対パス
 */
function convertServerPath($path){
    $userRoot = getUserRoot();
    
    // 通常のパス置換
    $userPath = str_replace($userRoot, "", $path);
    
    // シンボリックリンクの実態パスも置換
    // user-programs がシンボリックリンクの場合、実態パスからも置換する
    $realUserRoot = realpath($userRoot);
    if ($realUserRoot !== false && $realUserRoot !== $userRoot) {
        $userPath = str_replace($realUserRoot, "", $userPath);
    }
    
    return $userPath;
}

/**
 * 文字列内のすべてのサーバーパスをユーザーパスに変換
 * エラーメッセージや実行結果からサーバーの内部パスを除去するために使用
 * @param string|array $output 変換する文字列または文字列の配列
 * @return string|array 変換後の文字列または配列
 */
function sanitizeOutputPaths($output){
    if (is_array($output)) {
        // 配列の場合は各要素を変換
        foreach ($output as $key => $value) {
            if (is_string($value)) {
                $output[$key] = convertServerPath($value);
            } elseif (is_array($value)) {
                $output[$key] = sanitizeOutputPaths($value);
            }
        }
        return $output;
    } elseif (is_string($output)) {
        // 文字列の場合はconvertServerPath()を使用
        return convertServerPath($output);
    }
    
    return $output;
}

/**
 * エラーレスポンスを生成する際にパスを安全化
 * JSON形式でエラーを返す前に内部パスを除去
 * @param string $message エラーメッセージ
 * @param mixed $context 追加のコンテキスト情報（オプション）
 * @return array エラーレスポンス配列
 */
function createSafeErrorResponse($message, $context = null){
    $message = sanitizeOutputPaths($message);
    
    $response = array(
        "status" => "error",
        "error" => $message
    );
    
    if ($context !== null) {
        $response["context"] = sanitizeOutputPaths($context);
    }
    
    return $response;
}

function shellEscape($str){
    return escapeshellarg($str);
}

/**
 * APIモード実行用の open_basedir オプション文字列を構築
 * webモード（nginx）の open_basedir=user-dir:.composer/:/tmp/ と同じ組み合わせに揃える。
 * さらに、ini で指定された auto_prepend_file/auto_append_file がユーザーディレクトリ外を
 * 指していても読み込めるよう、その値も許可パスに動的追加する。
 * @param string $userRoot ユーザー個別ディレクトリ（getUserRoot()の戻り値）
 * @param string|null $iniPath 実行に使用するphp.iniのパス（存在する場合のみ参照）
 * @return string "-d"オプションに渡す "open_basedir=..." 文字列
 */
function buildUserOpenBasedirOption($userRoot, $iniPath = null) {
    global $FILE_ROOT;
    $paths = [$userRoot, $FILE_ROOT . '.composer/', '/tmp'];

    if ($iniPath && file_exists($iniPath)) {
        $ini = parse_ini_file($iniPath);
        foreach (['auto_prepend_file', 'auto_append_file'] as $key) {
            if (!empty($ini[$key])) {
                $paths[] = $ini[$key];
            }
        }
    }

    return 'open_basedir=' . escapeshellarg(implode(':', $paths));
}

// get file type text | image | other
function getFileType($serverPath){
    // 拡張子による明示的判定を先に実行
    $pathExt = strtolower(pathinfo($serverPath, PATHINFO_EXTENSION));
    $textExtensions = array('txt', 'css', 'js', 'html', 'htm', 'xml', 'json', 'md', 'php', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'sql', 'csv', 'tsv', 'log', 'conf', 'ini', 'yaml', 'yml');
    if(in_array($pathExt, $textExtensions)){
        return "text";
    }
    
    $finfo = finfo_open(FILEINFO_MIME);
    $mime = finfo_file($finfo, $serverPath);
    finfo_close($finfo);
    //error_log($mime);
    // 空ファイルの場合はtextとして扱う
    if(strpos($mime, "x-empty") !== false){
        return "text";
    }
    // ファイルmimeがoctet-streamの場合はtextとして扱う
    // テキストファイルでも容量が小さすぎると(?)octet-stream判定になる
    if(strpos($mime, "octet-stream") !== false){
        return "text";
    }
    if(strpos($mime, "text") !== false){
        return "text";
    }
    if(strpos($mime, "json") !== false){
        return "text";
    }
    if(strpos($mime, "image") !== false){
        return "image";
    }
    return "other";
}

// get file content
function getFile($userPath){
    $startTime = logPerformanceStart("getFile");
    logInfo("File read started", ['path' => $userPath]);
    
    try{
        $serverPath = convertUserPath($userPath);
        if(!file_exists($serverPath)){
            logWarning("File not found", ['user_path' => $userPath, 'server_path' => $serverPath]);
            // 配列形式で返す（一貫性のため）
            return array("file" => "", "fileType" => "text", "error" => "File not found");
        }

        $fileType = getFileType($serverPath);
        if($fileType === "text"){
            $file = @file_get_contents($serverPath);
            if($file === false){
                $lastError = error_get_last();
                $message = $lastError && isset($lastError['message']) ? $lastError['message'] : 'unknown read error';
                throw new Exception("File read failed: " . $message);
            }
        }
        else if($fileType === "image"){
            $binaryFile = @file_get_contents($serverPath);
            if($binaryFile === false){
                $lastError = error_get_last();
                $message = $lastError && isset($lastError['message']) ? $lastError['message'] : 'unknown read error';
                throw new Exception("Image read failed: " . $message);
            }
            $file = base64_encode($binaryFile);
        }
        else{
            $file = "";
        }
        
        logPerformanceEnd("getFile", $startTime, [
            'file_type' => $fileType, 
            'file_size_bytes' => strlen($file),
            'path' => $userPath
        ]);
        
        return array("file" => $file, "fileType" => $fileType);
    }
    catch(Exception $e){
        logError("File read failed", ['path' => $userPath, 'error' => $e->getMessage()]);
        echo json_encode(createSafeErrorResponse($e->getMessage()));
        exit();
    }
}

// save file content
function saveFile($userPath, $file){
    assertNotGitPath($userPath);
    $startTime = logPerformanceStart("saveFile");
    
    // ファイル内容をログ出力（大きいファイルは切り詰め）
    $contentPreview = strlen($file) > 1000 ? substr($file, 0, 1000) . "... (truncated)" : $file;
    logInfo("File save started", [
        'path' => $userPath, 
        'file_size_bytes' => strlen($file),
        'content' => $contentPreview
    ]);
    
    //$safeFile = safePHP($file);
    try{
        $serverPath = convertUserPath($userPath);
        $serverDir = dirname($serverPath);
        if(!file_exists($serverDir)){
            mkdir($serverDir, 0777, true);
            logDebug("Created directory", ['dir' => $serverDir]);
        }
        
        $writeStart = microtime(true);
        file_put_contents($serverPath, $file, LOCK_EX);
        $writeEnd = microtime(true);
        
        $writeTime = round(($writeEnd - $writeStart) * 1000, 2);
        logPerformanceEnd("saveFile", $startTime, [
            'path' => $userPath,
            'write_time_ms' => $writeTime,
            'file_size_bytes' => strlen($file)
        ]);
        
        logFileOp("save", $userPath, true, ['file_size_bytes' => strlen($file)]);
    }
    catch(Exception $e){
        logError("File save failed", ['path' => $userPath, 'error' => $e->getMessage()]);
        echo json_encode(createSafeErrorResponse($e->getMessage()));
        exit();
    }
}

function touchFile($userPath){
    assertNotGitPath($userPath);
    logInfo("File creation started", ['path' => $userPath]);
    try{
        $serverPath = convertUserPath($userPath);
        $serverDir = dirname($serverPath);
        if(!file_exists($serverDir)){
            mkdir($serverDir, 0777, true);
            logDebug("Created directory", ['dir' => $serverDir]);
        }
        touch($serverPath);
        $resultPath = str_replace(getUserRoot(), "", $serverPath);
        logFileOp("create", $userPath, true, ['server_path' => $serverPath]);
        return $resultPath;
    }
    catch(Exception $e){
        logError("File creation failed", ['path' => $userPath, 'error' => $e->getMessage()]);
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
    
}

/**
 * ファイルを作成して内容を書き込む（AIツール用）
 */
function createFileWithContent($userPath, $content = ""){
    assertNotGitPath($userPath);
    logInfo("File creation with content started", ['path' => $userPath, 'content_length' => strlen($content)]);
    try{
        $serverPath = convertUserPath($userPath);
        $serverDir = dirname($serverPath);
        
        // ディレクトリが存在しない場合は作成
        if(!file_exists($serverDir)){
            mkdir($serverDir, 0777, true);
            logDebug("Created directory", ['dir' => $serverDir]);
        }
        
        // ファイルが既に存在する場合はエラー
        if(file_exists($serverPath)){
            throw new Exception("ファイルが既に存在します: " . $userPath);
        }
        
        // ファイルを作成して内容を書き込む
        file_put_contents($serverPath, $content);
        
        $resultPath = str_replace(getUserRoot(), "", $serverPath);
        logFileOp("create", $userPath, true, ['server_path' => $serverPath, 'content_length' => strlen($content)]);
        return $resultPath;
    }
    catch(Exception $e){
        logError("File creation with content failed", ['path' => $userPath, 'error' => $e->getMessage()]);
        throw $e; // 呼び出し元でエラーハンドリング
    }
}

function makeDirectory($userPath){
    assertNotGitPath($userPath);
    try{
        $serverPath = convertUserPath($userPath);
        $serverDir = dirname($serverPath);
        if(!file_exists($serverDir)){
            mkdir($serverDir, 0777, true);
        }
        $result = mkdir($serverPath);
        if($result === false){
            echo json_encode(array("status" => "error", "error" => "Directory already exists"));
            exit();
        }
        return str_replace(getUserRoot(), "", $serverPath);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function renameFile($userPath, $newPath){
    assertNotGitPath($userPath);
    assertNotGitPath($newPath);
    try{
        $serverPath = convertUserPath($userPath);
        $newServerPath = convertUserPath($newPath);
        $ret = rename($serverPath, $newServerPath);
        if($ret === false){
            echo json_encode(array("status" => "error", "error" => "Rename failed"));
            exit();
        }
        return str_replace(getUserRoot(), "", $newServerPath);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function renameDirectory($userPath, $newPath){
    assertNotGitPath($userPath);
    assertNotGitPath($newPath);
    try{
        $serverPath = convertUserPath($userPath);
        $newServerPath = convertUserPath($newPath);
        $ret = rename($serverPath, $newServerPath);
        if($ret === false){
            echo json_encode(array("status" => "error", "error" => "Rename failed"));
            exit();
        }
        return str_replace(getUserRoot(), "", $newServerPath);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function duplicateFile($userPath, $newPath){
    assertNotGitPath($userPath);
    assertNotGitPath($newPath);
    try{
        $serverPath = convertUserPath($userPath);
        $newServerPath = convertUserPath($newPath);
        while(file_exists($newServerPath)){
            $dir = dirname($newServerPath);
            $filename = explode(".", basename($newServerPath))[0];
            $arr = explode(".", basename($newServerPath));
            $ext = end($arr);
            $newServerPath = $dir . "/" . $filename . "_" . "." . $ext;
        }
        copy($serverPath, $newServerPath);
        return str_replace(getUserRoot(), "", $newServerPath);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

// upload file
function uploadFile($userPath, $fileInfo){
    $fileOriginalName = $fileInfo["name"];
    assertNotGitPath($userPath . '/' . $fileOriginalName);
    try{
        $fileTempName = $fileInfo["tmp_name"];
        $serverPath = convertUserPath($userPath) . "/" . $fileOriginalName;
        move_uploaded_file($fileTempName, $serverPath);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function downloadFile($userPath){

}


// delete file
function deleteFile($userPath){
    assertNotGitPath($userPath);
    try{
        $serverPath = convertUserPath($userPath);
        $ret = unlink($serverPath);
        if($ret === false){
            echo json_encode(array("status" => "error", "error" => "Delete failed"));
            exit();
        }
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function deleteDirectory($userPath){
    assertNotGitPath($userPath);
    try{
        $serverPath = convertUserPath($userPath);
        $paths = scandir($serverPath);
        foreach($paths as $path){
            if($path == "." || $path == "..") continue;
            $fullPath = $serverPath . "/" . $path;
            if(is_dir($fullPath)){
                deleteDirectory(convertServerPath($fullPath));
            }
            else{
                unlink($fullPath);
            }
        }
        $ret = rmdir($serverPath);
        if($ret === false){
            echo json_encode(array("status" => "error", "error" => "Delete failed"));
            exit();
        }
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}


// get list of files
function fileList($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        $paths = scandir($serverPath);
        if($paths === false){
            $paths = array();
        }
        $files = array();
        foreach($paths as $path){
            // skip . and ..
            if($path == "." || $path == "..") continue;
            $fullPath = $serverPath . "/" . $path;
            // skip directories
            if(is_dir($fullPath)) continue;
            $htmlSafePath = htmlspecialchars($path, ENT_QUOTES);
            $files[] = $htmlSafePath;
        }
        return $files;
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function fileRecursive($path){
    $object = array();
    $paths = scandir($path);
    foreach($paths as $p){
        if($p == "." || $p == "..") continue;
        if($p == ".git" || $p == ".gitignore") continue;
        $fullPath = $path . "/" . $p;
        $htmlSafePath = htmlspecialchars($p, ENT_QUOTES);
        $mtime = filemtime($fullPath);
        if(is_dir($fullPath)){
            $object[] = array(
                "name" => $htmlSafePath, 
                "type" => "dir", 
                "mtime" => $mtime,
                "files" => fileRecursive($fullPath)
            );
        }
        else{
            $object[] = array(
                "name" => $htmlSafePath, 
                "type" => getFileType($fullPath),
                "mtime" => $mtime
            );
        }
    }
    return $object;
}

function fileObject($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        $object["name"] = "/";
        $object["type"] = "dir";
        $object["files"] = fileRecursive($serverPath);
        return $object;
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}



function phpSyntaxError($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        exec("php -l " . shellEscape($serverPath) . " 2>&1", $output, $return);
        
        // サーバーパスをユーザーパスに変換してからHTMLエスケープ
        $output = sanitizeOutputPaths($output);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = htmlspecialchars($output[$i], ENT_QUOTES);
        }
        
        if($return != 0){
            return array("status" => true, "message" => $output);
        }
        return array("status" => false, "message" => array());
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}


function phpRunError($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        $realPath = realpath($serverPath);
        $userRoot = getUserRoot();

        // 実行するファイルのディレクトリに移動
        $fileDirectory = dirname($serverPath);
        chdir($fileDirectory);
        $command = "php ";
        global $USER_SCRIPT_PHP_INI;
        if(file_exists($USER_SCRIPT_PHP_INI)){
            $command .= "-c " . shellEscape($USER_SCRIPT_PHP_INI) . " ";
        }
        $command .= "-d " . buildUserOpenBasedirOption($userRoot, $USER_SCRIPT_PHP_INI) . " ";
        $command .= shellEscape($serverPath) . " ";
        $command .= "2>&1";
        exec($command, $output, $return);
        
        // サーバーパスをユーザーパスに変換
        // realpath()で解決されたパスも変換する
        $output = sanitizeOutputPaths($output);
        if ($realPath) {
            for($i = 0; $i < count($output); $i++){
                $output[$i] = str_replace($realPath, convertServerPath($realPath), $output[$i]);
            }
        }
        
        // HTMLエスケープ
        for($i = 0; $i < count($output); $i++){
            $output[$i] = htmlspecialchars($output[$i], ENT_QUOTES);
        }
        
        if($return != 0){
            return array("status" => true, "message" => $output);
        }
        return array("status" => false, "message" => $output);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}



function phpCgiRun($userPath, $printHttpHeaders=false, $GETParams=array()){
    $startTime = logPerformanceStart("phpCgiRun");
    logInfo("PHP CGI execution started", ['path' => $userPath, 'params' => $GETParams]);
    
    try{
        $serverPath = convertUserPath($userPath);
        if(!file_exists($serverPath)){
            logError("PHP CGI file not found", ['user_path' => $userPath, 'server_path' => $serverPath]);
            return array("status" => true, "message" => array("File not found: " . $userPath));
        }
        
        // 実行するファイルのディレクトリに移動
        $fileDirectory = dirname($serverPath);
        chdir($fileDirectory);

        $userRoot = getUserRoot();
        global $USER_SCRIPT_PHP_INI;
        $command = "php-cgi ";
        if(!$printHttpHeaders){
            $command .= "-q ";
        }
        if(file_exists($USER_SCRIPT_PHP_INI)){
            $command .= "-c " . shellEscape($USER_SCRIPT_PHP_INI) . " ";
        }
        $command .= "-d " . buildUserOpenBasedirOption($userRoot, $USER_SCRIPT_PHP_INI) . " ";
        $command .= "-f ";
        $command .= shellEscape($serverPath) . " ";
        foreach($GETParams as $key => $value){
            $command .= shellEscape($key . "=" . $value) . " ";
        }
        $command .= "2>&1";
        
        logDebug("Executing PHP CGI command", ['command' => $command]);
        exec($command, $output, $return);
        
        // サーバーパスをユーザーパスに変換してからHTMLエスケープ
        $output = sanitizeOutputPaths($output);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = htmlspecialchars($output[$i], ENT_QUOTES);
        }
        
        if($return != 0){
            logError("PHP CGI execution failed", [
                'path' => $userPath, 
                'return_code' => $return, 
                'output' => $output
            ]);
            return array("status" => true, "message" => $output);
        }
        
        logPerformanceEnd("phpCgiRun", $startTime, [
            'path' => $userPath,
            'output_lines' => count($output),
            'return_code' => $return
        ]);
        
        return array("status" => false, "message" => $output);
    }
    catch (Exception $e){
        logCritical("PHP CGI execution exception", ['path' => $userPath, 'error' => $e->getMessage()]);
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}



function safePHP($phpString){
    $safePHPStr = phpRemoveSystemFunctions($phpString);
    //error_log($safePHPStr);
}

function phpRemoveSystemFunctions($phpString){
    $functions = array(
        "system",
        "exec",
        "shell_exec",
        "passthru",
        "proc_open",
        "popen",
        "pcntl_exec",
        "`",

        "eval",
        "assert",
        "include",
        "require",
        "include_once",
        "require_once",

        "phpinfo",
        "posix_mkfifo",
        "posix_getlogin",
        "posix_ttyname",
        "getenv",
        "get_current_user",
        "proc_get_status",
        "get_cfg_var",
        "disk_free_space",
        "disk_total_space",
        "diskfreespace",
        "getcwd",
        "getlastmo",
        "getmygid",
        "getmyinode",
        "getmypid",
        "getmyuid",
    );
    // exec("echo \"" . str_replace("\"", "\\\"", $phpString) . "\" | php -w" , $output, $return);
    // $formatted = "";
    // foreach($output as $line){
    //     $formatted .= $line;
    // }
    $formatted = $phpString;
    //error_log($formatted);
    foreach($functions as $func){
        $offset = 0;
        while(strpos($formatted, $func, $offset) != false){
            $pos = strpos($formatted, $func, $offset);
            //error_log($pos);
            //これじゃだめコード中の禁止ワードの１文字前だけを判定してもダメ
            if($formatted[$pos - 1] !== "$"){
                $formatted = substr($formatted, 0, $pos) . "/*" . $func . "*/" . substr($formatted, $pos + strlen($func));
                $offset = $pos + 3;
            }
            else{
                $offset = $pos + 1;
            }
        }
    }
    return $formatted;
}


// ==================== Git version management ====================

function ensureGitRepo(string $userDir): bool {
    if (is_dir($userDir . '.git')) {
        return true;
    }
    $escaped = escapeshellarg(rtrim($userDir, '/'));
    exec("git -C $escaped init 2>&1", $out, $code);
    if ($code !== 0) {
        logError("git init failed", ['dir' => $userDir, 'output' => $out]);
        return false;
    }
    $gitignorePath = $userDir . '.gitignore';
    if (!file_exists($gitignorePath)) {
        file_put_contents($gitignorePath, "*.log\n.DS_Store\n");
    }
    return true;
}

function gitCmd(string $userDir, string $userId): string {
    $escapedDir   = escapeshellarg(rtrim($userDir, '/'));
    $escapedName  = escapeshellarg($userId);
    $escapedEmail = escapeshellarg($userId . '@php-editor.local');
    return "git -C $escapedDir -c user.name=$escapedName -c user.email=$escapedEmail";
}

function gitSnapshot(string $userDir, string $message, string $userId): array {
    if (!ensureGitRepo($userDir)) {
        return ['committed' => false, 'hash' => null, 'message' => 'git init failed'];
    }
    $base = gitCmd($userDir, $userId);
    exec("$base status --porcelain 2>&1", $statusOut, $statusCode);
    if (empty(array_filter($statusOut))) {
        return ['committed' => false, 'hash' => null, 'message' => 'no changes'];
    }
    exec("$base add -A 2>&1", $addOut, $addCode);
    if ($addCode !== 0) {
        return ['committed' => false, 'hash' => null, 'message' => 'git add failed'];
    }
    $safeMsg     = mb_substr($message, 0, 80, 'UTF-8');
    $escapedMsg  = escapeshellarg($safeMsg);
    exec("$base commit -m $escapedMsg 2>&1", $commitOut, $commitCode);
    if ($commitCode !== 0) {
        return ['committed' => false, 'hash' => null, 'message' => implode("\n", $commitOut)];
    }
    exec("$base rev-parse HEAD 2>&1", $hashOut, $hashCode);
    $hash = ($hashCode === 0) ? trim($hashOut[0]) : null;
    return ['committed' => true, 'hash' => $hash, 'message' => 'snapshot created'];
}

function gitHistory(string $userDir, string $userId, ?string $filterPath = null, int $limit = 50): array {
    if (!is_dir($userDir . '.git')) {
        return [];
    }
    $base    = gitCmd($userDir, $userId);
    $fileArg = '';
    if ($filterPath !== null) {
        $relative = ltrim($filterPath, '/');
        if ($relative !== '') {
            $fileArg = '-- ' . escapeshellarg($relative);
        }
    }
    exec("$base log --format='%H|%ai|%s|%P' -n " . (int)$limit . " $fileArg 2>&1", $out, $code);
    if ($code !== 0) {
        return [];
    }
    $commits = [];
    foreach ($out as $line) {
        $parts = explode('|', $line, 4);
        if (count($parts) >= 3) {
            $parentRaw  = isset($parts[3]) ? trim($parts[3]) : '';
            $firstParent = $parentRaw ? explode(' ', $parentRaw)[0] : '';
            $commits[] = [
                'hash'      => trim($parts[0]),
                'timestamp' => trim($parts[1]),
                'message'   => trim($parts[2]),
                'parent'    => $firstParent,
            ];
        }
    }
    return $commits;
}

function gitCommitFiles(string $userDir, string $userId, string $hash): array {
    if (!is_dir($userDir . '.git')) {
        return [];
    }
    if (!preg_match('/^[0-9a-f]{40}$/i', $hash)) {
        return [];
    }
    $base = gitCmd($userDir, $userId);
    exec("$base show --name-only --format='' " . escapeshellarg($hash) . " 2>&1", $out, $code);
    return ($code === 0) ? array_values(array_filter($out)) : [];
}

function gitRestore(string $userDir, string $userId, string $hash): array {
    if (!preg_match('/^[0-9a-f]{40}$/i', $hash)) {
        return ['success' => false, 'error' => 'invalid commit hash'];
    }
    if (!is_dir($userDir . '.git')) {
        return ['success' => false, 'error' => 'no git repository'];
    }
    $base        = gitCmd($userDir, $userId);
    $escapedHash = escapeshellarg($hash);
    exec("$base show --format='%s' -s $escapedHash 2>&1", $msgOut, $msgCode);
    $origMsg = ($msgCode === 0 && !empty($msgOut)) ? trim($msgOut[0]) : $hash;
    exec("$base checkout $escapedHash -- . 2>&1", $checkoutOut, $checkoutCode);
    if ($checkoutCode !== 0) {
        return ['success' => false, 'error' => implode("\n", $checkoutOut)];
    }
    exec("$base add -A 2>&1", $addOut, $addCode);
    $restoreMsg  = escapeshellarg('restored to: ' . mb_substr($origMsg, 0, 60, 'UTF-8'));
    exec("$base commit -m $restoreMsg 2>&1", $commitOut, $commitCode);
    if ($commitCode !== 0) {
        return ['success' => false, 'error' => implode("\n", $commitOut)];
    }
    exec("$base rev-parse HEAD 2>&1", $hashOut, $hashCode);
    $newHash = ($hashCode === 0) ? trim($hashOut[0]) : null;
    return ['success' => true, 'hash' => $newHash];
}

function gitDiff(string $userDir, string $userId, string $hash1, string $hash2 = 'HEAD', ?string $filterPath = null): string {
    if (!preg_match('/^[0-9a-f]{40}$/i', $hash1)) return '';
    if ($hash2 !== 'HEAD' && !preg_match('/^[0-9a-f]{40}$/i', $hash2)) return '';
    if (!is_dir($userDir . '.git')) return '';
    $base    = gitCmd($userDir, $userId);
    $range   = escapeshellarg($hash1) . '..' . ($hash2 === 'HEAD' ? 'HEAD' : escapeshellarg($hash2));
    $rel     = ($filterPath !== null) ? ltrim($filterPath, '/') : '';
    $fileArg = ($rel !== '') ? '-- ' . escapeshellarg($rel) : '';
    exec("$base diff $range $fileArg 2>&1", $out, $code);
    return implode("\n", $out);
}

function gitCommitDiff(string $userDir, string $userId, string $hash, ?string $filterPath = null): string {
    if (!preg_match('/^[0-9a-f]{40}$/i', $hash)) return '';
    if (!is_dir($userDir . '.git')) return '';
    $base    = gitCmd($userDir, $userId);
    $rel     = ($filterPath !== null) ? ltrim($filterPath, '/') : '';
    $fileArg = ($rel !== '') ? '-- ' . escapeshellarg($rel) : '';
    exec("$base show " . escapeshellarg($hash) . " --format='' -p $fileArg 2>&1", $out, $code);
    while (count($out) > 0 && trim($out[0]) === '') array_shift($out);
    return ($code === 0) ? implode("\n", $out) : '';
}

function gitShowFile(string $userDir, string $userId, string $hash, string $file): array {
    if (!preg_match('/^[0-9a-f]{40}$/i', $hash)) {
        return ['found' => false, 'content' => '', 'error' => 'invalid commit hash'];
    }
    if (!is_dir($userDir . '.git')) {
        return ['found' => false, 'content' => '', 'error' => 'no git repository'];
    }
    $base      = gitCmd($userDir, $userId);
    $objectRef = escapeshellarg($hash . ':' . ltrim($file, '/'));
    exec("$base show $objectRef 2>&1", $out, $code);
    if ($code !== 0) {
        $errMsg = preg_replace('/^fatal:\s*/i', '', trim(implode(' ', $out)));
        return ['found' => false, 'content' => '', 'error' => $errMsg];
    }
    return ['found' => true, 'content' => implode("\n", $out), 'error' => ''];
}
