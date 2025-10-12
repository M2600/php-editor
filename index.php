<?php
if(!isset($_SESSION)){
    session_start();
}
if(!isset($_SESSION["id"])){
    // 現在のURLをセッションに保存（ログイン後にリダイレクトするため）
    $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'];
    error_log("Not logged in. Saving redirect URL: " . $_SERVER['REQUEST_URI']);
    header("Location: /login.php");
    exit();
}

require("editor.php");


?>
