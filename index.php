<link rel="stylesheet" href="css/index.css">

<?php
session_start();
if(!isset($_SESSION["id"])){
    header("Location: /login.php");
}

require("editor.php");

echo "Hello World!";

?>
