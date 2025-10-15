<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/api/session_init.php');

// ログアウトは認証なしでも実行可能（既にログアウト状態でも問題ない）
$_SESSION = array();
session_destroy();
header("Location: /login.php");

?>