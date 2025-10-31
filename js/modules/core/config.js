/**
 * ユーザー設定とテーマ管理
 */

export class UserConfig {
    constructor(localStorageKey="php-editor-user-config"){
        this.config = {};
        this.localStorageKey = localStorageKey;
        this.load();
    }

    load(){
        let json = localStorage.getItem(this.localStorageKey);
        if(json == null){
            return {};
        }
        try{
            this.config = JSON.parse(json);
        }
        catch(e){
            console.error("Error loading user config: ", e);
            this.config = {};
        }
    }

    save(){
        let json = JSON.stringify(this.config);
        localStorage.setItem(this.localStorageKey, json);
    }

    get(key) {
        this.load();
        let value = this.config[key];
        if(value == undefined){
            return null;
        }
        return value;
    }

    set(key, value) {
        this.config[key] = value;
        this.save();
    }

    remove(key) {
        delete this.config[key];
        this.save();
    }
}

export function changeTheme(theme, currentFile, editor, userConfig, DEBUG){
    DEBUG && console.log("Theme: ", theme);
    if(theme == "dark"){
        if(currentFile){
            currentFile.aceObj.editor.setTheme("ace/theme/monokai");
        }
        document.body.setAttribute("theme", "dark");
        editor.THEME = "dark";
    }
    else if (theme == "halloween"){
        if(currentFile){
            currentFile.aceObj.editor.setTheme("ace/theme/vibrant_ink");
        }
        document.body.setAttribute("theme", "halloween");
        editor.THEME = "halloween";
    }
    else{
        if(currentFile){
            currentFile.aceObj.editor.setTheme("ace/theme/chrome");
        }
        document.body.setAttribute("theme", "light");
        editor.THEME = "light";
    }
    userConfig.set("theme", theme);
}

// アプリケーション設定定数
export const CONFIG = {
    DEBUG: true,
    FILE_PAGE_BASE_URL: "/user-programs/",
    MAX_CHAT_HISTORY: 6,
    CHAT_STORAGE_KEY: "php-editor-chat-history",
    SESSION_PULSE_INTERVAL: 300000, // セッション維持のためのパルス送信間隔（ミリ秒）
    EXPLORER_AUTO_RELOAD_INTERVAL: 3600000, // エクスプローラー自動リロード間隔（ミリ秒、0で無効）
    RELOAD_EXPLORER_AFTER_EXECUTION: true, // プログラム実行後にエクスプローラーをリロードするか
    RELOAD_EXPLORER_EXECUTION_DELAY: 1500, // 実行後のリロード遅延時間（ミリ秒）
    EXT_LANG: [
        {
            ext: ["html", "htm"],
            lang: "html"
        },
        {
            ext: ["js"],
            lang: "javascript"
        },
        {
            ext: ["txt"],
            lang: "text"
        },
        {
            ext: ["md"],
            lang: "markdown"
        }
    ]
};

// AI Chat
export const AI_CONFIG = {
    TOOLS_MAX_COUNT: 20,
}

// アプリケーション状態変数
export const APP_STATE = {
    USER_ID: "user_id",
    CURRENT_FILE: false,
    FILE_LIST: {},
    RUN_BROWSER_TAB: undefined,
    ACE_LIST: [],
    AI_CONFIG: { baseUrl: "", apiKey: "" , userCustomApi: false },
    RUN_MODE: 'WEB_MODE'  // 'API_MODE': API開発モード(デバッグ実行), 'WEB_MODE': Webページモード(別タブ実行)
};
