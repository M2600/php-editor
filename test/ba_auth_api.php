<?php

require_once __DIR__ . '/ba_auth_module.php';

session_start();

$baAuth = new BAAuth();
// 初期化処理をGETリクエストで行う
if($_SERVER['REQUEST_METHOD'] === 'GET') {
	$state = $baAuth->generateState();
	$_SESSION['oauth_state'] = $state;
	header('Content-Type: application/json');
	echo json_encode(['state' => $state]);
	exit();
}
// Only allow POST requests
else if($_SERVER['REQUEST_METHOD'] === 'POST'){

	$data = json_decode(file_get_contents('php://input'), true);
	$code = isset($data['code']) ? $data['code'] : null;
	$originalState = isset($_SESSION['oauth_state']) ? $_SESSION['oauth_state'] : "";
	$returnedState = isset($data['state']) ? $data['state'] : null;

	$response = [];
	$response['identifier'] = $code;
	$response['status'] = 'failure';


	header('Content-Type: application/json');
	if (!$baAuth->verifyState($originalState, $returnedState)) {
		$responseCode = 400;
		$response['message'] = "Invalid state parameter.";
	}
	else if (!$baAuth->verifyCode($code)) {
		$responseCode = 401;
		$response['message'] = "Authentication failed.";
	}
	else if (!$baAuth->isLoggedIn($code)) {
		$responseCode = 403;
		$response['message'] = "BitArrow account information could not be found.";
	}

	else {
		session_regenerate_id(true);
		$responseCode = 200;
		$response['status'] = 'success';
		$response['message'] = "Authentication successful!";
	}
	unset($_SESSION['oauth_state']);
	http_response_code($responseCode);
	echo json_encode($response);
	exit();
}
// Other request methods are not allowed
else {
	http_response_code(405);
	echo "Method Not Allowed";
	exit();
}
