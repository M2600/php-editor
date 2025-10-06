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
        (e) => {window.location.href = "/logout.php";}
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

    

    mConsole = editor.console(editor.page.main.mid.container.bottom);

    const editorEditor = editor.workPlace(editor.page.main.mid.container.main);
    editor.wp = editorEditor;

    // Save button
    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "Save",
        (e) => {
            console.log("Save: " + APP_STATE.CURRENT_FILE.path);
            pushSaveButton(APP_STATE.CURRENT_FILE, (path, content) => 
                saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE)
            );
        }
    ));
    
    // Run button
    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "Run",
        (e) => {
            console.log("Run: " + APP_STATE.CURRENT_FILE.path);
            // dictMenuからGETパラメータを取得
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
    ));
    
    // QR Code button
    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "QR Code",
        (e) => {
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
        }
    ));

    // Debug button
    editorEditor.menu.right.items.push(editor.generateButton(
        editorEditor.menu.right,
        "Debug",
        (e) => {
            console.log("Debug with GET params");
            // dictMenuからGETパラメータを取得
            const getParams = dictMenu ? dictMenu.getItemsAsObject() : {};
            console.log("GET Parameters:", getParams);
            
            // GETパラメータをlocalStorageに保存
            try {
                localStorage.setItem('getParams', JSON.stringify(getParams));
            } catch (err) {
                console.error('Failed to save GET parameters:', err);
            }
            
            // CGI実行（GETパラメータ付き）
            runPhpCgi(
                APP_STATE.CURRENT_FILE.path,
                getParams,
                api,
                APP_STATE.CURRENT_FILE,
                (path, content) => saveFile(path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE),
                mConsole
            );
        },
    ));

    editorEditor.menu.right.items.push(editor.generateButton(
        editorEditor.menu.right,
        "test",
        (e) => {
            let tabContainer = editor.tab();
            let dictMenu = editor.createDictMenu();
            dictMenu.setTitle("デバッグ時に送信するGETパラメータ");
            dictMenu.addButton();
            dictMenu.addItem({'':''});
            let tab1 = tabContainer.createTab("GETパラメータ");
            tab1.setContent(dictMenu);
            let tab2 = tabContainer.createTab("test");
            tab2.setContent("<p>Tab 2 content</p>");
            let tab3 = tabContainer.createTab("test3");
            tab3.setContent("<p>Tab 3 content. long long long long long long long long long long long long long long</p>");
            tabContainer.activateTab(tab1.id);
            let popup = editor.popupWindow(
                "デバッグメニュー", 
                tabContainer.element, 
                {width: "40em",height: "30em"},
            );

        }
    ));

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

    let dictMenuTab = tabContainer.createTab("GET Parameters");
    let chatTab = tabContainer.createTab("AI Chat");
    

    // GET Parameters setup
    dictMenu = editor.createDictMenu(dictMenuTab, {});
    dictMenu.setTitle("GETパラメータ(テスト用)");
    dictMenu.addButton();
    dictMenu.addItem({'':''});
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

    // Chat setup
    chat = editor.createChat(chatTab, {});
    chat.setTitle("AI Chat");
    chat.setBackgroundMessage("AIチャットへようこそ!");

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
        
        AIMerge(
            APP_STATE.CURRENT_FILE.aceObj.editor.getValue(), 
            codeText, 
            modelSelect,
            fetchAIChat,
            editor,
            APP_STATE.CURRENT_FILE,
            mConsole,
            editorEditor
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

    // Model selector setup
    modelSelect = await loadModelList(chat);

    // Chat history setup
    setupChatClearHistory(chat, chatHistoryManager);

    // Load and restore chat history
    const chatHistory = chatHistoryManager.loadChatHistory();
    restoreChatHistoryToUI(chatHistory, chat);

    // Chat event handlers
    const sendAIMessageHandler = () => {
        sendAIMessage({
            chat,
            historyManager: chatHistoryManager,
            modelSelect,
            fetchAIChat,
            currentFile: APP_STATE.CURRENT_FILE,
            fileList: APP_STATE.FILE_LIST,
            baseDir: editor.BASE_DIR,
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
