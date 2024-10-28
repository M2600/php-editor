<?php
session_start();
if(!isset($_SESSION["id"])){
    header("Location: /login.php");
}

require("templates/ace-editor.html");

?>
