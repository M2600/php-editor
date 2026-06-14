<?php

class BAAuth {
	public function generateState() {
		return bin2hex(random_bytes(16));
	}

	public function verifyCode(string $code) {
		$verifyUrl = 'https://bitarrow3.eplang.jp/bitarrow/?Login/bauth&status=' . urlencode($code);
		$response = @file_get_contents($verifyUrl);
		if ($response === false) {
			return false;
		}
		return $response === "OK";
	}

	public function verifyState(string $originalState, string $returnedState) {
		return hash_equals($originalState, $returnedState);
	}

	public function isLoggedIn(string $code) {
		$data = json_decode($code, true);
		if ($data === null || !is_array($data)) {
			return false;
		}
		$isStudent = isset($data['user']) && isset($data['class']);
		$isTeacher = isset($data['teacher']);
		return ($isStudent || $isTeacher);
	}
}
