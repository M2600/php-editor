
export class BAAuth {

	BALoginURL = 'https://bitarrow3.eplang.jp/bitarrow/?Login/form';

	constructor() {
		this.originalState = document.cookie.split('; ').find(row => row.startsWith('ba_oauth_state='))?.split('=')[1] || null;
	}

	#generateState() {
		const array = crypto.getRandomValues(new Uint32Array(8));
		const state = BigInt(array.join('')).toString(36);
		this.originalState = state;
		// cookieに保存
		document.cookie = `ba_oauth_state=${state}; path=/; SameSite=Lax`;
		return state;
	}
	

	/**
	 * 
	 * @param {string} state CSRF対策用のstateパラメータ
	 * @returns {string} コールバックURL
	 */
	getCallbackURL(state) {
		const currentURL = new URL(window.location.href);
		currentURL.searchParams.set('state', state);
		let callbackUrl = currentURL.toString();
		return callbackUrl;
	}

	getAuthURL() {
		// 末尾?必須 stateをいれるのであれば大丈夫
		// curStatusのあとに=が入っていると動作しないので手動で記述。 NG: curStatus=&otp=1, OK: curStatus&otp=1
		let BAAuthURL = 'https://bitarrow3.eplang.jp/bitarrow/?Login/curStatus&otp=1';
		const state = this.#generateState();
		const callbackURL = this.getCallbackURL(state);
		BAAuthURL += `&callback=${encodeURIComponent(callbackURL)}`;
		return BAAuthURL.toString();
	}

	authenticate() {
		const authURL = this.getAuthURL();
		window.location.href = authURL;
	}

	validateState() {
		const currentURL = new URL(window.location.href);
		const returnedState = currentURL.searchParams.get('state');
		return returnedState === this.originalState;
	}

	async requestToken() {
		const endpoint = 'ba_auth_api.php';
		await fetch(endpoint, {
			method: 'POST',
			body: JSON.stringify({
				original_state: this.originalState,
				state: new URL(window.location.href).searchParams.get('state'),
				code: new URL(window.location.href).searchParams.get('code'),
			})
		})
		.then(response => response.json())
		.then(data => {
			if (data.status === 'success') {
				console.log('Authentication successful');
				// トークン取得成功後の処理をここに追加
				console.log('Access Identifier:', data.identifier);
			}
		})
	}
}

