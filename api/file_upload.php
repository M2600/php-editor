<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

// ログイン認証チェック
requireLogin();

require_once("file_functions.php");

$action = $_POST["action"];
$path = htmlspecialchars_decode($_POST["path"], ENT_QUOTES);
if(!str_ends_with($path, "/")){
    $path = $path . "/";
}
$files = $_FILES;

// PHP設定を確認
$maxFileUploads = ini_get('max_file_uploads');
error_log("PHP max_file_uploads: $maxFileUploads");

//error_log(print_r($_POST, true));
//error_log(print_r($_FILES, true));


if($action == "upload"){
    $filePaths = array();
    $uploadedCount = 0;
    $errorFiles = array();
    
    try{
        // ファイル名変更マップを取得
        $fileRenames = [];
        if(isset($_POST["fileRenames"])){
            $fileRenames = json_decode($_POST["fileRenames"], true);
            error_log("File renames received: " . print_r($fileRenames, true));
        }
        
        // 相対パスマップを取得（フォルダアップロード用）
        $relativePaths = [];
        if(isset($_POST["relativePaths"])){
            $relativePaths = json_decode($_POST["relativePaths"], true);
            error_log("Relative paths received: " . print_r($relativePaths, true));
        }
        
        // 複数ファイルアップロードの正しい処理
        if(isset($files['files'])){
            $fileCount = count($files['files']['name']);
            error_log("Processing $fileCount files for upload to: $path");
            
            for($i = 0; $i < $fileCount; $i++){
                try {
                    // エラーチェック
                    if($files['files']['error'][$i] !== UPLOAD_ERR_OK){
                        $errorMsg = "Upload error code: " . $files['files']['error'][$i];
                        error_log("File upload error for {$files['files']['name'][$i]}: $errorMsg");
                        $errorFiles[] = $files['files']['name'][$i] . " ($errorMsg)";
                        continue; // 次のファイルへ
                    }
                    
                    // ファイル名とパスを取得
                    $fileName = $files['files']['name'][$i];
                    $tmpName = $files['files']['tmp_name'][$i];
                    $originalFileName = $fileName; // 元のファイル名を保存
                    
                    // 相対パスがある場合（フォルダアップロード）は、それを使用
                    if(!empty($relativePaths) && isset($relativePaths[$i])){
                        $relativePath = $relativePaths[$i];
                        error_log("Processing file $i: $relativePath");
                        
                        // 相対パスをそのまま使用（フォルダ構造を保持）
                        $fileName = $relativePath;
                        
                        // フォルダアップロードで最上位フォルダのリネームが必要な場合
                        if(!empty($fileRenames) && count($fileRenames) > 0){
                            // 相対パスの最上位フォルダ名を取得
                            $pathParts = explode('/', $relativePath);
                            $topLevelFolder = $pathParts[0];
                            
                            // リネーム情報から該当するフォルダを探す
                            foreach($fileRenames as $rename){
                                if(isset($rename['original']) && isset($rename['renamed'])){
                                    if($rename['original'] === $topLevelFolder){
                                        // 最上位フォルダ名を置換
                                        $pathParts[0] = $rename['renamed'];
                                        $fileName = implode('/', $pathParts);
                                        error_log("Renamed top-level folder: {$relativePath} -> {$fileName}");
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    // 個別ファイルアップロードの場合のリネーム処理
                    else if(!empty($fileRenames)){
                        error_log("Processing individual file rename for: {$fileName}");
                        foreach($fileRenames as $rename){
                            error_log("Checking rename: {$rename['original']} === {$fileName}");
                            if($rename['original'] === $fileName){
                                $fileName = $rename['renamed'];
                                error_log("Renaming file: {$rename['original']} -> {$fileName}");
                                break;
                            }
                        }
                    }
                    
                    // convertUserPath() は内部でパストラバーサルチェックを行う
                    // 不正なパスの場合は例外がスローされる
                    $serverPath = convertUserPath($path . $fileName);
                    error_log("Target server path: $serverPath (original: $originalFileName)");
                    
                    // ディレクトリが存在しない場合は作成
                    $directory = dirname($serverPath);
                    if (!is_dir($directory)) {
                        if(!mkdir($directory, 0755, true)){
                            error_log("Failed to create directory: $directory");
                            $errorFiles[] = $fileName . " (failed to create directory)";
                            continue;
                        }
                    }
                    
                    // ファイルを移動
                    if(move_uploaded_file($tmpName, $serverPath)){
                        $filePaths[] = str_replace(getUserRoot(), "", $serverPath);
                        $uploadedCount++;
                        logInfo("File uploaded successfully", [
                            'file_name' => $fileName,
                            'path' => $path . $fileName,
                            'user_id' => $_SESSION["id"] ?? 'unknown'
                        ]);
                    } else {
                        error_log("move_uploaded_file failed for: $fileName");
                        $errorFiles[] = $fileName . " (move failed)";
                    }
                } catch (Exception $fileError) {
                    error_log("Error processing file $i: " . $fileError->getMessage());
                    $errorFiles[] = ($fileName ?? "unknown") . " (" . $fileError->getMessage() . ")";
                }
            }
        } else {
            throw new Exception("アップロードファイルが見つかりません");
        }
        
        // 結果を返す
        $result = array(
            "status" => "success",
            "paths" => $filePaths,
            "uploaded" => $uploadedCount,
            "total" => $fileCount ?? 0
        );
        
        if(!empty($errorFiles)){
            $result["errors"] = $errorFiles;
            $result["message"] = "$uploadedCount files uploaded, " . count($errorFiles) . " failed";
        }
        
        error_log("Upload completed: $uploadedCount/{$fileCount} files uploaded");
        echo(json_encode($result));
    }
    catch(Exception $e){
        // セキュリティ関連のエラーをログに記録
        logError("File upload failed", [
            'path' => $path,
            'error' => $e->getMessage(),
            'user_id' => $_SESSION["id"] ?? 'unknown'
        ]);
        
        echo(json_encode(array("status" => "error", "error" => $e->getMessage())));
    }

    exit();
}



echo(json_encode(array("status" => "error", "error" => "Invalid action")));
