
<?php
// 統一されたセッション初期化（ログインAPIでは認証チェックしない）
require_once(__DIR__ . '/session_init.php');

header('Content-Type: application/json');

$userRoot = posix_getpwuid(posix_getuid())["dir"];
$DATA_PATH = $userRoot . "/data/php_editor/user.csv";

$comments = array(
	"log in successful",
);

// comment line prefixes for CSV file
$IGNORE_LINE_HEADS = array(
	'#',
	'//',
	';',
);

function getRandomComment(){
	global $comments;
	$index = random_int(0, count($comments)-1);
	return $comments[$index];
}

function starts_with_any($str, $prefixes){
	foreach($prefixes as $p){
		if($p === "") continue;
		if(strncmp($str, $p, strlen($p)) === 0){
			return true;
		}
	}
	return false;
}

function getUserData($id){
	global $DATA_PATH, $IGNORE_LINE_HEADS;
	if(!is_readable($DATA_PATH)){
		return null;
	}
	$lines = file($DATA_PATH, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
	if($lines === false) return null;
	foreach($lines as $line){
		$line = trim($line);
		if($line === '') continue;
		if(starts_with_any($line, $IGNORE_LINE_HEADS)){
			continue;
		}
		$cols = str_getcsv($line);
		$userId   = isset($cols[0]) ? trim($cols[0]) : null;
		$userPw   = isset($cols[1]) ? trim($cols[1]) : null;
		$userRole = (isset($cols[2]) && $cols[2] !== '') ? trim($cols[2]) : 'user';
		if($userId !== null && $userId === $id){
			return array('id' => $userId, 'pw' => $userPw, 'role' => $userRole);
		}
	}
	return null;
}

function checkPassword($id, $pw){
	if(!is_string($id) || !is_string($pw)) return false;
	if($id === '' || $pw === '') return false;

	$userData = getUserData($id);
	if (!$userData || !isset($userData['pw'])) return false;

	// Currently we use plaintext comparison (user requested postponing hashing).
	// Use hash_equals to mitigate timing attacks even for plaintext values.
	return hash_equals((string)$userData['pw'], (string)$pw);
}

function json_error($msg, $code = 400){
	http_response_code($code);
	echo json_encode(array('status' => 'error', 'message' => $msg));
	exit;
}

if($_SERVER['REQUEST_METHOD'] === 'POST'){
	$raw = file_get_contents('php://input');
	$params = json_decode($raw, true);
	if(!is_array($params)){
		json_error('Invalid JSON', 400);
	}

	if(!array_key_exists('id', $params) || !array_key_exists('pw', $params)){
		json_error('Missing id or pw', 400);
	}

	$id = $params['id'];
	$pw = $params['pw'];

	$verified = checkPassword($id, $pw);
	if($verified){
		$userData = getUserData($id);

		$redirect = isset($_SESSION['redirect_after_login']) ? $_SESSION['redirect_after_login'] : '/index.php';

		session_regenerate_id(true);
		$_SESSION['id']             = $userData['id'];
		$_SESSION['role']           = $userData['role'];
		$_SESSION['class_admin_id'] = '_system_';
		$_SESSION['class_id']       = '_system_';

		if(isset($_SESSION['redirect_after_login'])){
			unset($_SESSION['redirect_after_login']);
		}

		http_response_code(200);
		echo json_encode(array(
			'status' => 'success',
			'message' => getRandomComment(),
			'redirect' => $redirect
		));
	} else {
		json_error('Invalid login', 401);
	}
} else {
	http_response_code(405);
	echo json_encode(array('status' => 'error', 'message' => 'Method not allowed'));
}

?>




