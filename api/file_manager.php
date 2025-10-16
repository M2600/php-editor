<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

// ログイン認証チェック
requireLogin();

require_once("file_functions.php");
require_once("debug.php");

// main function



if(!$_SERVER["REQUEST_METHOD"] == "POST"){
    echo json_encode(array("status" => "error", "error" => "Invalid request method"));
    exit();
}

$params = json_decode(file_get_contents('php://input'), true);
#error_log(print_r($params, true));
$action = $params["action"];
$path = htmlspecialchars_decode($params["path"], ENT_QUOTES);

// すべてのファイル操作をtry-catchで囲み、パストラバーサル攻撃を防ぐ
try {
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
        $newPath = $params["path"];
        $newPath = makeDirectory($newPath);
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
} catch (Exception $e) {
    // セキュリティ関連のエラーをログに記録
    logError("File operation failed", [
        'action' => $action,
        'path' => $path,
        'error' => $e->getMessage(),
        'user_id' => $_SESSION["id"] ?? 'unknown'
    ]);
    
    // クライアントには詳細を隠した一般的なエラーメッセージを返す
    echo json_encode(array(
        "status" => "error", 
        "error" => "Access denied or invalid operation"
    ));
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
    $startTime = logPerformanceStart("cgi_run");
    logInfo("PHP CGI execution started", ['path' => $path]);
    
    try {
        // パスをサーバーパスに変換
        $serverPath = convertUserPath($path);
        
        if(!file_exists($serverPath)){
            logError("PHP CGI file not found", ['user_path' => $path, 'server_path' => $serverPath]);
            echo json_encode(array(
                "status" => "success", 
                "result" => true, 
                "message" => array("File not found: " . $path)
            ));
            exit();
        }
        
        // 実行するファイルのディレクトリに移動
        $fileDirectory = dirname($serverPath);
        chdir($fileDirectory);
        
        // リクエストパラメータを取得
        $method = $params["method"] ?? "GET";
        $GETParams = $params["GETParams"] ?? array();
        $POSTParams = $params["POSTParams"] ?? array();
        $contentType = $params["contentType"] ?? "application/x-www-form-urlencoded";
        
        logDebug("Executing with Debug class", [
            'method' => $method,
            'path' => $serverPath,
            'get' => $GETParams,
            'post' => $POSTParams,
            'content_type' => $contentType
        ]);
        
        // Debugクラスを使用して実行
        if (strtoupper($method) === "POST" || strtoupper($method) === "PUT" || strtoupper($method) === "PATCH") {
            // POSTメソッドの場合
            $result = Debug::executeWithPost(
                $serverPath,
                $POSTParams,
                $GETParams,
                $contentType
            );
        } else {
            // GETメソッドの場合
            $result = Debug::execute(
                $serverPath,
                $method,
                array(),
                $GETParams
            );
        }
        
        logPerformanceEnd("cgi_run", $startTime, [
            'path' => $path,
            'success' => $result['success'],
            'exit_code' => $result['exit_code']
        ]);
        
        // 出力をHTMLエスケープ（パス変換はDebugクラスで既に実施済み）
        $outputLines = explode("\n", $result['output']);
        for($i = 0; $i < count($outputLines); $i++){
            $outputLines[$i] = htmlspecialchars($outputLines[$i], ENT_QUOTES);
        }
        
        // エラー出力も処理
        $errorLines = array();
        if (!empty($result['errors'])) {
            $errorLines = explode("\n", $result['errors']);
            for($i = 0; $i < count($errorLines); $i++){
                $errorLines[$i] = htmlspecialchars($errorLines[$i], ENT_QUOTES);
            }
        }
        
        // 成功の場合はresult=false（エラーなし）、失敗の場合はresult=true（エラーあり）
        // これは既存のphpCgiRunの戻り値形式に合わせるため
        $hasError = !$result['success'];
        
        // 出力とエラーを結合
        $allOutput = array_merge($errorLines, $outputLines);
        
        if ($hasError) {
            logError("PHP CGI execution failed", [
                'path' => $path,
                'exit_code' => $result['exit_code'],
                'output_lines' => count($allOutput)
            ]);
        }
        
        echo json_encode(array(
            "status" => "success", 
            "result" => $hasError,
            "message" => $allOutput,
            "exit_code" => $result['exit_code'],
            "method" => $method
        ));
        exit();
        
    } catch (Exception $e) {
        logCritical("PHP CGI execution exception", ['path' => $path, 'error' => $e->getMessage()]);
        echo json_encode(array("status" => "error", "error" => $e->getMessage()));
        exit();
    }
}



echo json_encode(array("status" => "error", "error" => "Invalid action"));


?>