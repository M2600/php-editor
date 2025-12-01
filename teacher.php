<?php

require_once(__DIR__ . '/api/session_init.php');

requireLogin(['teacher', 'admin']);

echo "Teacher page content goes here.";
