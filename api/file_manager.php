<?php
header('Content-Type: application/json');

session_start();
if(!isset($_SESSION["id"])){
    echo json_encode(array("status" => "session_error", "error" => "Not logged in"));
    exit();
}

require_once("file_functions.php");

// main function



if(!$_SERVER["REQUEST_METHOD"] == "POST"){
    echo json_encode(array("status" => "error", "error" => "Invalid request method"));
    exit();
}

$params = json_decode(file_get_contents('php://input'), true);
#error_log(print_r($params, true));
$action = $params["action"];
$path = htmlspecialchars_decode($params["path"], ENT_QUOTES);

if($action == "get"){
    $ret = getFile($path);
    echo json_encode(array("status" => "success", "content" => $ret["file"], "fileType" => $ret["fileType"]));
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

if($action == "mkdir"){
    $newPath = $params["newPath"];
    $newPath = makeDirectory($path, $newPath);
    echo json_encode(array("status" => "success", "newPath" => $newPath));
    exit();
}

if($action == "rename"){
    $newPath = $params["newPath"];
    $newPath = renameFile($path, $newPath);
    echo json_encode(array("status" => "success", "newPath" => $newPath));
    exit();
}

if($action == "renameDir"){
    $newPath = $params["newPath"];
    $newPath = renameDirectory($path, $newPath);
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

if($action == "deleteDir"){
    deleteDirectory($path);
    echo json_encode(array("status" => "success"));
    exit();
}


if($action == "list"){
    $files = fileList("");
    echo json_encode(array("status" => "success", "id" => $_SESSION["id"], "files" => $files));
    exit();
}

if($action == "list-object"){
    $files = fileObject($path);
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

if($action == "cgi_run"){
    $GETParams = $params["GETParams"];
    $result = phpCgiRun($path, $printHttpHeaders=false, $GETParams=$GETParams);
    echo json_encode(array("status" => "success", "result" => $result["status"], "message" => $result["message"]));
    exit();
}



echo json_encode(array("status" => "error", "error" => "Invalid action"));


?>