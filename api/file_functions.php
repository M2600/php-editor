<?php


//$iniConf = parse_ini_file("../config.ini");
//error_log(print_r($iniConf, true));

$userRoot = $user = posix_getpwuid(posix_getuid())["dir"];

$FILE_ROOT = $userRoot . "/data/php_editor/sandbox/";
$USER_SCRIPT_PHP_INI = $userRoot . "/data/php_editor/sandbox/php.ini";
//error_log($FILE_ROOT);

// make safe file name
function safePath($path){
    //$safe = str_replace("../", "", $path);
    //$safe = str_replace("/", "", $safe);
    $safe = basename($path);

    return $safe;
}

function getUserRoot(){
    global $FILE_ROOT;
    $userRoot = $FILE_ROOT . basename($_SESSION["id"]) . "/";
    error_log("userroot: ". $userRoot);
    return $userRoot;
}

// convert user path to server path
function convertUserPath($path){
    $userPath = getUserRoot() . safePath($path);
    error_log("userpath: ".$userPath);
    return $userPath;
}

function shellEscape($str){
    return escapeshellarg($str);
}

// get file type text | image | other
function getFileType($serverPath){
    $finfo = finfo_open(FILEINFO_MIME);
    $mime = finfo_file($finfo, $serverPath);
    finfo_close($finfo);
    error_log($mime);
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
    if(strpos($mime, "image") !== false){
        return "image";
    }
    return "other";
}

// get file content
function getFile($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        if(!file_exists($serverPath)){
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
        // if($file === false){
        //     $file = "";
        // }
        return array("file" => $file, "fileType" => $fileType);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

// save file content
function saveFile($userPath, $file){
    $safeFile = safePHP($file);
    try{
        $serverPath = convertUserPath($userPath);
        $serverDir = dirname($serverPath);
        if(!file_exists($serverDir)){
            mkdir($serverDir, 0777, true);
        }
        file_put_contents($serverPath, $file, LOCK_EX);
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

function touchFile($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        $serverDir = dirname($serverPath);
        if(!file_exists($serverDir)){
            mkdir($serverDir, 0777, true);
        }
        touch($serverPath);
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
        rename($serverPath, $newServerPath);
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
        unlink($serverPath);
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
        chdir(getUserRoot());
        $filePath = str_replace(getUserRoot(), "", $serverPath);
        $command = "php ";
        global $USER_SCRIPT_PHP_INI;
        if(file_exists($USER_SCRIPT_PHP_INI)){
            $command .= "-c " . shellEscape($USER_SCRIPT_PHP_INI) . " ";
        }
        $command .= shellEscape($filePath) . " ";
        $command .= "2>&1";
        exec($command, $output, $return);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace(getUserRoot(), "", $output[$i]);
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
    try{
        $serverPath = convertUserPath($userPath);
        chdir(getUserRoot());
        $filePath = str_replace(getUserRoot(), "", $serverPath);
        global $USER_SCRIPT_PHP_INI;
        $command = "php-cgi ";
        if($printHttpHeaders){
            $command .= "-q ";
        }
        if(file_exists($USER_SCRIPT_PHP_INI)){
            $command .= "-c " . shellEscape($USER_SCRIPT_PHP_INI) . " ";
        }
        $command .= shellEscape($filePath) . " ";
        foreach($GETParams as $key => $value){
            $command .= shellEscape($key . "=" . $value) . " ";
        }
        $command .= "2>&1";
        exec($command, $output, $return);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace(getUserRoot(), "", $output[$i]);
            $output[$i] = htmlspecialchars($output[$i], ENT_QUOTES);
        }
        if($return != 0){
            return array("status" => true, "message" => $output);
        }
        return array("status" => false, "message" => $output);
    }
    catch (Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}



function safePHP($phpString){
    $safePHPStr = phpRemoveSystemFunctions($phpString);
    error_log($safePHPStr);
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
    error_log($formatted);
    foreach($functions as $func){
        $offset = 0;
        while(strpos($formatted, $func, $offset) != false){
            $pos = strpos($formatted, $func, $offset);
            error_log($pos);
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


