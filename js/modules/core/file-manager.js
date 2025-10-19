/**
 * ファイル管理機能
 */

import { sessionError } from '../utils/helpers.js';
import { Path } from '../utils/api.js';

/**
 * エクスプローラーで開いているファイルのハイライトを復元する
 * ファイルが含まれるディレクトリを自動的に展開してからハイライト表示する
 * @param {Object} appState - アプリケーションの状態
 * @param {Object} editor - エディタオブジェクト
 */
export function restoreFileHighlight(appState, editor) {
    if (!appState.CURRENT_FILE || 
        !appState.CURRENT_FILE.path || 
        !editor.explorer || 
        typeof editor.explorer.highlightFile !== 'function') {
        return;
    }
    
    const filePath = appState.CURRENT_FILE.path;
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    
    // ファイルが含まれるディレクトリを展開
    if (dirPath && dirPath !== editor.BASE_DIR) {
        const pathParts = dirPath.split('/').filter(p => p);
        let currentPath = '';
        
        for (const part of pathParts) {
            currentPath = currentPath + '/' + part;
            
            if (currentPath !== editor.BASE_DIR.replace(/\/$/, '')) {
                const dirElement = document.getElementById(currentPath + '/');
                
                if (dirElement) {
                    const dirName = dirElement.querySelector('.' + editor.CLASS_NAME_PREFIX + 'dir-name');
                    const dirContent = dirElement.querySelector('.' + editor.CLASS_NAME_PREFIX + 'dir-content');
                    const dirIcon = dirElement.querySelector('.' + editor.CLASS_NAME_PREFIX + 'dir-icon');
                    
                    if (dirName && dirContent) {
                        const isExpanded = dirName.classList.contains(editor.CLASS_NAME_PREFIX + 'dir-name-expanded');
                        
                        if (!isExpanded) {
                            dirName.classList.add(editor.CLASS_NAME_PREFIX + 'dir-name-expanded');
                            dirContent.classList.add(editor.CLASS_NAME_PREFIX + 'dir-content-show');
                            if (dirIcon) dirIcon.innerHTML = '▼';
                        }
                    }
                }
            }
        }
    }
    
    // ハイライトを即座に復元（遅延なし）
    editor.explorer.highlightFile(appState.CURRENT_FILE.path);
}

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
        // 関連するDOMノードも削除
        try {
            const domId = "ace-" + deletedFilePath;
            const node = document.getElementById(domId);
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        } catch (e) {
            console.error("Failed to remove ACE DOM for:", deletedFilePath, e);
        }
        // リストから削除
        aceList.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * 指定ディレクトリ配下のAceインスタンスを一括クリーンアップ
 */
export function cleanupAceInstancesInDir(dirPath, aceList) {
    if (!dirPath) return 0;
    // 末尾にスラッシュを確実に付与
    const base = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    let count = 0;
    // 後方から削除（インデックス崩れ防止）
    for (let i = aceList.length - 1; i >= 0; i--) {
        const fp = aceList[i].filePath || '';
        if (fp.startsWith(base)) {
            cleanupAceInstance(fp, aceList);
            count++;
        }
    }
    return count;
}

/**
 * 現在のファイル一覧に存在しないAceインスタンスをACE_LISTから除去
 */
export function pruneAceList(aceList, rootFileList) {
    if (!rootFileList || !rootFileList.files || !Array.isArray(aceList)) return aceList;
    const valid = new Set();
    const walk = (files) => {
        files.forEach(f => {
            if (f.type === 'dir') {
                walk(f.files || []);
            } else if (f.path) {
                valid.add(f.path);
            }
        });
    };
    walk(rootFileList.files);
    for (let i = aceList.length - 1; i >= 0; i--) {
        const fp = aceList[i].filePath;
        if (!valid.has(fp)) {
            cleanupAceInstance(fp, aceList);
        }
    }
    return aceList;
}

/**
 * 同一パスに対するAceインスタンスの重複を排除（最後の1つだけ残す）
 */
export function dedupeAceListByPath(aceList) {
    if (!Array.isArray(aceList)) return aceList;
    const kept = new Set();
    for (let i = aceList.length - 1; i >= 0; i--) {
        const fp = aceList[i].filePath;
        if (kept.has(fp)) {
            // 先頭側の重複を削除
            cleanupAceInstance(fp, aceList);
        } else {
            kept.add(fp);
        }
    }
    return aceList;
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
        
        // サーバーから最新データを取得したのでクライアント側の更新時刻をクリア
        clearClientMtimes();
        
        // ソート設定を取得してファイルリストをソート
        const sortSettings = getSortSettings();
        if (appState.FILE_LIST && appState.FILE_LIST.files) {
            appState.FILE_LIST.files = sortFiles(appState.FILE_LIST.files, sortSettings.sortBy, sortSettings.order);
        }
        
        // エクスプローラー表示でファイルパスを設定
        await editor.explorer.loadExplorer(appState.FILE_LIST);
        
    // ファイルパス設定後にAceインスタンスをマージ
        if (prevFILE_LIST && prevFILE_LIST.files) {
            appState.FILE_LIST.files = mergeAceObjInFileList(appState.FILE_LIST.files, prevFILE_LIST.files, appState.ACE_LIST);
        }
    // 現在のツリーに存在しないAceを掃除（削除済みや移動済みの孤立インスタンス）
    pruneAceList(appState.ACE_LIST, appState.FILE_LIST);
    // 同一パスの重複Aceを排除
    dedupeAceListByPath(appState.ACE_LIST);
    
        // エクスプローラーリロード後、現在開いているファイルのハイライトを復元
        restoreFileHighlight(appState, editor);
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

export async function saveFile(path, content, api, currentFile, mConsole, DEBUG, phpSyntaxCheck, editor, appState = null) {
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
            
            // クライアント側の更新時刻を記録
            updateClientMtime(currentFile.path);
            
            // mtimeソート時はエクスプローラーを再ソート
            if (appState) {
                refreshExplorerSort(appState, editor);
            }
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
            //mConsole.print("File saved: " + path, "success");
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

export async function runPhpCgi(path, GETParams={}, api, currentFile, saveFile, mConsole, options={}) {
    if(!currentFile){
        return;
    }

    if(!currentFile.readonly && currentFile.changed){
        let res = await saveFile(path, currentFile.aceObj.editor.getValue());
        if(res) {
            //mConsole.print("File saved: " + path, "success");
        }
    }

    // オプションからHTTPメソッド、POSTパラメータ、Content-Type、完了後コールバックを取得
    const method = options.method || "GET";
    const POSTParams = options.POSTParams || {};
    const contentType = options.contentType || "application/x-www-form-urlencoded";
    const onComplete = options.onComplete || null; // 実行完了後のコールバック

    let ret;
    let body = {
        action: "cgi_run",
        path: path,
        method: method,
        GETParams: GETParams,
        POSTParams: POSTParams,
        contentType: contentType
    };
    
    // メソッド情報をコンソールに表示
    if (method !== "GET") {
        mConsole.print(`Running PHP with ${method} method...`, "info");
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
    
    // 実行完了後のコールバックを実行
    if (onComplete && typeof onComplete === 'function') {
        try {
            await onComplete(ret);
        } catch (error) {
            console.error('Error in onComplete callback:', error);
        }
    }
    
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

/**
 * ファイルリストをソートする
 * @param {Array} files - ソート対象のファイル配列
 * @param {string} sortBy - ソート基準 ('name' or 'mtime')
 * @param {string} order - ソート順 ('asc' or 'desc')
 * @returns {Array} - ソート済みのファイル配列
 */
export function sortFiles(files, sortBy = 'name', order = 'asc') {
    if (!files || !Array.isArray(files)) {
        return files;
    }

    // ファイルのコピーを作成してソート（元の配列を変更しない）
    const sortedFiles = [...files];

    sortedFiles.sort((a, b) => {
        // ディレクトリを常に上位に表示
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;

        let comparison = 0;

        if (sortBy === 'name') {
            // ファイル名でソート（大文字小文字を区別しない）
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            comparison = nameA.localeCompare(nameB);
        } else if (sortBy === 'mtime') {
            // 最終更新時刻でソート
            const mtimeA = a.mtime || 0;
            const mtimeB = b.mtime || 0;
            comparison = mtimeA - mtimeB;
        }

        // 昇順/降順の適用
        return order === 'desc' ? -comparison : comparison;
    });

    // ディレクトリの子要素も再帰的にソート
    sortedFiles.forEach(file => {
        if (file.type === 'dir' && file.files && Array.isArray(file.files)) {
            file.files = sortFiles(file.files, sortBy, order);
        }
    });

    return sortedFiles;
}

/**
 * ソート設定を取得する
 * @returns {Object} - { sortBy: string, order: string }
 */
export function getSortSettings() {
    const defaultSettings = { sortBy: 'name', order: 'asc' };
    try {
        const saved = localStorage.getItem('explorerSortSettings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load sort settings:', e);
    }
    return defaultSettings;
}

/**
 * ソート設定を保存する
 * @param {string} sortBy - ソート基準
 * @param {string} order - ソート順
 */
export function saveSortSettings(sortBy, order) {
    try {
        localStorage.setItem('explorerSortSettings', JSON.stringify({ sortBy, order }));
    } catch (e) {
        console.error('Failed to save sort settings:', e);
    }
}

// クライアント側の更新時刻をメモリ上で管理（エクスプローラー再リロードまでの一時的なデータ）
let clientMtimes = {};

/**
 * クライアント側でのファイル更新時刻を記録（メモリ上のみ）
 * @param {string} filePath - ファイルパス
 */
export function updateClientMtime(filePath) {
    clientMtimes[filePath] = Date.now();
}

/**
 * クライアント側の更新時刻をクリア（エクスプローラー再リロード時に呼ぶ）
 */
export function clearClientMtimes() {
    clientMtimes = {};
}

/**
 * クライアント側の更新時刻をファイルリストにマージ
 * @param {Array} files - ファイルリスト
 * @returns {Array} - 更新時刻がマージされたファイルリスト
 */
export function mergeClientMtimes(files) {
    if (!files || !Array.isArray(files)) {
        return files;
    }
    
    return files.map(file => {
        const updatedFile = { ...file };
        
        // ファイルパスがクライアント側の更新時刻にあれば上書き
        if (file.path && clientMtimes[file.path]) {
            updatedFile.mtime = Math.floor(clientMtimes[file.path] / 1000); // ミリ秒を秒に変換
            updatedFile.clientModified = true; // クライアント側で更新されたことを示すフラグ
        }
        
        // ディレクトリの子要素も再帰的に処理
        if (file.type === 'dir' && file.files && Array.isArray(file.files)) {
            updatedFile.files = mergeClientMtimes(file.files);
        }
        
        return updatedFile;
    });
}

/**
 * エクスプローラーを再ソートして再描画
 * @param {Object} appState - アプリケーション状態
 * @param {Object} editor - MEditorインスタンス
 */
export function refreshExplorerSort(appState, editor) {
    if (!appState.FILE_LIST || !appState.FILE_LIST.files) {
        return;
    }
    
    // クライアント側の更新時刻をマージ
    appState.FILE_LIST.files = mergeClientMtimes(appState.FILE_LIST.files);
    
    // ソート設定を取得してファイルリストをソート
    const sortSettings = getSortSettings();
    if (sortSettings.sortBy === 'mtime') {
        appState.FILE_LIST.files = sortFiles(appState.FILE_LIST.files, sortSettings.sortBy, sortSettings.order);
        
        // エクスプローラーを再描画
        editor.explorer.loadExplorer(appState.FILE_LIST);
        
        // 再描画後、現在開いているファイルのハイライトを復元
        restoreFileHighlight(appState, editor);
    }
}
