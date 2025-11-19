/**
 * エディター関連機能とACEエディターの管理
 */

import { hideAllPreviewer } from '../utils/helpers.js';
import { extToLang, loadExplorer, loadFile } from '../core/file-manager.js';
import { Path } from '../utils/api.js';
import { AceWrapper } from '../../../MEditor/MEditor.js';

export function aceKeybinds(ace, pushSaveButton, openInOtherWindow){
    ace.commands.addCommand({
        name: "save",
        bindKey: {
            win: "Ctrl-S",
            mac: "Command-S"
        },
        exec: function (editor) {
            console.log("save shortcut")
            pushSaveButton();
        }
    });

    ace.commands.addCommand({
        name: "run",
        bindKey: {
            win: "F10",
            mac: "",
        },
        exec: function (editor) {
            console.log("run shortcut");
            openInOtherWindow();
        }
    })

    ace.commands.removeCommand("jumptomatching");

    // Vim キーバインド用のカスタムコマンドを追加
    // 保存コマンド
    window.ace.config.loadModule('ace/keyboard/vim', function(module) {
        const vimApi = require('ace/keyboard/vim').Vim;
        // Add custom ex command :w to save file
        vimApi.defineEx("write", "w", function(cm, input) {
            console.log("Vim :w command triggered");
            pushSaveButton();
        });
    })

    // 実行コマンド
    window.ace.config.loadModule('ace/keyboard/vim', function(module) {
        const vimApi = require('ace/keyboard/vim').Vim;
        // Add custom ex command :run to run file
        vimApi.defineEx("!", "!", function(cm, input) {
            console.log("Vim :! command triggered: ", cm , input);
            openInOtherWindow();
        });
    })
}

export async function openFile(file, aceList, editor, mConsole, extLangMap, DEBUG, aceKeybinds, api) {
    DEBUG && console.log("fileInfo", file);
    const apiRet = await loadFile(file.path, api);
    if (!apiRet) {
        mConsole.print("Error loading file: " + file.path + " error");
        // reload Explorer
        return;
    }
    hideAllPreviewer();
    
    if(file.type == "text"){
        file.readonly = false;
        if(file.aceObj == undefined || file.aceObj == null){
            // 既存ACE_LISTに同パスのインスタンスがあれば再利用
            const existing = Array.isArray(aceList) ? aceList.find(a => a.filePath === file.path) : null;
            if (existing && existing.aceObj) {
                // 既存を再利用（内容・Undo履歴も保持）
                file.aceObj = existing.aceObj;
                // モードだけは現在の拡張子に合わせ直す
                let mode = extToLang(file.path.split(".").pop(), extLangMap);
                file.aceObj.setMode(mode);
            } else {
                // 新規にDOMとAceインスタンスを作成
                let aceDOM = document.createElement("div");
                editor.wp.content.element.appendChild(aceDOM);
                aceDOM.id = "ace-" + file.path;
                aceDOM.classList.add("viewer");
                aceDOM.style.width = "100%";
                aceDOM.style.height = "100%";
                const aceW = new AceWrapper(aceDOM.id);
                aceW.loadMySettings();
                let mode = extToLang(file.path.split(".").pop(), extLangMap);
                aceW.setMode(mode);
                file.aceObj = aceW;
                aceList.push({
                    aceObj: aceW,
                    filePath: file.path,
                });
                aceKeybinds(file.aceObj.editor);
                file.aceObj.setValue(apiRet.content);
                // Reset history
                file.aceObj.editor.getSession().setUndoManager(new ace.UndoManager())
                file.aceObj.editor.gotoLine(0);
                // Set changed flag to false as default after setValue()
                file.changed = false;
            }
        }
        else if(!file.changed){
            DEBUG && console.log("ace already exists, but file changed flag is false");
            // historyの処理
            const history = file.aceObj.editor.getSession().getUndoManager().$undoStack;
            console.log("ace history: " + file.path, history);
            //const rev = file.aceObj.editor.getSession().getUndoManager().getRevision();
            //console.log("markIgnored at revision: ", rev);
            //file.aceObj.editor.getSession().getUndoManager().markIgnored(rev, rev+1);
            //console.log("ace history after markIgnored: ", file.aceObj.editor.getSession().getUndoManager().$undoStack);
            
            // Get current cursor position
            const currentCursor = file.aceObj.editor.getCursorPosition();
            // Set value to ace editor
            file.aceObj.setValue(apiRet.content);
            // Make cursor position same as before
            file.aceObj.editor.gotoLine(currentCursor.row+1, currentCursor.column);
            file.changed = false;
            mConsole.print("File reloaded: " + file.path, "info");
        }
        else{
            DEBUG && console.log("ace already exists, and file changed flag is true");
        }
        // set theme
        file.aceObj.editor.setTheme(editor.ACE_THEME || 'ace/theme/chrome');

        // reset ace change action
        if(file.aceChangeAction != undefined && file.aceChangeAction != null){
            file.aceObj.off("change", file.aceChangeAction);
            DEBUG && console.log("removed aceChangeAction:", file.aceChangeAction);
        }
        file.aceChangeAction = (e) => {
            file.changed = true;
            DEBUG && console.log("File changed: ", file.path);
            if(typeof editor.addFileIcon === 'function' && typeof editor.removeFileIcon === 'function'){
                editor.removeFileIcon(file.path, '*');
                editor.addFileIcon(file.path, '*');
            }
        };
        file.aceObj.on("change", file.aceChangeAction);

        // 初期状態で未保存なら*表示、そうでなければ消す
        if(file.changed && typeof editor.addFileIcon === 'function'){
            editor.addFileIcon(file.path, '*');
        } else if(typeof editor.removeFileIcon === 'function'){
            editor.removeFileIcon(file.path, '*');
        }

        file.aceObj.show();
        file.aceObj.focus();
    }
    else if(file.type == "image"){
        file.readonly = true;
        if(file.viewer == undefined || file.viewer == null){
            let src = "data:image/png;base64," + apiRet.content;
            let img = editor.imageViewer(editor.wp.content, src);
            img.element.classList.add("viewer");
            file.viewer = img;
        }
        else{
            console.log("image already exists")
        }
        file.viewer.element.style.display = "flex";
    }
    else {
        file.readonly = true;
        if(file.viewer == undefined || file.viewer == null){
            console.log("Unknown file type: ", file.type);
            const msg = editor.viewerMessage(editor.wp.content, "このファイルはプレビューできません");
            msg.element.classList.add("viewer");
            file.viewer = msg;
        }
        else{
            DEBUG && console.log("viewer message already exists");
        }
        file.viewer.element.style.display = "flex";
    }
    return file;
}

export async function pushSaveButton(currentFile, saveFile) {
    if (!currentFile || currentFile.readonly) {
        return;
    }
    let content = currentFile.aceObj.editor.getValue();
    return await saveFile(currentFile.path, content);
}

export async function openInOtherWindow(currentFile, saveFile, runBrowserTab, filePageBaseUrl, userId, getParams = {}) {
    if (!currentFile) {
        return;
    }
    if (!currentFile.readonly && currentFile.changed) {
        await saveFile(currentFile.path, currentFile.aceObj.editor.getValue());
    }
    
    let url = Path.join(filePageBaseUrl, userId, currentFile.path);
    if(url.endsWith("/")){
        url = url.substring(0, url.length - 1);
    }
    
    // GETパラメータをクエリ文字列として追加
    if (getParams && Object.keys(getParams).length > 0) {
        const queryString = new URLSearchParams(getParams).toString();
        url += '?' + queryString;
    }
    
    console.log("Opening URL:", url);
    
    // 固定のウィンドウ名を使用して既存のタブを再利用
    const windowName = 'phpeditor_run_tab';
    
    // 既存のタブがある場合は再利用、なければ新しいタブを開く
    const targetTab = window.open(url, windowName);
    
    if (targetTab) {
        // フォーカスをタブに移す
        targetTab.focus();
    }
    
    return targetTab;
}

export async function showQRCode(currentFile, saveFile, editor, filePageBaseUrl, userId, mConsole, DEBUG, getParams = {}) {
    if (!currentFile) {
        return;
    }
    if (!currentFile.readonly && currentFile.changed) {
        await saveFile(currentFile.path, currentFile.aceObj.editor.getValue());
        mConsole.print("File saved: " + currentFile.path, "success");
    }
    let url = new URL(window.location.href);
    url = url.origin + Path.join(filePageBaseUrl, userId, currentFile.path);
    if(url.endsWith("/")){
        url = url.substring(0, url.length - 1);
    }
    
    // GETパラメータをクエリ文字列として追加
    if (getParams && Object.keys(getParams).length > 0) {
        const queryString = new URLSearchParams(getParams).toString();
        url += '?' + queryString;
    }

    let windowName = "QR Code for " + currentFile.name;
    // Check if window already exists
    let windowExists = false;
    DEBUG && console.log("popup windows: ", editor.page.popupWindows);
    editor.page.popupWindows.forEach((popup) => {
        if (popup.title == windowName) {
            DEBUG && console.log("popup window already exists");
            windowExists = true;
            return;
        }
    });
    if (windowExists) {
        return;
    }
    // Create a popup window
    let contents = document.createElement("div");
    contents.style.display = "flex";

    // Create QR code
    let qrCode = new QRCode(contents, url);
    let popupWindow = editor.popupWindow(windowName, contents);
    return popupWindow;
}
