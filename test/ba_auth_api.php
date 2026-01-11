<?php

class BAAuth {
	public function __construct() {

	}

	public function verifyCode(string $code) {
		$verifyUrl = 'https://bitarrow3.eplang.jp/bitarrow/?Login/bauth&status=' . urlencode($code);
		$response = file_get_contents($verifyUrl);
		if ($response === "OK") {
			return true;
		}
		return false;
	}

	public function verifyState(string $originalState, string $returnedState) {
		return hash_equals($originalState, $returnedState);
	}

	public function isLoggedIn(string $code) {
		$data = json_decode($code, true);
		if (!isset($data)) {
			return false;
		}
		if (!isset($data['user'])){
			return false;
		}
		if (!isset($data['class'])){
			return false;
		}
		return true;
	}
}

session_start();

// Only allow POST requests
if($_SERVER['REQUEST_METHOD'] !== 'POST'){
	http_response_code(405);
	echo "Method Not Allowed";
	exit();
}

$baAuth = new BAAuth();

$data = json_decode(file_get_contents('php://input'), true);
$code = isset($data['code']) ? $data['code'] : null;
$originalState = isset($data['original_state']) ? $data['original_state'] : null;
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
http_response_code($responseCode);
echo json_encode($response);
exit();