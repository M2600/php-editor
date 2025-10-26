/**
 * メインアプリケーション統合モジュール
 */

// Core modules
import { UserConfig, changeTheme, CONFIG, APP_STATE } from './modules/core/config.js';
import { loadExplorer, saveSortSettings } from './modules/core/file-manager.js';
import { startSessionPulse } from './modules/core/pulse.js';
import { ExplorerAutoReload } from './modules/core/explorer-auto-reload.js';

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

// エクスプローラー自動リロードインスタンス
// ユーザー設定から間隔と有効/無効を読み込む
const savedInterval = userConfig.get('explorerAutoReloadInterval');
const savedEnabled = userConfig.get('explorerAutoReloadEnabled');

export const explorerAutoReload = new ExplorerAutoReload({
    interval: savedInterval !== null ? savedInterval : CONFIG.EXPLORER_AUTO_RELOAD_INTERVAL,
    enabled: savedEnabled !== null ? savedEnabled : true,
    debug: CONFIG.DEBUG
});

// Global variables
let mConsole;
let dictMenu;
let postJsonEditor;
let postCheck;
let jsonCheck;
let chat;
let modelSelect;
let fetchAIChat;

/**
 * エクスプローラー自動リロード設定を保存
 */
function saveExplorerAutoReloadConfig() {
    const config = explorerAutoReload.getConfig();
    userConfig.set('explorerAutoReloadInterval', config.interval);
    userConfig.set('explorerAutoReloadEnabled', config.enabled);
    console.log('Explorer auto-reload config saved:', config);
}

// グローバルに公開（コンソールから設定保存できるように）
window.saveExplorerAutoReloadConfig = saveExplorerAutoReloadConfig;

/**
 * 実行処理を共通化した関数
 * RUN_MODEに応じてWebプレビューまたはAPI開発モードで実行
 */
async function executeCurrentFile() {
    if (!APP_STATE.CURRENT_FILE) {
        console.warn("No file is currently open");
        return;
    }
    
    console.log("Execute: " + APP_STATE.CURRENT_FILE.path);
    
    // 実行メソッドとコンテンツタイプを取得
    const method = postCheck.getState() ? "POST" : "GET";
    const isJsonMode = jsonCheck.getState();
    const contentType = isJsonMode ? "application/json" : "application/x-www-form-urlencoded";


    // GETパラメータを取得
    let getParams = {};
    if (method === "GET") {
        getParams = dictMenu ? dictMenu.getItemsAsObject() : {};
    } else {
        getParams = {};
    }
    
    // POSTパラメータを取得（モードに応じて）
    let postParams = {};
    

    if (method === "POST") {
        if (isJsonMode) {
            // JSONモード: バリデーションしてからJSONエディタから取得
            if (!postJsonEditor.validate()) {
                if (mConsole) {
                    mConsole.print('POSTパラメータのJSONの形式が正しくありません。修正してから実行してください。', 'error');
                }
                console.error('Invalid JSON format');
                return;
            }
            
            try {
                postParams = postJsonEditor.getValue();
            } catch (e) {
                console.error('Failed to get JSON parameters:', e);
                if (mConsole) {
                    mConsole.print('JSONパラメータの取得エラー: ' + e.message, 'error');
                }
                return;
            }
        } else {
            // シンプルモード: DictMenuから取得
            postParams = dictMenu ? dictMenu.getItemsAsObject() : {};
        }
    }
    
    if (APP_STATE.RUN_MODE === 'WEB_MODE') {
        // Webページモード: プレビューiframeで実行
        console.log("Run in preview iframe (Web page mode)");
        
        // まずファイルを保存
        if (APP_STATE.CURRENT_FILE.changed && !APP_STATE.CURRENT_FILE.readonly) {
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
        
        // プレビューURLを構築
        const filePath = APP_STATE.CURRENT_FILE.path;
        let previewUrl = `${CONFIG.FILE_PAGE_BASE_URL}${APP_STATE.USER_ID}${filePath}?`;
        
        // GETパラメータを追加
        for (const [key, value] of Object.entries(getParams)) {
            if (key) { // 空のキーはスキップ
                previewUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            }
        }
        
        // プレビューiframeにURLを設定
        if (APP_STATE.WEB_PREVIEWER) {
            APP_STATE.WEB_PREVIEWER.setURL(previewUrl);
            APP_STATE.WEB_PREVIEWER.setTitle("<a href='" + previewUrl + "' target='_blank' title='" + APP_STATE.CURRENT_FILE.name + "を新しいタブで開く'>" + APP_STATE.CURRENT_FILE.name + "</a>");
            APP_STATE.WEB_PREVIEWER.show();
            console.log("Preview URL set:", previewUrl);
        } else {
            // WEB_PREVIEWERが利用できない場合は新しいタブで開く
            APP_STATE.RUN_BROWSER_TAB = openInOtherWindow(
                APP_STATE.CURRENT_FILE,
                (path, content) => saveFile(
                    path, content, api, APP_STATE.CURRENT_FILE, mConsole, CONFIG.DEBUG, phpSyntaxCheck, editor, APP_STATE
                ),
                APP_STATE.RUN_BROWSER_TAB,
                CONFIG.FILE_PAGE_BASE_URL,
                APP_STATE.USER_ID,
                getParams,
            );

            console.error("WEB_PREVIEWER not available");
        }
        
        // Webページモードでも実行後にエクスプローラーをリロード
        // ファイル生成や変更が行われる可能性があるため
        if (CONFIG.RELOAD_EXPLORER_AFTER_EXECUTION && 
            explorerAutoReload && 
            typeof explorerAutoReload.reloadAfter === 'function') {
            console.log('Scheduling explorer reload after web execution...');
            explorerAutoReload.reloadAfter(CONFIG.RELOAD_EXPLORER_EXECUTION_DELAY).catch(err => {
                console.error('Failed to reload explorer after web execution:', err);
            });
        }
    } else {
        // API開発モード: コンソールに出力
        console.log("Run in debug mode with GET params:", getParams);
        
        // パラメータと設定は編集時に自動保存されるため、ここでの保存処理は不要
        
        // Show console automatically when running program
        if (mConsole && typeof mConsole.show === 'function') {
            mConsole.show();
        }

        // mConsoleの内容をクリア
        if (mConsole && typeof mConsole.clear === 'function') {
            mConsole.clear();
        }

        // CGI実行（GETパラメータ付き）
        await runPhpCgi(
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
                onComplete: async (result) => {
                    // プログラム実行後にエクスプローラーをリロード
                    // 少し遅延させてファイルシステムの変更を確実に反映
                    if (CONFIG.RELOAD_EXPLORER_AFTER_EXECUTION && 
                        explorerAutoReload && 
                        typeof explorerAutoReload.reloadAfter === 'function') {
                        console.log('Scheduling explorer reload after program execution...');
                        explorerAutoReload.reloadAfter(CONFIG.RELOAD_EXPLORER_EXECUTION_DELAY).catch(err => {
                            console.error('Failed to reload explorer after execution:', err);
                        });
                    }
                }
            }
        );
    }
}


async function main(){
    // localStorageから実行モードを復元
    const savedRunMode = localStorage.getItem('runMode');
    if (savedRunMode !== null && (savedRunMode === 'API_MODE' || savedRunMode === 'WEB_MODE')) {
        APP_STATE.RUN_MODE = savedRunMode;
        console.log("Run mode restored from localStorage:", APP_STATE.RUN_MODE);
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
        
        // JSONエディタのテーマも変更
        if(postJsonEditor && typeof postJsonEditor.setTheme === 'function'){
            postJsonEditor.setTheme(theme);
        }
        
        userConfig.set("theme", theme);
    });

    editor.page.header.header.menu.items.push(editor.generateButton(
        editor.page.header.header.menu,
        "旧UIへ",
        (e) => {window.location.href = "/1.php";},
        "旧バージョンのUIに切り替えます"
    ))

    editor.page.header.header.menu.items.push(editor.generateButton(
        editor.page.header.header.menu,
        "ログアウト",
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


    const editModeLabel = editor.generateLabel(
        null,
        "モード:",
        "現在の開発モードが表示されます。エディタ上部のボタンで切り替え可能です。",
    );
    editModeLabel.setContent(APP_STATE.RUN_MODE === 'WEB_MODE' ? "開発モード: Webページ" : "開発モード: API開発");
    editor.page.header.header.menu.items.push(editModeLabel);
    editor.page.header.header.menu.element.prepend(editModeLabel.element);
    

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
        "ファイルを保存します"
    );
    editorEditor.menu.left.items.push(saveButton);
    
    // Run button (統合版: RUN_MODEに応じて動作を変更)
    const runButton = editor.generateButton(
        editorEditor.menu.left,
        "▶実行",  // 実行アイコン
        async (e) => {
            await executeCurrentFile();
        },
        "プログラムを実行し、結果を右側に表示します"
    );
    editorEditor.menu.left.items.push(runButton);

    // Run mode toggle
    // editorEditor.menu.left.items.push(editor.generateCheckbox(
    //     editorEditor.menu.left,
    //     "API開発モード",
    //     APP_STATE.RUN_MODE === 'API_MODE',
    //     (checked) => {
    //         APP_STATE.RUN_MODE = checked ? 'API_MODE' : 'WEB_MODE';
    //         console.log("Run mode changed - RUN_MODE:", APP_STATE.RUN_MODE);
    //         console.log(checked ? "→ API開発モード " : "→ Webページモード");
            
    //         // localStorageに状態を保存
    //         try {
    //             localStorage.setItem('runMode', APP_STATE.RUN_MODE);
    //             console.log("Run mode saved to localStorage:", APP_STATE.RUN_MODE);
    //         } catch (err) {
    //             console.error('Failed to save run mode:', err);
    //         }
    //     },
    //     "チェックON: API開発モード | チェックOFF: Webページモード"
    // ));

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
        consoleRunButton.setEnabled(hasFile);
    }

    // ファイル操作用のボタンを参照として保持
    APP_STATE.FILE_ACTION_BUTTONS = {
        save: saveButton,
        run: runButton,
        qr: qrButton,
        update: updateFileActionButtons
    };

    // Debug button
    const t = APP_STATE.RUN_MODE === 'API_MODE' ? "Webページモードへ" : "API開発モードへ";
    editorEditor.menu.right.items.push(editor.generateButton(
        editorEditor.menu.right,
        t,
        (e) => {
            if(APP_STATE.RUN_MODE === 'WEB_MODE'){
                tabContainer.showTab(dictMenuTab.id);
                tabContainer.show();
                tabContainer.hideTab(webPreviewTab.id);
                APP_STATE.RUN_MODE = 'API_MODE';
                e.target.innerHTML = "Webページモードへ";
                editModeLabel.setContent("開発モード: API開発");
            }
            else if(APP_STATE.RUN_MODE === 'API_MODE'){
                tabContainer.showTab(webPreviewTab.id);
                tabContainer.hideTab(dictMenuTab.id);
                APP_STATE.RUN_MODE = 'WEB_MODE';
                e.target.innerHTML = "API開発モードへ";
                editModeLabel.setContent("開発モード: Webページ");
            }
            // localStorageに状態を保存
            try {
                localStorage.setItem('runMode', APP_STATE.RUN_MODE);
                console.log("Run mode saved to localStorage:", APP_STATE.RUN_MODE);
            } catch (err) {
                console.error('Failed to save run mode:', err);
            }
        },
        "開発モードを切り替えます"
    ));


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
        title: "/",
    });
    explorer.setMenuTitle("");

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
                async () => {
                    // F10キーで実行：共通の実行関数を呼び出し
                    await executeCurrentFile();
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

    explorer.setReloadClickAction(() => {
        loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });

    await loadExplorer("/", api, APP_STATE, editor);

    // エクスプローラー自動リロードの設定
    explorerAutoReload.setReloadFunction(async () => {
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });
    
    // 自動リロードを開始
    if (CONFIG.EXPLORER_AUTO_RELOAD_INTERVAL > 0) {
        explorerAutoReload.start();
        console.log(`Explorer auto-reload started (interval: ${CONFIG.EXPLORER_AUTO_RELOAD_INTERVAL}ms)`);
    }




    const changeMethodMode = (method) => {
        if (method === "GET") {
            dictMenu.setEnabled(true);
            postJsonEditor.setEnabled(false);
            jsonCheck.setEnabled(false);
            postJsonEditor.hide();
            jsonCheck.hide();
            dictMenu.show();
            dictMenu.setTitle("GETパラメータ");
            // localStorageからGETパラメータを復元
            loadGETParams(dictMenu);
            // POSTモードを保存
            try {
                localStorage.setItem('postCheckState', 'false');
                console.log('POST checkbox state saved: false');
            } catch (e) {
                console.error('Failed to save POST checkbox state:', e);
            }
        }
        else if (method === "POST") {
            const isJsonMode = jsonCheck.getState();
            if (isJsonMode) {
                postJsonEditor.show();
                dictMenu.hide();

            } else {
                dictMenu.show();
                postJsonEditor.hide();
                dictMenu.setTitle("POSTパラメータ");
                // localStorageからPOSTパラメータを復元
                loadPOSTParams(dictMenu);
            }
            jsonCheck.show();
            jsonCheck.setEnabled(true);
            // POSTモードを保存
            try {
                localStorage.setItem('postCheckState', 'true');
                console.log('POST checkbox state saved:', isJsonMode);
            } catch (e) {
                console.error('Failed to save POST checkbox state:', e);
            }
        }
        else {
            console.error("Unknown method: ", method);
            return;
        }
    }

    const changeJsonMode = (isJson) => {
        if (isJson) {
            postJsonEditor.setEnabled(true);
            dictMenu.setEnabled(false);
            postJsonEditor.show();
            dictMenu.hide();
        } else {
            dictMenu.setEnabled(true);
            postJsonEditor.setEnabled(false);
            postJsonEditor.hide();
            dictMenu.show();
            loadPOSTParams(dictMenu);
            
        }
        // JSONモードを保存
        try {
            localStorage.setItem('jsonCheckState', isJson ? 'true' : 'false');
            console.log('JSON checkbox state saved:', isJson);
        } catch (e) {
            console.error('Failed to save JSON checkbox state:', e);
        }
    }

    const saveGETParams = (dictMenu) => {
        if (dictMenu) {
            try {
                const params = dictMenu.getItemsAsObject();
                localStorage.setItem('getParams', JSON.stringify(params));
                console.log('GET parameters saved:', params);
            } catch (err) {
                console.error('Failed to save GET parameters:', err);
            }
        }
    }
    const loadGETParams = (dictMenu) => {
        if (dictMenu) {
            try {
                const params = JSON.parse(localStorage.getItem('getParams'));
                if (params) {
                    dictMenu.clearItems();
                    dictMenu.addItem(params);
                }
                else {
                    //dictMenu.addItem({'':''}); // 空行追加
                }
                console.log('GET parameters loaded:', params);
            } catch (err) {
                console.error('Failed to load GET parameters:', err);
            }
        }
    }
    const savePOSTParams = (dictMenu) => {
        if (dictMenu) {
            try {
                const params = dictMenu.getItemsAsObject();
                localStorage.setItem('postParams', JSON.stringify(params));
                console.log('POST parameters saved:', params);
            } catch (err) {
                console.error('Failed to save POST parameters:', err);
            }
        }
    }
    const loadPOSTParams = (dictMenu) => {
        if (dictMenu) {
            try {
                const params = JSON.parse(localStorage.getItem('postParams'));
                if (params) {
                    dictMenu.clearItems();
                    dictMenu.addItem(params);
                }
                else {
                    //dictMenu.addItem({'':''}); // 空行追加
                }
                console.log('POST parameters loaded:', params);
            } catch (err) {
                console.error('Failed to load POST parameters:', err);
            }
        }
    }
    const savePOSTParamsJson = (jsonEditor) => {
        if (jsonEditor) {
            try {
                const params = jsonEditor.getValue();
                localStorage.setItem('postParamsJson', JSON.stringify(params));
                console.log('POST JSON parameters saved:', params);
            } catch (err) {
                console.error('Failed to save POST JSON parameters:', err);
            }
        }
    }
    const loadPOSTParamsJson = (jsonEditor) => {
        if (jsonEditor) {
            try {
                const params = JSON.parse(localStorage.getItem('postParamsJson'));
                if (params) {
                    jsonEditor.setValue(params);
                }
                console.log('POST JSON parameters loaded:', params);
            } catch (err) {
                console.error('Failed to load POST JSON parameters:', err);
            }
        }
    }

    // Right panel components
    let tabContainer = editor.tab(editor.page.main.right);

    const webPreviewTab = tabContainer.createTab("実行結果");
    let dictMenuTab = tabContainer.createTab("API開発メニュー");
    let chatTab = tabContainer.createTab("AI Chat");
    // 初期表示タブをGET Parametersタブに設定
    tabContainer.activateTab(dictMenuTab.id);

    


    // POST parameters setup
    // POST checkbox
    postCheck = editor.generateSegmentedButton(
        null,
        [
            { label: "GET", value: "GET", tooltip: "GETメソッドで送信"},
            { label: "POST", value: "POST", tooltip: "POSTメソッドで送信" }
        ],
        0,
        (value) => {
            //console.log('Selected method: ' + value);
            changeMethodMode(value);
        },

    );
    dictMenuTab.addContent(postCheck);

    // JSON checkbox
    jsonCheck = editor.generateCheckbox(
        null,
        "JSON形式で送信 (複雑なデータ構造に対応)",
        false,
        (checked) => {
            changeJsonMode(checked);
            loadPOSTParamsJson(postJsonEditor);
        }
    );
    dictMenuTab.addContent(jsonCheck);

    // POSTパラメータ用のコンテナ（DictMenuまたはJSONエディタを切り替える）
    const paramsContainer = document.createElement("div");
    paramsContainer.style.flex = "1";
    paramsContainer.style.display = "flex";
    paramsContainer.style.flexDirection = "column";
    paramsContainer.style.overflow = "auto";

    // シンプルモード: DictMenu
    dictMenu = editor.createDictMenu(null, {});
    dictMenu.addButton();
    paramsContainer.appendChild(dictMenu.element);
    
    // 高度なモード: JSONエディタ
    postJsonEditor = editor.createJsonEditor(null, {});
    postJsonEditor.setTitle("POSTパラメータ (JSON形式)");
    postJsonEditor.element.style.display = "none"; // 初期状態では非表示
    paramsContainer.appendChild(postJsonEditor.element);
    
    // JSONエディタの変更時にlocalStorageに保存
    postJsonEditor.onChange((jsonData) => {
        savePOSTParamsJson(postJsonEditor);
    });
    
    // localStorageからPOST設定を復元
    const savedPostCheckState = localStorage.getItem('postCheckState');
    const savedJsonCheckState = localStorage.getItem('jsonCheckState');
    const savedPostParams = localStorage.getItem('postParams');
    const savedPostParamsJson = localStorage.getItem('postParamsJson');
    
    // JSONチェックボックスの状態を先に復元（モード決定のため）
    let isJsonMode = false;
    if (savedJsonCheckState !== null && savedPostCheckState === 'true') {
        try {
            isJsonMode = savedJsonCheckState === 'true';
            console.log('Restored JSON checkbox state:', isJsonMode);
        } catch (e) {
            console.error('Failed to restore JSON checkbox state:', e);
        }
    }
    jsonCheck.setState(isJsonMode);
    
    
    // POSTパラメータが変更されたときにlocalStorageに保存（シンプルモード）
    dictMenu.onChange((params) => {
        // GETモード
        if (postCheck.getActiveValue() === "GET") {
            saveGETParams(dictMenu);
        }
        // POSTモード・シンプルモード
        else if (postCheck.getActiveValue() === "POST" && !isJsonMode) {
            savePOSTParams(dictMenu);
        }
    });
    
    // 各種モードを復元
    if (savedPostCheckState !== null) {
        if (savedPostCheckState === 'true') {
            postCheck.setActiveValue("POST");
            jsonCheck.setEnabled(true);
            //changeMethodMode("POST");
            if (isJsonMode) {
                changeJsonMode(true);
            } else {
                changeJsonMode(false);
                changeMethodMode("POST");
            }
            console.log('Restored POST checkbox state: true');
        } else {
            postCheck.setActiveValue("GET");
            jsonCheck.setEnabled(false);
            changeMethodMode("GET");
            console.log('Restored POST checkbox state: false');
        }
    } else {
        // 初期状態では無効化
        postJsonEditor.setEnabled(false);
        console.log('No saved POST checkbox state found; defaulting to GET mode');
    }
    

    const postDictContainer = document.createElement("div");
    postDictContainer.style.display = "flex";
    postDictContainer.style.flexDirection = "column";
    postDictContainer.style.height = "100%";
    postDictContainer.appendChild(postCheck.element);
    postDictContainer.appendChild(jsonCheck.element);
    postDictContainer.appendChild(paramsContainer);





    

    // Console setup
    mConsole = editor.console();
    mConsole.setTitle("実行結果");
    
    // 左メニュー（タイトルの右）に実行ボタンを追加
    const consoleRunButton = editor.generateButton(
        null,
        "▶実行",
        async () => {
            await executeCurrentFile();
        },
        "プログラムを実行し、結果を表示します"
    );
    mConsole.addMenuComponent(consoleRunButton);
    
    // 右メニューにクリアボタンを追加
    const consoleClearButton = editor.generateButton(
        null,
        "🗑クリア",
        () => {
            mConsole.clear();
        },
        "実行結果をクリア"
    );
    mConsole.addRightMenuComponent(consoleClearButton);
    // 初期状態を無効化
    consoleRunButton.setEnabled(false);
    
    dictMenuTab.addContent(mConsole);


    const vstack = editor.createVStack(null, {
        count: 2,
        unit: 'percent',
        sizes: [50, 50],
        minWidth: 120,
        sashSize: 10,
        saveKey: 'debugMenuPanelVStack',
        onResizeEnd: ({ ratios, px, percent }) => {
            console.log('VStack resized:', ratios, px, percent);
        }
    });
    
    vstack.getPane(0).element.appendChild(postDictContainer);
    vstack.getPane(1).element.appendChild(mConsole.element);
    // デバッグメニューをタブコンテナに追加
    // 初期状態は非表示
    dictMenuTab.setContent(vstack);
    
    // DOMに追加された後、JSONモードの場合はパラメータを復元
    if (isJsonMode && savedPostParamsJson) {
        // setTimeoutで次のイベントループまで待機してから復元
        setTimeout(() => {
            try {
                const jsonData = JSON.parse(savedPostParamsJson);
                postJsonEditor.setValue(jsonData);
                console.log('Restored POST JSON parameters:', jsonData);
            } catch (e) {
                console.error('Failed to load POST JSON parameters:', e);
            }
        }, 0);
    }

    
    const webPreviewer = editor.webPreviewer(webPreviewTab, "about:blank",{});
    webPreviewer.setTitle("実行ボタンを押すと結果がここに表示されます");
    webPreviewTab.setContent(webPreviewer);
    APP_STATE.WEB_PREVIEWER = webPreviewer;

    // リロードボタンのコールバックを設定（保存してからリロード）
    webPreviewer.onReload = async () => {
        //console.log("Reload button clicked - executing file with save");
        if (APP_STATE.CURRENT_FILE && !APP_STATE.CURRENT_FILE.readonly && APP_STATE.CURRENT_FILE.changed) {
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
        await webPreviewer.reload();
    };

    if(APP_STATE.RUN_MODE === 'WEB_MODE'){
        tabContainer.showTab(webPreviewTab.id);
        tabContainer.hideTab(dictMenuTab.id);
    }
    else{
        tabContainer.showTab(dictMenuTab.id);
        tabContainer.hideTab(webPreviewTab.id);
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
    
    // JSONエディタのテーマも設定
    if(postJsonEditor && typeof postJsonEditor.setTheme === 'function'){
        postJsonEditor.setTheme(theme);
    }

    // セッション生存確認を開始
    startSessionPulse({
        interval: CONFIG.SESSION_PULSE_INTERVAL || 60000, // デフォルト1分
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
window.explorerAutoReload = explorerAutoReload;

// api関数をグローバルに定義（既存のコードとの互換性のため）
window.api = api;

window.APP_STATE = APP_STATE;
