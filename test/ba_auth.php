<?php
session_start();


$code = isset($_GET['code']) ? $_GET['code'] : null;
$returnedState = isset($_GET['state']) ? $_GET['state'] : null;
if ($code !== null) {
	// コールバック処理
	if (!hash_equals($_SESSION['oauth_state'], $returnedState)) {
		unset($_SESSION['oauth_state']);
		echo "Invalid state parameter.";
		exit();
	}

	$verifyUrl = 'https://bitarrow3.eplang.jp/bitarrow/?Login/bauth&status=' . urlencode($code);
	$response = file_get_contents($verifyUrl);
	if ($response === "OK") {
		echo "Authentication successful!<br>";
		echo 'Your identifier: ' . $code;
	} else {
		echo "Authentication failed: " . htmlspecialchars($response);
	}
	exit();
}

// 初回アクセス時の処理
$state = bin2hex(random_bytes(16));
$callbackUrl = (empty($_SERVER['HTTPS']) ? 'http://' : 'https://') . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] . '?' . 'state=' . $state;
$_SESSION['oauth_state'] = $state;
$authUrl = 'https://bitarrow3.eplang.jp/bitarrow/?Login/curStatus&otp=1&callback=' . urlencode($callbackUrl);
header('Location: ' . $authUrl);
exit();
?>