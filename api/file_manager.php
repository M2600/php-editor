<?php
session_start();
if(!isset($_SESSION["id"])){
    echo json_encode(array("status" => "session_error", "error" => "Not logged in"));
    exit();
}


$FILE_ROOT = "/tmp/";

// make safe path
// remove "../" from path
function safePath($path){
    $safe = str_replace("../", "", $path);

    return $safe;
}

// convert user path to server path
function convertUserPath($path){
    global $FILE_ROOT;
    $userPath = $FILE_ROOT . basename($_SESSION["id"]) . "/" . safePath($path);
    return $userPath;
}

// get file content
function getFile($userPath){
    try{
        $serverPath = convertUserPath($userPath);
        $file = file_get_contents($serverPath);
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
        file_put_contents($serverPath, $file);
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
        $files = scandir($serverPath);
        return $files;
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

$action = $_POST["action"];
$path = $_POST["path"];

if($action == "get"){
    $file = getFile($path);
    echo json_encode(array("status" => "success", "file" => $file));
    exit();
}

if($action == "save"){
    $file = $_POST["file"];
    saveFile($path, $file);
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
    $files = fileList($path);
    echo json_encode(array("status" => "success", "files" => $files));
    exit();
}


?>