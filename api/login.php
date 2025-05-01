
<?php
header('Content-Type: application/json');

//$iniConf = parse_ini_file("../config.ini");

$userRoot = posix_getpwuid(posix_getuid())["dir"];
$DATA_PATH = $userRoot . "/data/php_editor/user.csv";



ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', 1);


$comments = array(
	// "Welcome back! Your code runs perfectly… somewhere in an alternate universe.",
	// "^C^C^C... How do I exit vim?",
	// "^Z... Yes! I made it!!!",
	"log in successful",
);

function getRandomComment(){
	global $comments;
	$index = rand(0, count($comments)-1);
	return $comments[$index];
}


function checkPassword($id, $pw){
	if (empty($id) || empty($pw)) {
		return false;
	}
    global $DATA_PATH;
	$lines = file($DATA_PATH, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach($lines as $line){
        $line = trim($line);
        $line = explode(",", $line);
        if($line[0] == $id && $line[1] == $pw){
            return true;
        }
    }
	return false;
}


if($_SERVER["REQUEST_METHOD"] == "POST"){
	session_start();
    $params = json_decode(file_get_contents('php://input'), true);
	$id = $params["id"];
	$pw = $params["pw"];

	// if id and pw are correct
	$verified = checkPassword($id, $pw);

	if($verified){
		$_SESSION["id"] = $id;
		// redirect to main page
		echo json_encode(array("status" => "success", "message" => getRandomComment()));
	}
	else{
		// redirect to login page
		echo json_encode(array("status" => "error", "message" => "Invalid login"));
	}
}

?>




