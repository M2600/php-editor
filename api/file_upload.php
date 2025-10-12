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

//error_log(print_r($_POST, true));
//error_log(print_r($_FILES, true));


if($action == "upload"){
    $filePaths = array();
    try{
        // 複数ファイルアップロードの正しい処理
        if(isset($files['files'])){
            $fileCount = count($files['files']['name']);
            
            for($i = 0; $i < $fileCount; $i++){
                // エラーチェック
                if($files['files']['error'][$i] !== UPLOAD_ERR_OK){
                    throw new Exception("ファイルアップロードエラー: " . $files['files']['name'][$i]);
                }
                
                // ファイル名とパスを取得
                $fileName = $files['files']['name'][$i];
                $tmpName = $files['files']['tmp_name'][$i];
                $serverPath = convertUserPath($path . $fileName);
                
                // ディレクトリが存在しない場合は作成
                $directory = dirname($serverPath);
                if (!is_dir($directory)) {
                    mkdir($directory, 0755, true);
                }
                
                // ファイルを移動
                if(move_uploaded_file($tmpName, $serverPath)){
                    $filePaths[] = str_replace(getUserRoot(), "", $serverPath);
                } else {
                    throw new Exception("ファイルの移動に失敗しました: " . $fileName);
                }
            }
        } else {
            throw new Exception("アップロードファイルが見つかりません");
        }
        echo(json_encode(array("status" => "success", "paths" => $filePaths)));
    }
    catch(Exception $e){
        echo(json_encode(array("status" => "error", "error" => $e->getMessage())));
    }

    exit();
}



echo(json_encode(array("status" => "error", "error" => "Invalid action")));
