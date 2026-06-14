<?php
require_once(__DIR__ . '/session_init.php');
header('Content-Type: application/json');
requireLogin();
require_once('file_functions.php');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'error' => 'Invalid request method']);
    exit();
}

$params  = json_decode(file_get_contents('php://input'), true) ?? [];
$action  = $params['action'] ?? '';
$userDir = getUserRoot();
$userId  = basename($_SESSION['id']);

switch ($action) {
    case 'snapshot':
        if (!canEditFiles()) {
            echo json_encode(['status' => 'success', 'committed' => false, 'message' => 'readonly mode']);
            exit();
        }
        $message = isset($params['message']) ? (string)$params['message'] : '(no message)';
        $result  = gitSnapshot($userDir, $message, $userId);
        echo json_encode(array_merge(['status' => 'success'], $result));
        break;

    case 'history':
        $filterPath = isset($params['file']) ? (string)$params['file'] : null;
        $limit      = min((int)($params['limit'] ?? 50), 200);
        $commits    = gitHistory($userDir, $userId, $filterPath, $limit);
        echo json_encode(['status' => 'success', 'commits' => $commits]);
        break;

    case 'commit_files':
        $hash = isset($params['hash']) ? (string)$params['hash'] : '';
        if (!preg_match('/^[0-9a-f]{40}$/i', $hash)) {
            echo json_encode(['status' => 'error', 'error' => 'invalid hash']);
            exit();
        }
        $files = gitCommitFiles($userDir, $userId, $hash);
        echo json_encode(['status' => 'success', 'files' => $files]);
        break;

    case 'restore':
        if (!canEditFiles()) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'error' => 'readonly mode']);
            exit();
        }
        $hash   = isset($params['hash']) ? (string)$params['hash'] : '';
        $result = gitRestore($userDir, $userId, $hash);
        echo json_encode(array_merge(
            ['status' => $result['success'] ? 'success' : 'error'],
            $result
        ));
        break;

    case 'diff':
        $hash1      = isset($params['hash1']) ? (string)$params['hash1'] : '';
        $hash2      = isset($params['hash2']) ? (string)$params['hash2'] : 'HEAD';
        $filterPath = isset($params['file']) ? (string)$params['file'] : null;
        $diff       = gitDiff($userDir, $userId, $hash1, $hash2, $filterPath);
        echo json_encode(['status' => 'success', 'diff' => $diff]);
        break;

    case 'show':
        $hash = isset($params['hash']) ? (string)$params['hash'] : '';
        $file = isset($params['file']) ? (string)$params['file'] : '';
        if (!$hash || !$file) {
            echo json_encode(['status' => 'error', 'error' => 'hash and file required']);
            exit();
        }
        $content = gitShowFile($userDir, $userId, $hash, $file);
        echo json_encode(['status' => 'success', 'content' => $content]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['status' => 'error', 'error' => 'invalid action']);
}
