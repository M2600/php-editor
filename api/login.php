
<?php
header('Content-Type: application/json');

$iniConf = parse_ini_file("../config.ini");

$DATA_PATH = $iniConf["user_data"];



ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', 1);


function checkPassword($id, $pw){
    global $DATA_PATH;
	$lines = file($DATA_PATH);
    foreach($lines as $line){
        $line = trim($line);
        $line = explode(",", $line);
        if($line[0] == $id && $line[1] == $pw){
            return true;
        }
    }
}


if($_SERVER["REQUEST_METHOD"] == "POST"){
	session_start();
    $params = json_decode(file_get_contents('php://input'), true);
	error_log(print_r($params, true));
	$id = $params["id"];
	$pw = $params["pw"];

	// if id and pw are correct
	$verified = checkPassword($id, $pw);

	if($verified){
		$_SESSION["id"] = $id;
		// redirect to main page
		echo json_encode(array("status" => "success"));
	}
	else{
		// redirect to login page
		echo json_encode(array("status" => "error", "message" => "Invalid login"));
	}
}

?>




