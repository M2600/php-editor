<?php

class Database {
	private $pdo;
	public function __construct($dbPath) {
		$this->pdo = new PDO('sqlite:' . $dbPath);
		$this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	}
	public function getUser($user_id, $class_admin_id, $class_id){
		$stmt = $this->pdo->prepare('SELECT * FROM users WHERE user_id = :user_id AND class_admin_id = :class_admin_id AND class_id = :class_id');
		$stmt->bindValue(':user_id', $user_id, PDO::PARAM_STR);
		$stmt->bindValue(':class_admin_id', $class_admin_id, PDO::PARAM_STR);
		$stmt->bindValue(':class_id', $class_id, PDO::PARAM_STR);
		$stmt->execute();
		$records =  $stmt->fetch(PDO::FETCH_ASSOC);
		return $records;
	}

	
}