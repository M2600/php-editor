/**
 * Cookie管理ユーティリティ
 */

/**
 * Cookieを設定する
 * @param {string} name - Cookie名
 * @param {string} value - Cookie値
 * @param {number} days - 有効期限（日数）
 */
export function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;SameSite=Lax";
}

/**
 * Cookieを取得する
 * @param {string} name - Cookie名
 * @returns {string|null} - Cookie値、存在しない場合はnull
 */
export function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
}

/**
 * Cookieを削除する
 * @param {string} name - Cookie名
 */
export function deleteCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
}

/**
 * AI設定をCookieに保存する
 * @param {string} apiUrl - カスタムAPIのURL
 * @param {string} apiKey - APIキー
 */
export function saveAIConfig(apiUrl, apiKey) {
    if (apiUrl) {
        setCookie('ai_custom_url', apiUrl, 365);
    } else {
        deleteCookie('ai_custom_url');
    }
    
    if (apiKey) {
        setCookie('ai_custom_key', apiKey, 365);
    } else {
        deleteCookie('ai_custom_key');
    }
}

/**
 * AI設定をCookieから読み込む
 * @returns {{apiUrl: string|null, apiKey: string|null}}
 */
export function loadAIConfig() {
    return {
        apiUrl: getCookie('ai_custom_url'),
        apiKey: getCookie('ai_custom_key')
    };
}

/**
 * AI設定をクリアする
 */
export function clearAIConfig() {
    deleteCookie('ai_custom_url');
    deleteCookie('ai_custom_key');
}
