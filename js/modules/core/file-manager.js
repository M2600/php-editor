/**
 * ファイル管理機能
 */

import { sessionError } from '../utils/helpers.js';
import { Path } from '../utils/api.js';

export function aceObjFromFileList(fileList, path) {
    //DEBUG && console.log("aceObjFromFileList: ", fileList, path);
    let aceObj = null;
    fileList.forEach(file => {
        if (file.path == path) {
            aceObj = file.aceObj;
        }
        else if (file.type == "dir") {
            if(aceObj == null){
                aceObj = aceObjFromFileList(file.files, path);
            }
        }
    });
    //console.log("aceObj: ", aceObj);
    return aceObj;
}

export function aceObjFromAceList(aceList, path){
    let aceObj = null;
    aceList.forEach(ace => {
        if (ace.filePath == path) {
            aceObj = ace.aceObj;
        }
    });
    return aceObj;
}

/**
 * 削除されたファイルのAceインスタンスをクリーンアップする
 * @param {string} deletedFilePath 削除されたファイルのパス
 * @param {Array} aceList Aceインスタンスのリスト
 */
export function cleanupAceInstance(deletedFilePath, aceList) {
    const index = aceList.findIndex(ace => ace.filePath === deletedFilePath);
    if (index !== -1) {
        // Aceエディタインスタンスを破棄
        if (aceList[index].aceObj && aceList[index].aceObj.destroy) {
            aceList[index].aceObj.destroy();
        } else if (aceList[index].aceObj && aceList[index].aceObj.editor) {
            aceList[index].aceObj.editor.destroy();
        }
        // リストから削除
        aceList.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * ACE_LIST から指定されたパスのAceインスタンスを削除する
 * @param {Array} aceList - Aceインスタンスのリスト
 * @param {string} path - 削除するファイルのパス
 * @returns {boolean} - 削除が成功したかどうか
 */
export function removeAceFromList(aceList, path) {
    console.log("removeAceFromList: removing ace instance for", path);
    const index = aceList.findIndex(ace => ace.filePath === path);
    if (index !== -1) {
        const aceInstance = aceList[index];
        // Aceエディタを適切に破棄
        if (aceInstance.aceObj && aceInstance.aceObj.destroy) {
            aceInstance.aceObj.destroy();
            console.log("Destroyed ace instance for:", path);
        } else if (aceInstance.aceObj && aceInstance.aceObj.editor) {
            aceInstance.aceObj.editor.destroy();
            console.log("Destroyed ace editor for:", path);
        }
        // リストから削除
        aceList.splice(index, 1);
        console.log("Removed ace from list for:", path, "Remaining instances:", aceList.length);
        return true;
    }
    console.log("No ace instance found for:", path);
    return false;
}

export function getFromPrevFileList(fileList, path, key) {
    //DEBUG && console.log("getFromPrevFileList: ", fileList, key);
    let value = null;
    fileList.forEach(file => {
        if (file.path == path) {
            !value && (value = file[key]);
        }
        else if (file.type == "dir") {
            !value && (value = getFromPrevFileList(file.files, path, key));
        }
    });
    return value;
}

export function mergeAceObjInFileList(fileList, prevFileList, aceList) {
    if (prevFileList == undefined || prevFileList == null) {
        return fileList;
    }
    fileList.forEach(file => {
        if (file.type == "dir") {
            file.files = mergeAceObjInFileList(file.files, prevFileList, aceList);
        }
        else {
            if (!file.path) {
                return; // Skip files without path
            }
            let prevAceObj = aceObjFromAceList(aceList, file.path);
            if (prevAceObj) {
                file.aceObj = prevAceObj;
            }
            file.changed = getFromPrevFileList(prevFileList, file.path, "changed");
            file.aceChangeAction = getFromPrevFileList(prevFileList, file.path, "aceChangeAction");
        }
    });
    return fileList;
}

export function dirListFromFileList(fileList) {
    //console.log("dirListFromFileList: ", fileList);
    let dirList = {
        name: fileList.name,
        type: fileList.type,
        files: [],
    };
    fileList.files.forEach(file => {
        if (file.type == "dir") {
            dirList.files.push({
                name: file.name,
                type: file.type,
                files: dirListFromFileList(file)
            });
        }
    });
    return dirList;
}

export async function loadExplorer(path, api, appState, editor) {
    path = path.replace(/\/+/g, "/");
    if (path == null | path == undefined){
        path = "/";
    }
    if (path[path.length - 1] != "/") {
        path += "/";
    }
    let body = {
        action: "list-object",
        path: path,
    };
    await api("/api/file_manager.php", body=body)
    .then(async data =>  {
        if (data.status === "session_error") {
            sessionError();
            return;
        }
        appState.USER_ID = data.id;
        let prevFILE_LIST = appState.FILE_LIST;
        appState.FILE_LIST = data.files;
        editor.BASE_DIR = path;
        let dir = Path.join(appState.USER_ID, path);
        editor.explorer.setMenuTitle(dir);
        
        // エクスプローラー表示でファイルパスを設定
        await editor.explorer.loadExplorer(appState.FILE_LIST);
        
        // ファイルパス設定後にAceインスタンスをマージ
        if (prevFILE_LIST && prevFILE_LIST.files) {
            appState.FILE_LIST.files = mergeAceObjInFileList(appState.FILE_LIST.files, prevFILE_LIST.files, appState.ACE_LIST);
        }
    });
}

export function extToLang(ext, extLangMap) {
    let lang = ext;
    extLangMap.forEach(extLang => {
        if (extLang.ext.indexOf(ext) > -1) {
            lang = extLang.lang;
        }
    });
    return lang;
}

export async function loadFile(path, api) {
    let body = {
        action: "get",
        path: path
    };
    let ret;
    await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return;
        }
        if (data.status === "session_error") {
            sessionError();
            return;
        }
        ret = {
            content: data.content,
            fileType: data.fileType,
        };
    });
    return ret;
}

export async function saveFile(path, content, api, currentFile, mConsole, DEBUG, phpSyntaxCheck, editor) {
    if (currentFile.aceObj.editor.isDiffView) {
        mConsole.print("差分表示中は保存できません。", "warning");
        return 0;
    }
    DEBUG && console.log("saveFile: ", path, content);
    let body = {
        action: "save",
        path: path,
        content: content
    };
    let ret = 0;
    await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            mConsole.print("File save error: " + path, "error");
            ret = 0;
            return;
        }
        if (data.status === "session_error") {
            sessionError();
            ret = 0;
            return;
        }
        DEBUG && console.log("File saved");
        // 保存成功時のUI更新
        if (currentFile && currentFile.path === path) {
            currentFile.changed = false;
            if(editor && typeof editor.setFileIcon === 'function'){
                editor.setFileIcon(currentFile.path, null);
            }
            mConsole.print("File saved: " + currentFile.path, "success");
            phpSyntaxCheck(currentFile.path, api, DEBUG);
        }
        ret = 1;
    });
    return ret;
}

export async function renameFile(path, newPath, api, mConsole) {
    let ret;
    let body = {
        action: "rename",
        path: path,
        newPath: newPath,
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.newPath;
    });
    if(status == 1){
        mConsole.print("File rename error: " + path, "error");
        return false;
    }
    return ret;
}

export async function duplicateFile(path, api, mConsole) {
    let ret;
    let body = {
        action: "duplicate",
        path: path,
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.newPath;
    });
    if(status == 1){
        mConsole.print("File duplicate error: " + path, "error");
        return false;
    }
    return ret;
}

export async function deleteFile(path, api, mConsole) {
    let ret;
    let body = {
        action: "delete",
        path: path,
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.path;
    });
    if(status == 1){
        mConsole.print("File delete error: " + path, "error");
        return false;
    }
    return ret;
}

export async function createFile(path, api, mConsole) {
    let ret;
    
    let body = {
        action: "touch",
        path: path
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.path;
    });
    if(status == 1){
        mConsole.print("File create error: " + path, "error");
        return false;
    }
    return ret;
}

export async function createDir(path, api, mConsole) {
    let ret;

    let body = {
        action: "mkdir",
        path: path,
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.path;
    });
    if(status == 1){
        mConsole.print("Directory create error: " + path + "<br>Can not create a fire or directory having same name.", "error");
        return false;
    }
    return ret;
}

export async function renameDir(path, newPath, api, mConsole) {
    let ret;
    let body = {
        action: "rename",
        path: path,
        newPath: newPath,
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.newPath;
    });
    if(status == 1){
        mConsole.print("Directory rename error: " + path, "error");
        return false;
    }
    return ret;
}

export async function deleteDir(path, api, mConsole) {
    let ret;
    let body = {
        action: "deleteDir",
        path: path,
    };
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data.path;
    });
    if(status == 1){
        mConsole.print("Directory delete error: " + path, "error");
        return false;
    }
    return ret;
}

export async function uploadFiles(fileInput, dir, api, mConsole) {
    if (!dir){
        console.error("Directory is not specified");
        return false;
    }
    let ret;
    if (fileInput.files.length == 0) {
        console.error("No files selected");
        return false;
    }
    let files = fileInput.files;
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("path", dir);
    for (let i = 0; i < files.length; i++) {
        fd.append("files[]", files[i]);
    }
    await fetch("/api/file_upload.php", {
        method: "POST",
        body: fd,
    }).then(response => response.json()).then(data => {
        if (data.status === "error") {
            console.error(data.error);
            mConsole.print("File upload error", "error");
            ret = false;
            return;
        }
        if (data.status === "session_error") {
            sessionError();
            ret = false;
            return;
        }
        mConsole.print("Files uploaded successfully", "success");
        ret = true;
    }).then(() => {
        // ファイルリストを再読み込み
        //loadExplorer(editor.BASE_DIR);
    });
    return ret;
}

export async function runPhp(path, api, currentFile, saveFile, mConsole){
    if(!currentFile){
        return;
    }

    if(!currentFile.readonly){
        let res = await saveFile(path, currentFile.aceObj.editor.getValue());
        if(res) {
            mConsole.print("File saved: " + path, "success");
        }
    }

    let ret;
    let body = {
        action: "run",
        path: path,
    }
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data;
    });
    if(status == 1){
        mConsole.print("PHP run error: " + path, "error");
        return false;
    }

    if(ret.result){
        mConsole.print("PHP run error: " + path, "error");
    }
    else{
        mConsole.print("PHP run ok: " + path, "success");
    }
    ret.message.forEach(message => {
        const categoryStr = message.split(":")[0];
        if (categoryStr.indexOf("error") > -1) {
            mConsole.print(message.replaceAll("\n", "<br>"), "error");
        }
        else if (categoryStr.indexOf("warning") > -1) {
            mConsole.print(message.replaceAll("\n", "<br>"), "warning");
        }
        else {
            mConsole.print(message.replaceAll("\n", "<br>"), "info");
        }
    })
    return ret;
}

export async function runPhpCgi(path, GETParams={}, api, currentFile, saveFile, mConsole) {
    if(!currentFile){
        return;
    }

    if(!currentFile.readonly){
        let res = await saveFile(path, currentFile.aceObj.editor.getValue());
        if(res) {
            mConsole.print("File saved: " + path, "success");
        }
    }

    let ret;
    let body = {
        action: "cgi_run",
        path: path,
        GETParams: GETParams,
    }
    let status = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        ret = data;
    });
    if(status == 1){
        mConsole.print("PHP run error: " + path, "error");
        return false;
    }
    if(ret.result){
        mConsole.print("PHP run error: " + path, "error");
    }
    else{
        mConsole.print("PHP run ok: " + path, "success");
    }
    ret.message.forEach(message => {
        const categoryStr = message.split(":")[0];
        if (categoryStr.indexOf("error") > -1) {
            mConsole.print(message.replaceAll("\n", "<br>"), "error");
        }
        else if (categoryStr.indexOf("warning") > -1) {
            mConsole.print(message.replaceAll("\n", "<br>"), "warning");
        }
        else {
            mConsole.print(message.replaceAll("\n", "<br>"), "info");
        }
    })
    return ret;
}

export async function phpSyntaxCheck(path, api, DEBUG) {
    if (!path.endsWith('.php')) {
        return;
    }
    
    let body = {
        action: "syntax_check",
        path: path,
    };
    
    await api("/api/file_manager.php", body)
    .then(data => {
        if (data.status === "error") {
            DEBUG && console.error("PHP syntax check error:", data.error);
            return;
        }
        if (data.status === "session_error") {
            sessionError();
            return;
        }
        // 構文チェック結果の処理
        if (data.syntaxError) {
            DEBUG && console.log("PHP syntax error found:", data.message);
        } else {
            DEBUG && console.log("PHP syntax OK");
        }
    })
    .catch(error => {
        DEBUG && console.error("PHP syntax check failed:", error);
    });
}
