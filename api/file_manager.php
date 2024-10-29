<?php
header('Content-Type: application/json');

session_start();
if(!isset($_SESSION["id"])){
    echo json_encode(array("status" => "session_error", "error" => "Not logged in"));
    exit();
}

//$iniConf = parse_ini_file("../config.ini");
//error_log(print_r($iniConf, true));

$userRoot = $user = posix_getpwuid(posix_getuid())["dir"];

$FILE_ROOT = $userRoot . "/data/php_editor/sandbox/";
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
    return $FILE_ROOT . basename($_SESSION["id"]) . "/";
}

// convert user path to server path
function convertUserPath($path){
    $userPath = getUserRoot() . safePath($path);
    error_log($userPath);
    return $userPath;
}

// get file content
function getFile($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        $file = file_get_contents($serverPath);
        // if($file === false){
        //     $file = "";
        // }
        return $file;
    }
    catch(Exception $e){
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}

// save file content
function saveFile($userPath, $file){
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
            $htmlSafePath = htmlspecialchars($path);
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
        exec("php -l '" . $serverPath . "' 2>&1", $output, $return);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace($serverPath, basename($serverPath), $output[$i]);
            $output[$i] = htmlspecialchars($output[$i]);
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
        //error_log(getUserRoot());
        chdir(getUserRoot());
        $fileName = str_replace(getUserRoot(), "", $serverPath);
        exec("php '" . $fileName . "' 2>&1", $output, $return);
        for($i = 0; $i < count($output); $i++){
            $output[$i] = str_replace(getUserRoot(), "", $output[$i]);
            $output[$i] = htmlspecialchars($output[$i]);
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
}







// main function



if(!$_SERVER["REQUEST_METHOD"] == "POST"){
    echo json_encode(array("status" => "error", "error" => "Invalid request method"));
    exit();
}

$params = json_decode(file_get_contents('php://input'), true);
error_log(print_r($params, true));
$action = $params["action"];
$path = htmlspecialchars_decode($params["path"]);

if($action == "get"){
    $file = getFile($path);
    echo json_encode(array("status" => "success", "content" => $file));
    exit();
}

if($action == "save"){
    $file = $params["content"];
    saveFile($path, $file);
    echo json_encode(array("status" => "success"));
    exit();
}

if($action == "touch"){
    $createdFilePath = touchFile($path);
    echo json_encode(array("status" => "success", "createdFilePath" => $createdFilePath));
    exit();
}

if($action == "rename"){
    $newPath = $params["newPath"];
    $newPath = renameFile($path, $newPath);
    echo json_encode(array("status" => "success", "newPath" => $newPath));
    exit();
}

if($action == "duplicate"){
    $newPath = explode(".", $path)[0] . "_copy." . explode(".", $path)[1];
    $newPath = duplicateFile($path, $newPath);
    echo json_encode(array("status" => "success", "newPath" => $newPath));
    exit();
}

if($action == "upload"){
    $fileInfo = $_FILES["file"];
    uploadFile($path, $fileInfo);
    echo json_encode(array("status" => "success"));
    exit();
}

if($action == "delete"){
    deleteFile($path);
    echo json_encode(array("status" => "success"));
    exit();
}

if($action == "list"){
    $files = fileList("");
    echo json_encode(array("status" => "success", "id" => $_SESSION["id"], "files" => $files));
    exit();
}


if($action == "syntax_check"){
    $result = phpSyntaxError($path);
    echo json_encode(array("status" => "success", "result" => $result["status"], "message" => $result["message"]));
    exit();
}


if($action == "run"){
    $result = phpRunError($path);
    echo json_encode(array("status" => "success", "result" => $result["status"], "message" => $result["message"]));
    exit();
}




echo json_encode(array("status" => "error", "error" => "Invalid action"));


?>