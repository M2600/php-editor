<?php
session_start();


$code = isset($_GET['code']) ? $_GET['code'] : null;
$originalState = isset($_SESSION['oauth_state']) ? $_SESSION['oauth_state'] : "";
// stateは1度きりで使い捨て
unset($_SESSION['oauth_state']);
$returnedState = isset($_GET['state']) ? $_GET['state'] : null;
if ($code !== null) {
	// CSRF対策: stateパラメータの検証
	if (!hash_equals($originalState, $returnedState)) {
		echo "stateが一致しません。やり直してください。";
		echo "<br><a href='ba_auth.php'>再試行</a>";
		exit();
	}

	// codeが正しいかBitArrowサーバに問い合わせる
	$verifyUrl = 'https://bitarrow3.eplang.jp/bitarrow/?Login/bauth&status=' . urlencode($code);
	$response = file_get_contents($verifyUrl);
	if ($response !== "OK") {
		echo "認証に失敗しました。";
		echo "<br><a href='ba_auth.php'>再試行</a>";
		exit();
	}

	// verification成功の場合
	// 教員ログインの場合、codeに'teacher'が含まれる
	// 学生ログインの場合、codeに'user','class'が含まれる
	// (教員で代理ログインしていると'teacher','user','class'が全て含まれる)
	$data = json_decode($code, true);
	if ($data === null) {
		echo "認証情報の解析に失敗しました。";
		echo "<br><a href='ba_auth.php'>再試行</a>";
		exit();
	}
	if (isset($data['teacher'])) {
		// 教員としてログイン
		echo "教員として認証成功!<br>";
	}
	else if (isset($data['user']) && isset($data['class'])) {
		// 学生としてログイン
		echo "学生として認証成功!<br>";
	}
	else {
		// ログインしていない
		echo "BitArrowにログインしていないようです。ログイン後に再度認証してください。<br>";
		echo "<a href='https://bitarrow3.eplang.jp/bitarrow/?Login/form'>BitArrowログイン</a>";
		exit();
	}

	// 認証成功
	session_regenerate_id(true);
	echo 'ログイン情報: ' . $code . "<br>";

	exit();
}

// 初回アクセス時の処理
// CSRF対策のstateパラメータを生成
$state = bin2hex(random_bytes(16));
// stateをセッションに保存
$_SESSION['oauth_state'] = $state;
// stateを含んだリダイレクト用URLを生成
$callbackUrl = (empty($_SERVER['HTTPS']) ? 'http://' : 'https://') . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'] . '?' . 'state=' . $state;
$authUrl = 'https://bitarrow3.eplang.jp/bitarrow/?Login/curStatus&otp=1&callback=' . urlencode($callbackUrl);
header('Location: ' . $authUrl);
exit();
?>