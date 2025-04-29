<?php

header('Content-Type: application/json');

session_start();
if(!isset($_SESSION["id"])){
    echo json_encode(array("status" => "session_error", "error" => "Not logged in"));
    exit();
}

require_once("file_functions.php");

$action = $_POST["action"];
$path = htmlspecialchars_decode($_POST["path"], ENT_QUOTES);
if(!str_ends_with($path, "/")){
    $path = $path . "/";
}
$files = $_FILES;

error_log(print_r($_POST, true));
error_log(print_r($_FILES, true));


if($action == "upload"){
    $filePaths = array();
    try{
        foreach($files as $file){
            $serverPath = convertUserPath($path . $file["name"]);
            move_uploaded_file($file["tmp_name"], $serverPath);
            $filePaths[] = str_replace(getUserRoot(), "", $serverPath);
        }
        echo(json_encode(array("status" => "success", "paths" => $filePaths)));
    }
    catch(Exception $e){
        echo(json_encode(array("status" => "error", "error" => $e->getMessage())));
    }

    exit();
}



echo(json_encode(array("status" => "error", "error" => "Invalid action")));
