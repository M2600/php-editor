<?php

// 強化されたログシステムを読み込み
require_once(__DIR__ . '/logger.php');

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


// make safe file name
function safePath($path){
    $safe = str_replace("../", "./", $path);
    //$safe = str_replace("/", "", $safe);
    //$safe = basename($path);

    return $safe;
}

function getUserRoot(){
    global $FILE_ROOT;
    $userRoot = $FILE_ROOT . basename($_SESSION["id"]) . "/";
    //error_log("userroot: ". $userRoot);
    return $userRoot;
}

// convert user path to server path
function convertUserPath($path){
    $userPath = getUserRoot() . safePath($path);
    $userPath = str_replace("//", "/", $userPath);
    //error_log("userpath: ".$userPath);
    return $userPath;
}

// convert server path to user path
function convertServerPath($path){
    $userPath = str_replace(getUserRoot(), "", $path);
    return $userPath;
}

function shellEscape($str){
    return escapeshellarg($str);
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
            return "";
        }

        $fileType = getFileType($serverPath);
        if($fileType === "text"){
            $file = file_get_contents($serverPath);
        }
        else if($fileType === "image"){
            $file = base64_encode(file_get_contents($serverPath));
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
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

// save file content
function saveFile($userPath, $file){
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
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function touchFile($userPath){
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

function makeDirectory($userPath){
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
    try{
        $fileOriginalName = $fileInfo["name"];
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
        $fullPath = $path . "/" . $p;
        $htmlSafePath = htmlspecialchars($p, ENT_QUOTES);
        if(is_dir($fullPath)){
            $object[] = array("name" => $htmlSafePath, "type" => "dir", "files" => fileRecursive($fullPath));
        }
        else{
            $object[] = array("name" => $htmlSafePath, "type" => getFileType($fullPath));
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
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace(getUserRoot(), "", $output[$i]);
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
        $userPath = str_replace(getUserRoot(), "", $serverPath);

        // 実行するファイルのディレクトリに移動
        $fileDirectory = dirname($serverPath);
        chdir($fileDirectory);
        $command = "php ";
        global $USER_SCRIPT_PHP_INI;
        if(file_exists($USER_SCRIPT_PHP_INI)){
            $command .= "-c " . shellEscape($USER_SCRIPT_PHP_INI) . " ";
        }
        $command .= shellEscape($serverPath) . " ";
        $command .= "2>&1";
        exec($command, $output, $return);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace($realPath, $userPath, $output[$i]);
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
        
        global $USER_SCRIPT_PHP_INI;
        $command = "php-cgi ";
        if(!$printHttpHeaders){
            $command .= "-q ";
        }
        if(file_exists($USER_SCRIPT_PHP_INI)){
            $command .= "-c " . shellEscape($USER_SCRIPT_PHP_INI) . " ";
        }
        $command .= "-f ";
        $command .= shellEscape($serverPath) . " ";
        foreach($GETParams as $key => $value){
            $command .= shellEscape($key . "=" . $value) . " ";
        }
        $command .= "2>&1";
        
        logDebug("Executing PHP CGI command", ['command' => $command]);
        exec($command, $output, $return);
        
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace(getUserRoot(), "", $output[$i]);
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


