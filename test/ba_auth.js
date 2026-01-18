
export class BAAuth {

	constructor() {
		
	}

	/**
	 * サーバからstateパラメータを取得する
	 * @returns {string} stateパラメータ
	 */
	async #generateState() {
		const endpoint = 'ba_auth_api.php';
		let state = null;
		await fetch(endpoint)
		.then(response => response.json())
		.then(data => {
			state = data.state;
		});
		return state;
	}


	/**
	 * 
	 * @param {string} state CSRF対策用のstateパラメータ
	 * @returns {string} コールバックURL
	 */
	getCallbackURL(state) {
		let currentURL = null;
		if (window.location.href.indexOf('?') === -1) {
			currentURL = new URL(window.location.href);
		}else {
			const urlWithoutParams = window.location.href.substring(0, window.location.href.indexOf('?'));
			currentURL = new URL(urlWithoutParams);
		}
		currentURL.searchParams.set('state', state);
		let callbackUrl = currentURL.toString();
		return callbackUrl;
	}

	async getAuthURL() {
		// 末尾?必須 stateをいれるのであれば大丈夫
		// curStatusのあとに=が入っていると動作しないので手動で記述。 NG: curStatus=&otp=1, OK: curStatus&otp=1
		let BAAuthURL = 'https://bitarrow3.eplang.jp/bitarrow/?Login/curStatus&otp=1';
		const state = await this.#generateState();
		const callbackURL = this.getCallbackURL(state);
		BAAuthURL += `&callback=${encodeURIComponent(callbackURL)}`;
		return BAAuthURL.toString();
	}

	async authenticate() {
		const authURL = await this.getAuthURL();
		window.location.href = authURL;
	}


	async requestToken() {
		const endpoint = 'ba_auth_api.php';
		let response = null;
		await fetch(endpoint, {
			method: 'POST',
			body: JSON.stringify({
				state: new URL(window.location.href).searchParams.get('state'),
				code: new URL(window.location.href).searchParams.get('code'),
			})
		})
		.then(response => response.json())
		.then(data => {
			response = data;
		})
		.catch(error => {
			console.error('Error during token request:', error);
		});
		
		return response;
	}

	/**
	 * BitArrowにログイン状態を問い合わせる
	 * ログインチェックのみなのでotpを使った二段階認証は行わない
	 * 必ず2段階認証を含む認証とセットで使うこと
	 * @param {HTMLElement} iframe 
	 */
	async BALoginCheck() {
		const baStatusURL = "https://bitarrow3.eplang.jp/bitarrow/?Login/curStatus";
		const response = await fetch(baStatusURL, {
			method: 'GET',
			credentials: 'include'
		});
		const data = await response.json();
		const isStudent = data.user && data.class;
		const isTeacher = data.teacher;
		return isStudent || isTeacher;
	}

	/**
	 * This didn't work because of cross-origin restrictions.
	 * @param {Number} timeout ms default 300000ms
	 * @param {Number} interval ms default 2000ms
	 * @returns 
	 */
	async __waitUntilBALogin(timeout = 300000, interval = 2000) {
		const startTime = Date.now();
		return new Promise((resolve, reject) => {
			const checkLogin = async () => {
				const loggedIn = await this.BALoginCheck();
				if (loggedIn) {
					resolve(true);
				} else if (Date.now() - startTime >= timeout) {
					reject(new Error('Timeout waiting for BitArrow login'));
				} else {
					setTimeout(checkLogin, interval);
				}
			};
			checkLogin();
		});
	}

	async openBALogin() {
		const BALoginURL = 'https://bitarrow3.eplang.jp/bitarrow/?Login/form';
		const popup = window.open(BALoginURL, 'BitArrow Login', 'width=600,height=600');
		if (!popup || popup === null) {
			alert('Popup blocked. Please allow popups for this site.');
			// ポップアップが開かれるまで待機
			await new Promise((resolve) => {
				const checkPopup = setInterval(() => {
					if (popup && !popup.closed) {
						console.log('Popup opened.');
						clearInterval(checkPopup);
						resolve();
					}
				}, 500);
			});
		}
		await new Promise((resolve, reject) => {
			const popupCheckInterval = setInterval(async () => {
				if (popup.closed) {
					console.log('Popup closed.');
					clearInterval(popupCheckInterval);
					resolve();
				}
			}, 1000);
		});
	}
}

