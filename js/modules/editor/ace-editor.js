/**
 * エディター関連機能とACEエディターの管理
 */

import { hideAllPreviewer } from '../utils/helpers.js';
import { extToLang, loadFile } from '../core/file-manager.js';
import { Path } from '../utils/api.js';

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
}

export async function openFile(file, aceList, editor, mConsole, extLangMap, DEBUG, aceKeybinds, api) {
    DEBUG && console.log("fileInfo", file);
    const apiRet = await loadFile(file.path, api);
    hideAllPreviewer();
    
    if(file.type == "text"){
        file.readonly = false;
        if(file.aceObj == undefined || file.aceObj == null){
            let aceDOM = document.createElement("div");
            editor.wp.content.element.appendChild(aceDOM);
            aceDOM.id = "ace-" + file.path;
            aceDOM.classList.add("viewer");
            aceDOM.style.width = "100%";
            aceDOM.style.height = "100%";
            const ace = new AceWrapper(aceDOM.id);
            ace.loadMySettings();
            let mode = extToLang(file.path.split(".").pop(), extLangMap);
            ace.setMode(mode);
            file.aceObj = ace;
            aceList.push({
                aceObj: ace,
                filePath: file.path,
            })
            aceKeybinds(file.aceObj.editor);
            file.aceObj.setValue(apiRet.content);
            file.aceObj.editor.gotoLine(0);
            // Set changed flag to false as default after setValue()
            file.changed = false;
        }
        else if(!file.changed){
            DEBUG && console.log("ace already exists, but file changed flag is false");
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
        if(editor.THEME == "dark") {
            file.aceObj.editor.setTheme("ace/theme/monokai");
        }
        else{
            file.aceObj.editor.setTheme("ace/theme/chrome");
        }

        // reset ace change action
        if(file.aceChangeAction != undefined && file.aceChangeAction != null){
            file.aceObj.off("change", file.aceChangeAction);
            DEBUG && console.log("removed aceChangeAction:", file.aceChangeAction);
        }
        file.aceChangeAction = (e) => {
            file.changed = true;
            DEBUG && console.log("File changed: ", file.path);
            if(typeof editor.setFileIcon === 'function'){
                editor.setFileIcon(file.path, '*');
            }
        };
        file.aceObj.on("change", file.aceChangeAction);

        // 初期状態で未保存なら*表示、そうでなければ消す
        if(file.changed && typeof editor.setFileIcon === 'function'){
            editor.setFileIcon(file.path, '*');
        } else if(typeof editor.setFileIcon === 'function'){
            editor.setFileIcon(file.path, null);
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

export async function openInOtherWindow(currentFile, saveFile, runBrowserTab, filePageBaseUrl, userId) {
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

export async function showQRCode(currentFile, saveFile, editor, filePageBaseUrl, userId, mConsole, DEBUG) {
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
