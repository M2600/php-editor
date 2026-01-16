
export class BAAuth {

	BALoginURL = 'https://bitarrow3.eplang.jp/bitarrow/?Login/form';

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
}

