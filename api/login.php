
<?php
// 統一されたセッション初期化（ログインAPIでは認証チェックしない）
require_once(__DIR__ . '/session_init.php');
require_once(__DIR__ . '/includes/database.php');

header('Content-Type: application/json');

//$iniConf = parse_ini_file("../config.ini");

$userRoot = posix_getpwuid(posix_getuid())["dir"];
$USER_DB_PATH = $userRoot . "/data/php_editor/user.sqlite3";

$db = new Database($USER_DB_PATH);

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


function checkPassword($user_id, $class_admin_id, $class_id, $pw){
	global $db;
	// require string types and non-empty (allow "0")
	if(!is_string($user_id) || !is_string($pw)) return false;
	if($user_id === '' || $class_admin_id === '' || $class_id === '' || $pw === '') return false;

	$userData = $db->getUser($user_id, $class_admin_id, $class_id);
	if (!$userData || !isset($userData['password'])) return false;

	$stored = $userData['password'];

	// Currently we use plaintext comparison (user requested postponing hashing).
	// Use hash_equals to mitigate timing attacks even for plaintext values.
	return hash_equals((string)$stored, (string)$pw);
}

function json_error($msg, $code = 400){
	http_response_code($code);
	echo json_encode(array('status' => 'error', 'message' => $msg));
	exit;
}

if($_SERVER['REQUEST_METHOD'] === 'POST'){
	// セッションは既にsession_init_no_auth.phpで開始済み

	$raw = file_get_contents('php://input');
	$params = json_decode($raw, true);
	if(!is_array($params)){
		json_error('Invalid JSON', 400);
	}

	if(!array_key_exists('id', $params)) {
		json_error('Missing id', 400);
	}
	if(!array_key_exists('pw', $params)) {
		json_error('Missing pw', 400);
	}
	
	$id = $params['id'];
	$class_admin_id = $params['class_admin_id'] ?? '_system_';
	$class_id = $params['class_id'] ?? '_system_';
	$pw = $params['pw'];

	$verified = checkPassword($id, $class_admin_id, $class_id, $pw);
	if($verified){
		$userData = $db->getUser($id, $class_admin_id, $class_id);
		
		// リダイレクト先を取得（session_regenerate_id前に取得する必要がある）
		$redirect = isset($_SESSION['redirect_after_login']) ? $_SESSION['redirect_after_login'] : '/index.php';
		
		// regenerate session id to prevent fixation
		session_regenerate_id(true);
		$_SESSION['id'] = $userData['user_id'];
		$_SESSION['role'] = $userData['role'];
		$_SESSION['class_admin_id'] = $userData['class_admin_id'];
		$_SESSION['class_id'] = $userData['class_id'];

		// 使用後は削除
		if(isset($_SESSION['redirect_after_login'])){
			unset($_SESSION['redirect_after_login']);
		}

		// デバッグログ
		//error_log("Login successful. Redirect to: " . $redirect);

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




