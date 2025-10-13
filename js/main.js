/**
 * メインアプリケーション統合モジュール
 */

// Core modules
import { UserConfig, changeTheme, CONFIG, APP_STATE } from './modules/core/config.js';
import { loadExplorer, saveSortSettings } from './modules/core/file-manager.js';
import { startSessionPulse } from './modules/core/pulse.js';

// UI modules
import { MEditor } from '../MEditor/MEditor.js';

import { 
    renameFileDialog, 
    moveFileDialog, 
    deleteFileDialog,
    newFileDialog,
    newDirDialog,
    renameDirDialog,
    deleteDirDialog,
    fileUploadDialog
} from './modules/ui/dialogs.js';

// Editor modules
import { aceKeybinds, openFile, pushSaveButton, openInOtherWindow, showQRCode } from './modules/editor/ace-editor.js';

// AI modules
import { 
    AIMerge,
    ChatHistoryManager,
    restoreChatHistoryToUI,
    loadModelList,
    setupChatClearHistory,
    sendAIMessage
} from './modules/ai/ai-chat.js';

// Utils
import { hideAllPreviewer, getParentDir } from './modules/utils/helpers.js';
import { api, Path } from './modules/utils/api.js';
import { 
    saveFile, 
    duplicateFile,
    runPhp,
    runPhpCgi,
    phpSyntaxCheck
} from './modules/core/file-manager.js';
import { saveAIConfig, loadAIConfig } from './modules/utils/cookie.js';


// Export main instances for global access
export const userConfig = new UserConfig();
export const editor = new MEditor();
export const chatHistoryManager = new ChatHistoryManager(CONFIG.CHAT_STORAGE_KEY, CONFIG.DEBUG);

// Global variables
let mConsole;
let dictMenu;
let chat;
let modelSelect;
let fetchAIChat;

async function main(){
    // localStorageから実行モードを復元
    const savedRunMode = localStorage.getItem('runAsNewTab');
    if (savedRunMode !== null) {
        APP_STATE.RUN_AS_NEW_TAB = savedRunMode === 'true';
        console.log("Run mode restored from localStorage:", APP_STATE.RUN_AS_NEW_TAB);
    }

    // AI APIをインポート
    try {
        // 動的import（ESM対応ブラウザ用）
        fetchAIChat = (await import('./modules/ai/ai-api.js')).fetchAIChat;
    } catch(e) {
        console.error('ai-api.jsの読み込みに失敗:', e);
    }

    await editor.editor("main");
    editor.DEBUG = CONFIG.DEBUG;

    editor.setChangeThemeAction((theme) => {
        CONFIG.DEBUG && console.log("Theme: ", theme);
        if(APP_STATE.CURRENT_FILE && APP_STATE.CURRENT_FILE.aceObj != undefined){
            if(theme == "dark"){
                APP_STATE.CURRENT_FILE.aceObj.editor.setTheme("ace/theme/monokai");
            }
            else{
                APP_STATE.CURRENT_FILE.aceObj.editor.setTheme("ace/theme/chrome");
            }
        }
        userConfig.set("theme", theme);
    });

    editor.page.header.header.menu.items.push(editor.generateButton(
        editor.page.header.header.menu,
        "logout",
        (e) => {window.location.href = "/logout.php";},
        "ログアウト",
    ));

    // panel toggle buttonｓ
    let rightPanelToggle = editor.generateToggleButton(
        null,
        "◨",
        "□",
        editor.isPanelVisible('right'),
        (e) => {
            console.log("toggle right panel");
            if(e){
                editor.showPanel('right');
            }else{
                editor.hidePanel('right');
            }
            // パネル切り替え時にhideAllPreviewer()を呼ぶと開いているAceエディタも非表示になるため削除
        },
        "右パネルの表示/非表示"
    );
    editor.page.header.header.menu.items.push(rightPanelToggle);
    editor.page.header.header.menu.element.prepend(rightPanelToggle.element);

    let bottomPanelToggle = editor.generateToggleButton(
        null,
        "⬓",
        "□",
        editor.isPanelVisible('bottom'),
        (e) => {
            console.log("toggle bottom panel");
            if(e){
                editor.showPanel('bottom');
            }else{
                editor.hidePanel('bottom');
            }
        },
        "下パネルの表示/非表示"
    );
    editor.page.header.header.menu.items.push(bottomPanelToggle);
    editor.page.header.header.menu.element.prepend(bottomPanelToggle.element);

    let leftPanelToggle = editor.generateToggleButton(
        null,
        "◧",
        "□",
        editor.isPanelVisible('left'),
        (e) => {
            console.log("toggle left panel");
            if(e){
                editor.showPanel('left');
            }else{
                editor.hidePanel('left');
                // パネル切り替え時にhideAllPreviewer()を呼ぶと開いているAceエディタも非表示になるため削除
            }
        },
        "左パネルの表示/非表示"
    );
    editor.page.header.header.menu.items.push(leftPanelToggle);
    editor.page.header.header.menu.element.prepend(leftPanelToggle.element);

    // Register toggle buttons with MEditor for automatic state updates
    editor.registerPanelToggleButton('left', leftPanelToggle);
    editor.registerPanelToggleButton('right', rightPanelToggle);
    editor.registerPanelToggleButton('bottom', bottomPanelToggle);

    

    mConsole = editor.console(editor.page.main.mid.container.bottom);

    const editorEditor = editor.workPlace(editor.page.main.mid.container.main);
    editor.wp = editorEditor;

    // Save button
    const saveButton = editor.generateButton(
        editorEditor.menu.left,
        "🖫保存",  // 保存アイコン
        (e) => {
            if (!APP_STATE.CURRENT_FILE) {
                console.warn("No file is currently open");
                return;
            }
            console.log("Save: " + APP_STATE.CURRENT_FILE.path);
            pushSaveButton(APP_STATE.CURRENT_FILE, (path, content) => 
                saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE)
            );
        },
        "ファイルを保存してPHP構文チェックを実行"
    );
    editorEditor.menu.left.items.push(saveButton);
    
    // Run button (統合版: RUN_AS_NEW_TABに応じて動作を変更)
    const runButton = editor.generateButton(
        editorEditor.menu.left,
        "▶実行",  // 実行アイコン
        (e) => {
            if (!APP_STATE.CURRENT_FILE) {
                console.warn("No file is currently open");
                return;
            }
            console.log("Run: " + APP_STATE.CURRENT_FILE.path);
            // dictMenuからGETパラメータを取得
            const getParams = dictMenu ? dictMenu.getItemsAsObject() : {};
            // dictMenuからPOSTパラメータを取得
            const postParams = postDictMenu ? postDictMenu.getItemsAsObject() : {};
            // POST リクエストするかどうか
            const method = postCheck.getState() ? "POST" : "GET";
            // コンテンツタイプ
            const contentType = jsonCheck.getState() ? "application/json" : "application/x-www-form-urlencoded";
            
            if (APP_STATE.RUN_AS_NEW_TAB) {
                // Webページモード: 別タブで実行
                console.log("Run as new tab (Web page mode)");
                APP_STATE.RUN_BROWSER_TAB = openInOtherWindow(
                    APP_STATE.CURRENT_FILE, 
                    (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
                    APP_STATE.RUN_BROWSER_TAB,
                    CONFIG.FILE_PAGE_BASE_URL,
                    APP_STATE.USER_ID,
                    getParams
                );
            } else {
                // デバッグモード: コンソールに出力
                console.log("Run in debug mode with GET params:", getParams);
                
                // GETパラメータをlocalStorageに保存
                try {
                    localStorage.setItem('getParams', JSON.stringify(getParams));
                } catch (err) {
                    console.error('Failed to save GET parameters:', err);
                }
                
                // POSTパラメータをlocalStorageに保存
                try {
                    localStorage.setItem('postParams', JSON.stringify(postParams));
                } catch (err) {
                    console.error('Failed to save POST parameters:', err);
                }
                
                // POST設定（POSTチェックボックス、JSONチェックボックス）を保存
                try {
                    localStorage.setItem('postCheckState', postCheck.getState().toString());
                    localStorage.setItem('jsonCheckState', jsonCheck.getState().toString());
                } catch (err) {
                    console.error('Failed to save POST settings:', err);
                }
                
                // Show console automatically when running program
                if (mConsole && typeof mConsole.show === 'function') {
                    mConsole.show();
                }
                
                // CGI実行（GETパラメータ付き）
                runPhpCgi(
                    APP_STATE.CURRENT_FILE.path,
                    getParams,
                    api,
                    APP_STATE.CURRENT_FILE,
                    (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
                    mConsole,
                    {
                        method: method,
                        POSTParams: postParams,
                        contentType: contentType,
                    }
                );
            }
        },
        "Webページモード: 別タブで実行 | デバッグモード: コンソール出力"
    );
    editorEditor.menu.left.items.push(runButton);

    // Run mode toggle
    editorEditor.menu.left.items.push(editor.generateCheckbox(
        editorEditor.menu.left,
        "Webページモード",
        APP_STATE.RUN_AS_NEW_TAB,
        (checked) => {
            APP_STATE.RUN_AS_NEW_TAB = checked;
            console.log("Run mode changed - RUN_AS_NEW_TAB:", APP_STATE.RUN_AS_NEW_TAB);
            console.log(checked ? "→ Webページモード (別タブで実行)" : "→ デバッグモード (コンソール出力)");
            
            // localStorageに状態を保存
            try {
                localStorage.setItem('runAsNewTab', checked.toString());
                console.log("Run mode saved to localStorage:", checked);
            } catch (err) {
                console.error('Failed to save run mode:', err);
            }
        },
        "チェックON: Webページとして別タブで実行 | チェックOFF: デバッグモードでコンソール出力"
    ));

    // QR Code button
    const qrButton = editor.generateButton(
        editorEditor.menu.left,
        "⊞QR",  // QRコードアイコン
        (e) => {
            if (!APP_STATE.CURRENT_FILE) {
                console.warn("No file is currently open");
                return;
            }
            console.log("QR Code: " + APP_STATE.CURRENT_FILE.path);
            // dictMenuからGETパラメータを取得
            const getParams = dictMenu ? dictMenu.getItemsAsObject() : {};
            showQRCode(
                APP_STATE.CURRENT_FILE,
                (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
                editor,
                CONFIG.FILE_PAGE_BASE_URL,
                APP_STATE.USER_ID,
                mConsole,
                CONFIG.DEBUG,
                getParams
            );
        },
        "実行URLのQRコードを表示します"
    );
    editorEditor.menu.left.items.push(qrButton);

    // 初期状態でボタンを無効化
    saveButton.setEnabled(false);
    runButton.setEnabled(false);
    qrButton.setEnabled(false);

    // ファイルが開かれたときにボタンを有効化する関数
    function updateFileActionButtons() {
        const hasFile = APP_STATE.CURRENT_FILE !== false && APP_STATE.CURRENT_FILE !== null;
        saveButton.setEnabled(hasFile);
        runButton.setEnabled(hasFile);
        qrButton.setEnabled(hasFile);
    }

    // ファイル操作用のボタンを参照として保持
    APP_STATE.FILE_ACTION_BUTTONS = {
        save: saveButton,
        run: runButton,
        qr: qrButton,
        update: updateFileActionButtons
    };

    // Debug button
    // editorEditor.menu.right.items.push(editor.generateButton(
    //     editorEditor.menu.right,
    //     "Debug",
    //     (e) => {
    //         console.log("Debug with GET params");
    //         // dictMenuからGETパラメータを取得
    //         const getParams = dictMenu ? dictMenu.getItemsAsObject() : {};
    //         console.log("GET Parameters:", getParams);
            
    //         // GETパラメータをlocalStorageに保存
    //         try {
    //             localStorage.setItem('getParams', JSON.stringify(getParams));
    //         } catch (err) {
    //             console.error('Failed to save GET parameters:', err);
    //         }
            
    //         // CGI実行（GETパラメータ付き）
    //         runPhpCgi(
    //             APP_STATE.CURRENT_FILE.path,
    //             getParams,
    //             api,
    //             APP_STATE.CURRENT_FILE,
    //             (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
    //             mConsole
    //         );
    //     },
    // ));


    // Tab, ポップアップウィンドウのサンプル
    // editorEditor.menu.right.items.push(editor.generateButton(
    //     editorEditor.menu.right,
    //     "test",
    //     (e) => {
    //         let tabContainer = editor.tab();
    //         let dictMenu = editor.createDictMenu();
    //         dictMenu.setTitle("デバッグ時に送信するGETパラメータ");
    //         dictMenu.addButton();
    //         dictMenu.addItem({'':''});
    //         let tab1 = tabContainer.createTab("GETパラメータ");
    //         tab1.setContent(dictMenu);
    //         let tab2 = tabContainer.createTab("test");
    //         tab2.setContent("<p>Tab 2 content</p>");
    //         let tab3 = tabContainer.createTab("test3");
    //         tab3.setContent("<p>Tab 3 content. long long long long long long long long long long long long long long</p>");
    //         tabContainer.activateTab(tab1.id);
    //         let popup = editor.popupWindow(
    //             "デバッグメニュー", 
    //             tabContainer.element, 
    //             {width: "40em",height: "30em"},
    //         );

    //     }
    // ));

    const explorer = editor.createExplorer(editor.page.main.left, {
        title: "エクスプローラー",
    });

    // Explorer event handlers
    explorer.setFileClickAction(async function (file) {
        if(APP_STATE.CURRENT_FILE && !APP_STATE.CURRENT_FILE.readonly && APP_STATE.CURRENT_FILE.changed){
            await saveFile(
                APP_STATE.CURRENT_FILE.path, 
                APP_STATE.CURRENT_FILE.aceObj.editor.getValue(),
                api,
                APP_STATE.CURRENT_FILE,
                mConsole,
                CONFIG.DEBUG,
                phpSyntaxCheck,
                editor,
                APP_STATE
            );
        }
        APP_STATE.CURRENT_FILE = await openFile(
            file,
            APP_STATE.ACE_LIST,
            editor,
            mConsole,
            CONFIG.EXT_LANG,
            CONFIG.DEBUG,
            (ace) => aceKeybinds(ace, 
                () => pushSaveButton(APP_STATE.CURRENT_FILE, (path, content) => 
                    saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE)
                ),
                () => {
                    const getParams = dictMenu ? dictMenu.getItemsAsObject() : {};
                    APP_STATE.RUN_BROWSER_TAB = openInOtherWindow(
                        APP_STATE.CURRENT_FILE, 
                        (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
                        APP_STATE.RUN_BROWSER_TAB,
                        CONFIG.FILE_PAGE_BASE_URL,
                        APP_STATE.USER_ID,
                        getParams
                    );
                }
            ),
            api
        );
        
        // ファイルが開かれたらボタンを有効化
        if (APP_STATE.FILE_ACTION_BUTTONS) {
            APP_STATE.FILE_ACTION_BUTTONS.update();
        }
    });

    explorer.setDirClickAction(async function (dir) {
        console.log("re: dir click: ", dir);
        if(dir.name == "../" || dir.name == ".."){
            await loadExplorer(getParentDir(editor.BASE_DIR), api, APP_STATE, editor);
        }
        else{
            await loadExplorer(dir.path, api, APP_STATE, editor);
        }
    });

    explorer.setNewFileClickAction((dir) => {
        newFileDialog(
            dir, 
            editor, 
            api, 
            mConsole, 
            APP_STATE.CURRENT_FILE,
            (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
            CONFIG.DEBUG
        );
    });

    explorer.setNewDirClickAction((dir) => {
        newDirDialog(dir, editor, api, mConsole, CONFIG.DEBUG);
    });

    explorer.setRenameClickAction((file) => {
        renameFileDialog(file.path, editor, api, mConsole, CONFIG.DEBUG);
    });

    explorer.setMoveClickAction((file) => {
        moveFileDialog(file, editor, api, mConsole, APP_STATE.FILE_LIST);
    });

    explorer.setDuplicateClickAction((file) => {
        console.log("re: Duplicate: ", file);
        duplicateFile(file.path, api, mConsole).then((newPath) => {
            loadExplorer(editor.BASE_DIR, api, APP_STATE, editor).then(() => {
                APP_STATE.CURRENT_FILE = false;
                // ファイルが閉じられたらボタンを無効化
                if (APP_STATE.FILE_ACTION_BUTTONS) {
                    APP_STATE.FILE_ACTION_BUTTONS.update();
                }
                // loadFile(newPath); // 新しいファイルを開く場合
            });
        });
    });

    explorer.setDeleteClickAction((file) => {
        console.log("re: Delete: ", file);
        deleteFileDialog(file.path, editor, api, mConsole, APP_STATE.CURRENT_FILE, CONFIG.DEBUG);
    });

    explorer.setRenameDirClickAction((dir) => {
        console.log("re: rename dir: ", dir);
        renameDirDialog(dir.path, editor, api, mConsole, CONFIG.DEBUG);
    });

    explorer.setDeleteDirClickAction((dir) => {
        console.log("re: delete dir: ", dir);
        deleteDirDialog(dir.path, editor, api, mConsole, CONFIG.DEBUG);
    });

    explorer.setUploadClickAction((dir) => {
        console.log("re: upload: ", dir);
        fileUploadDialog(dir, editor, api, mConsole, CONFIG.DEBUG);
    });

    explorer.setSortClickAction((sortBy, order) => {
        console.log("re: sort: ", sortBy, order);
        saveSortSettings(sortBy, order);
        loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });

    await loadExplorer("/", api, APP_STATE, editor);

    // Right panel components
    let tabContainer = editor.tab(editor.page.main.right);

    let dictMenuTab = tabContainer.createTab("デバッグメニュー");
    let chatTab = tabContainer.createTab("AI Chat");
    // 初期表示タブをGET Parametersタブに設定
    tabContainer.activateTab(dictMenuTab.id);

    // GET Parameters setup
    dictMenu = editor.createDictMenu(dictMenuTab, {});
    dictMenu.setTitle("GETパラメータ (実行時に送信されます)");
    dictMenu.addButton();
    dictMenuTab.setContent(dictMenu);
    
    // localStorageからGETパラメータを復元
    const savedParams = localStorage.getItem('getParams');
    if (savedParams) {
        try {
            const params = JSON.parse(savedParams);
            dictMenu.addItem(params);
        } catch (e) {
            console.error('Failed to load GET parameters:', e);
        }
    }
    // 末尾に空の行を追加しておく
    dictMenu.addItem({'':''});

    let hr = document.createElement("hr");
    dictMenuTab.addContent(hr);

    // POST parameters setup
    // POST checkbox
    let postCheck = editor.generateCheckbox(
        null,
        "POSTリクエスト",
        false,
        (checked) => {
            postDictMenu.setEnabled(checked);
            jsonCheck.setEnabled(checked);
        }
    );
    dictMenuTab.addContent(postCheck);

    // JSON checkbox
    let jsonCheck = editor.generateCheckbox(
        null,
        "JSON形式で送信",
        false,
        (checked) => {
            // 今のところ特に処理は不要
        }
    );
    dictMenuTab.addContent(jsonCheck);
    jsonCheck.setEnabled(false); // 初期状態では無効化

    let postDictMenu = editor.createDictMenu(dictMenuTab, {});
    postDictMenu.setTitle("POSTパラメータ (Webページモードでは送信されません)");
    postDictMenu.addButton();
    dictMenuTab.addContent(postDictMenu);
    
    // localStorageからPOST設定を復元
    const savedPostCheckState = localStorage.getItem('postCheckState');
    const savedJsonCheckState = localStorage.getItem('jsonCheckState');
    const savedPostParams = localStorage.getItem('postParams');
    
    // POSTチェックボックスの状態を復元
    if (savedPostCheckState !== null) {
        try {
            const postCheckEnabled = savedPostCheckState === 'true';
            postCheck.setState(postCheckEnabled);
            postDictMenu.setEnabled(postCheckEnabled);
            jsonCheck.setEnabled(postCheckEnabled);
            console.log('Restored POST checkbox state:', postCheckEnabled);
        } catch (e) {
            console.error('Failed to restore POST checkbox state:', e);
        }
    }
    
    // JSONチェックボックスの状態を復元
    if (savedJsonCheckState !== null && savedPostCheckState === 'true') {
        try {
            const jsonCheckEnabled = savedJsonCheckState === 'true';
            jsonCheck.setState(jsonCheckEnabled);
            console.log('Restored JSON checkbox state:', jsonCheckEnabled);
        } catch (e) {
            console.error('Failed to restore JSON checkbox state:', e);
        }
    }
    
    // POSTパラメータを復元
    if (savedPostParams) {
        try {
            const postParams = JSON.parse(savedPostParams);
            postDictMenu.addItem(postParams);
            console.log('Restored POST parameters:', postParams);
        } catch (e) {
            console.error('Failed to load POST parameters:', e);
        }
    }
    
    // 末尾に空の行を追加しておく
    postDictMenu.addItem({'':''});
    
    // 初期状態では無効化（復元された状態に応じて有効化される）
    if (savedPostCheckState !== 'true') {
        postDictMenu.setEnabled(false);
    }

    // Chat setup
    chat = editor.createChat(chatTab, {});
    chat.setTitle("AI Chat");
    chat.setBackgroundMessage("AIチャットへようこそ!");
    
    // chatにコンソールへの参照を渡す（設定保存時のメッセージ表示用）
    chat.console = mConsole;

    chatTab.setContent(chat);

    // AIからの返答のコードブロックのコードに適用ボタンを押したときの処理
    chat.onApplyToCode = function(codeText, applyBtn) {
        if (!APP_STATE.CURRENT_FILE || !APP_STATE.CURRENT_FILE.aceObj || !APP_STATE.CURRENT_FILE.aceObj.editor) {
            console.error("現在のファイルが無効です。");
            mConsole.print("マージ先のファイルを開いてください", "error");
            // エラー状態表示
            applyBtn.showError();
            return;
        }
        
        // 適用開始のフィードバック
        applyBtn.startLoading();
        mConsole.print("コードをマージ中...", "info");
        
        // カスタムAPIが有効な場合はURLとAPIキーを渡す
        let customUrl = null;
        let customApiKey = null;
        if (APP_STATE.AI_CONFIG.useCustomApi && APP_STATE.AI_CONFIG.baseUrl && APP_STATE.AI_CONFIG.apiKey) {
            customUrl = APP_STATE.AI_CONFIG.baseUrl;
            customApiKey = APP_STATE.AI_CONFIG.apiKey;
        }
        
        AIMerge(
            APP_STATE.CURRENT_FILE.aceObj.editor.getValue(), 
            codeText, 
            modelSelect,
            fetchAIChat,
            editor,
            APP_STATE.CURRENT_FILE,
            mConsole,
            editorEditor,
            customUrl,
            customApiKey
        ).then(() => {
            applyBtn.stopLoading();
            // 成功フィードバック
            mConsole.print("コードを適用", "success");
            applyBtn.showSuccess();
        }).catch((error) => {
            applyBtn.stopLoading();
            // エラーフィードバック
            console.error("コード適用エラー:", error);
            mConsole.print("コードの適用エラー: " + (error.message || error), "error");
            applyBtn.showError();
        });
    };

    // Chat config
    chat.setOnConfigSaved(async (config) => {
        saveAIConfig(config.baseUrl, config.apiKey, config.useCustomApi);
        console.log("AI custom model: Config saved", config);
        APP_STATE.AI_CONFIG = config;
        chat.config.customApiUrl = config.baseUrl;
        chat.config.customApiKey = config.apiKey;
        chat.config.useCustomApi = config.useCustomApi;
        
        // 設定変更後にモデルリストを再読み込み
        let customApiConfig = null;
        if (config.useCustomApi && config.baseUrl && config.apiKey) {
            customApiConfig = {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey
            };
            console.log("Reloading models from custom API");
        } else {
            console.log("Reloading models from default API");
        }
        
        // モデルセレクターを再生成
        modelSelect = await loadModelList(chat, customApiConfig);
        
        // コンソールにメッセージを表示
        if (mConsole) {
            mConsole.print("AI設定を保存しました。モデルリストを更新しました。", "success");
        }
    });

    // Cookieから保存されたAI設定を復元
    const savedAIConfig = loadAIConfig();
    if (savedAIConfig.apiUrl || savedAIConfig.apiKey || savedAIConfig.useCustomApi) {
        console.log("AI custom setting: Restoring config from cookie", savedAIConfig);
        // chatコンポーネントに設定を復元
        chat.config.customApiUrl = savedAIConfig.apiUrl || '';
        chat.config.customApiKey = savedAIConfig.apiKey || '';
        chat.config.useCustomApi = savedAIConfig.useCustomApi || false;
        
        // APP_STATEにも保存
        APP_STATE.AI_CONFIG = {
            baseUrl: savedAIConfig.apiUrl || '',
            apiKey: savedAIConfig.apiKey || '',
            useCustomApi: savedAIConfig.useCustomApi || false
        };
    }

    // Model selector setup
    // カスタムAPIが有効な場合はカスタムAPIからモデルを取得
    let customApiConfig = null;
    if (APP_STATE.AI_CONFIG.useCustomApi && APP_STATE.AI_CONFIG.baseUrl && APP_STATE.AI_CONFIG.apiKey) {
        customApiConfig = {
            baseUrl: APP_STATE.AI_CONFIG.baseUrl,
            apiKey: APP_STATE.AI_CONFIG.apiKey
        };
        console.log("Loading models from custom API");
    }
    modelSelect = await loadModelList(chat, customApiConfig);

    // Chat history setup
    setupChatClearHistory(chat, chatHistoryManager);

    // Load and restore chat history
    const chatHistory = chatHistoryManager.loadChatHistory();
    restoreChatHistoryToUI(chatHistory, chat);

    // Chat event handlers
    const sendAIMessageHandler = () => {
        // カスタムAPIが有効な場合はURLとAPIキーを渡す
        let customUrl = null;
        let customApiKey = null;
        if (APP_STATE.AI_CONFIG.useCustomApi && APP_STATE.AI_CONFIG.baseUrl && APP_STATE.AI_CONFIG.apiKey) {
            customUrl = APP_STATE.AI_CONFIG.baseUrl;
            customApiKey = APP_STATE.AI_CONFIG.apiKey;
            console.log("Using custom API for chat request");
        }
        
        sendAIMessage({
            chat,
            historyManager: chatHistoryManager,
            modelSelect,
            fetchAIChat,
            currentFile: APP_STATE.CURRENT_FILE,
            fileList: APP_STATE.FILE_LIST,
            baseDir: editor.BASE_DIR,
            customUrl: customUrl,
            customApiKey: customApiKey,
            requestAIMergeAndPreview: async (aiCode) => {
                // この関数は必要に応じて実装
                console.log("requestAIMergeAndPreview called with:", aiCode);
            }
        });
    };

    chat.inputArea.sendBtn.addEventListener("click", function(){
        try {
            sendAIMessageHandler();
        } catch(e) {
            console.error("送信ボタンエラー:", e);
            chat.addMessage('<span style="color:red">送信ボタンエラー: '+e.message+'</span>', "system");
        }
    });

    chat.inputArea.textarea.addEventListener("keydown", function(e){
        try {
            if(e.key === "Enter" && !e.shiftKey){
                e.preventDefault();
                sendAIMessageHandler();
            }
        } catch(e) {
            console.error("Enterキー送信エラー:", e);
            chat.addMessage('<span style="color:red">Enterキー送信エラー: '+e.message+'</span>', "system");
        }
    });

    // テーマ設定
    let theme = userConfig.get("theme");
    if(theme == null){
        theme = "light";
    }
    changeTheme(theme, APP_STATE.CURRENT_FILE, editor, userConfig, CONFIG.DEBUG);

    // セッション生存確認を開始
    startSessionPulse({
        interval: 180000, // 3分間隔
        onSessionValid: function(data) {
            // セッション有効時の処理
            // nothing to do
        },
        onSessionExpired: function(data) {
            // セッション期限切れ時の処理
            if (mConsole) {
                mConsole.print("セッションが期限切れです。再ログインしてください。", "error");
            }
            setTimeout(() => {
                window.location.href = '/login.php';
            }, 2000);
        },
        onError: function(error) {
            // エラーハンドリング（ネットワークエラーなど）
            console.warn('セッションチェックエラー:', error);
            if (CONFIG.DEBUG && mConsole) {
                mConsole.print("セッションチェックエラー: " + error.message, "warning");
            }
        }
    });
}

// アプリケーション開始
main().catch(error => {
    console.error("Application initialization error:", error);
});

// デバッグ用：主要なオブジェクトをグローバルに公開
window.editor = editor;
window.userConfig = userConfig;
window.chatHistoryManager = chatHistoryManager;

// api関数をグローバルに定義（既存のコードとの互換性のため）
window.api = api;
