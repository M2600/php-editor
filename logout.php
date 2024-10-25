<?php
session_start();
if(!isset($_SESSION["id"])){
    header("Location: /login.php");
}

$_SESSION = array();
session_destroy();
header("Location: /login.php");

?>