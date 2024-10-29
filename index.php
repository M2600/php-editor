<link rel="stylesheet" href="css/index.css">

<?php
if(!isset($_SESSION)){
    session_start();
}
if(!isset($_SESSION["id"])){
    header("Location: /login.php");
}

require("editor.php");


?>
