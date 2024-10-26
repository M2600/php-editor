<?php
header('Content-Type: application/json');

session_start();
if(!isset($_SESSION["id"])){
    echo json_encode(array("status" => "session_error", "error" => "Not logged in"));
    exit();
}



$FILE_ROOT = "/tmp/phpEditor/";

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
        $pathes = scandir($serverPath);
        if($pathes === false){
            $pathes = array();
        }
        $files = array();
        foreach($pathes as $path){
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
    touchFile($path);
    echo json_encode(array("status" => "success"));
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




echo json_encode(array("status" => "error", "error" => "Invalid action"));


?>