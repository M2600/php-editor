
<?php
header('Content-Type: application/json');

//$iniConf = parse_ini_file("../config.ini");

$userRoot = posix_getpwuid(posix_getuid())["dir"];
$DATA_PATH = $userRoot . "/data/php_editor/user.csv";


// Session cookie settings: enable secure only when HTTPS is used
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', $secure ? '1' : '0');


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
		// parse CSV safely (handles quoted fields)
		$cols = str_getcsv($line);
		$userId = isset($cols[0]) ? trim($cols[0]) : null;
		$userPw = isset($cols[1]) ? trim($cols[1]) : null;
		$userRole = (isset($cols[2]) && $cols[2] !== '') ? trim($cols[2]) : 'user';
		if($userId !== null && $userId === $id){
			return array('id' => $userId, 'pw' => $userPw, 'role' => $userRole);
		}
	}
	return null;
}

function checkPassword($id, $pw){
	// require string types and non-empty (allow "0")
	if(!is_string($id) || !is_string($pw)) return false;
	if($id === '' || $pw === '') return false;

	$userData = getUserData($id);
	if (!$userData || !isset($userData['pw'])) return false;

	$stored = $userData['pw'];

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
	session_start();

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
		
		// リダイレクト先を取得（session_regenerate_id前に取得する必要がある）
		$redirect = isset($_SESSION['redirect_after_login']) ? $_SESSION['redirect_after_login'] : '/index.php';
		
		// regenerate session id to prevent fixation
		session_regenerate_id(true);
		$_SESSION['id'] = $userData['id'];
		$_SESSION['role'] = $userData['role'];

		// 使用後は削除
		if(isset($_SESSION['redirect_after_login'])){
			unset($_SESSION['redirect_after_login']);
		}

		// デバッグログ
		error_log("Login successful. Redirect to: " . $redirect);

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




