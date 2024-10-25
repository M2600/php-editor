
<?php
$DATA_PATH = "../user.csv";



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
    
	$id = $_POST["id"];
	$pw = $_POST["pw"];

	// if id and pw are correct
	$verified = checkPassword($id, $pw);

	if($verified){
		$_SESSION["id"] = $id;
		// redirect to main page
		header("Location: /");
	}
	else{
		// redirect to login page
		header("Location: /login.php");
	}
}

?>




