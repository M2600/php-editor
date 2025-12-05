
<?php
// 統一されたセッション初期化（ログインページでは認証チェックしない）
require_once(__DIR__ . '/api/session_init.php');

// すでにログイン済みの場合は、リダイレクト先があればそこへ、なければindex.phpへ
if(isset($_SESSION["id"])){
    $redirect = isset($_SESSION['redirect_after_login']) ? $_SESSION['redirect_after_login'] : '/index.php';
    if(isset($_SESSION['redirect_after_login'])){
        unset($_SESSION['redirect_after_login']);
    }
    header("Location: " . $redirect);
    exit();
}

require("templates/login.html");




?>
