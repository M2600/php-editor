<?php
require_once(__DIR__ . '/api/session_init.php');
requireLogin(['teacher', 'admin']);

$templatePath = __DIR__ . '/templates/teacher.html';

if (file_exists($templatePath)) {
    readfile($templatePath);
} else {
    http_response_code(500);
    echo '<h1>Error</h1><p>Template file not found.</p>';
}
