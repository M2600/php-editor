
<?php
if(!isset($_SESSION)){
    session_start();
}

// デバッグ: セッション情報をログ出力
error_log("login.php - Session ID exists: " . (isset($_SESSION["id"]) ? "yes" : "no"));
error_log("login.php - Redirect URL in session: " . (isset($_SESSION['redirect_after_login']) ? $_SESSION['redirect_after_login'] : "none"));

// すでにログイン済みの場合は、リダイレクト先があればそこへ、なければindex.phpへ
if(isset($_SESSION["id"])){
    $redirect = isset($_SESSION['redirect_after_login']) ? $_SESSION['redirect_after_login'] : '/index.php';
    if(isset($_SESSION['redirect_after_login'])){
        unset($_SESSION['redirect_after_login']);
    }
    error_log("login.php - Already logged in. Redirecting to: " . $redirect);
    header("Location: " . $redirect);
    exit();
}

require("templates/login.html");




?>
