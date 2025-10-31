<?php
// 統一されたセッション初期化
require_once(__DIR__ . '/api/session_init.php');

// ログイン認証チェック
requireLogin();

require("templates/ace-editor.html");

?>
