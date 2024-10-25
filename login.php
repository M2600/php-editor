
<link rel="stylesheet" href="css/login.css">

<?php




if($_SERVER["REQUEST_METHOD"] == "GET"){
	$html = '
		<div id="login-container">
			<div id="login-form">
				<form method="POST" action="api/login.php">
					<div id="id-block">
						<input class="login-id" name="id" type="text" placeholder="ID" required>
					</div>
					<div id="password-block">
						<input class="login-pw" name="pw" type="password" placeholder="パスワード" required>
					</div>
					<input class="login-submit"  type="submit" value="ログイン">
				</form>
			</div>
		</div>
	';
	echo $html;
}




?>
