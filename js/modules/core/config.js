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

// アプリケーション状態変数
export const APP_STATE = {
    USER_ID: "user_id",
    CURRENT_FILE: false,
    FILE_LIST: {},
    RUN_BROWSER_TAB: undefined,
    ACE_LIST: [],
    AI_CONFIG: { baseUrl: "", apiKey: "" , userCustomApi: false }
};
