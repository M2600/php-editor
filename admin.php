<?php
/**
 * 管理者ページ
 * admin ロールのみアクセス可能
 */

// 統一されたセッション初期化
require_once(__DIR__ . '/api/session_init.php');

// admin ロール専用ページ
requireLogin('admin');

// テンプレートを読み込んで表示
$templatePath = __DIR__ . '/templates/admin.html';

if (file_exists($templatePath)) {
    readfile($templatePath);
} else {
    http_response_code(500);
    echo '<h1>Error</h1><p>Template file not found.</p>';
}
