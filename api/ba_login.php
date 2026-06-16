<?php
require_once(__DIR__ . '/session_init.php');
require_once(__DIR__ . '/includes/ba_auth.php');
require_once(__DIR__ . '/file_functions.php');

header('Content-Type: application/json');

$baAuth = new BAAuth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	$state = $baAuth->generateState();
	$_SESSION['ba_oauth_state'] = $state;
	echo json_encode(['state' => $state]);
	exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$data = json_decode(file_get_contents('php://input'), true);
	$code          = $data['code']  ?? null;
	$returnedState = $data['state'] ?? '';
	$originalState = $_SESSION['ba_oauth_state'] ?? '';

	// stateは使い捨て
	unset($_SESSION['ba_oauth_state']);

	if (!$baAuth->verifyState($originalState, $returnedState)) {
		http_response_code(400);
		echo json_encode(['status' => 'failure', 'message' => '不正なリクエストです。やり直してください。']);
		exit();
	}

	if (!$baAuth->verifyCode($code)) {
		http_response_code(401);
		echo json_encode(['status' => 'failure', 'message' => '認証に失敗しました。']);
		exit();
	}

	if (!$baAuth->isLoggedIn($code)) {
		http_response_code(403);
		echo json_encode(['status' => 'not_logged_in', 'message' => 'BitArrowにログインしていません。ログイン後に再度お試しください。']);
		exit();
	}

	$userData = json_decode($code, true);
	$redirect = $_SESSION['redirect_after_login'] ?? '/index.php';

	// 学生ログイン時：クラスが有効化されているか確認
	if (!isset($userData['teacher']) && !isClassActivated($userData['class'])) {
		http_response_code(403);
		echo json_encode([
			'status'  => 'class_not_activated',
			'message' => 'このクラスは有効化されていません。担当教員にBitArrowへのログインを依頼してください。'
		]);
		exit();
	}

	session_regenerate_id(true);

	// teacherキー優先（代理ログイン中も教員として扱う）
	if (isset($userData['teacher'])) {
		$_SESSION['id']             = $userData['teacher'];
		$_SESSION['class_admin_id'] = '_bitarrow_';
		$_SESSION['class_id']       = '_teachers_';
		$_SESSION['role']           = 'teacher';

		// BitArrowが返す class は「最後にアクセスしたクラス」＝オーナーであることが保証される
		if (!empty($userData['class'])) {
			addClassOwner($userData['class'], $userData['teacher']);
		}
	} else {
		$_SESSION['id']             = $userData['user'];
		$_SESSION['class_admin_id'] = '_bitarrow_';
		$_SESSION['class_id']       = $userData['class'];
		$_SESSION['role']           = 'user';
	}

	if (isset($_SESSION['redirect_after_login'])) {
		unset($_SESSION['redirect_after_login']);
	}

	http_response_code(200);
	echo json_encode([
		'status'   => 'success',
		'message'  => 'ログインしました',
		'redirect' => $redirect
	]);
	exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
