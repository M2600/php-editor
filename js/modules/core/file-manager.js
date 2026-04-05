/**
 * ファイル管理機能
 */

import { sessionError } from '../utils/helpers.js';
import { Path } from '../utils/api.js';
import { isPrivateFile } from './config.js';

/**
 * ファイルリストに非公開フラグとパスを追加する（再帰的）
 * @param {Array} fileList - ファイルリスト
 * @param {string} parentPath - 親ディレクトリのパス（デフォルト: '/'）
 * @returns {Array} 非公開フラグとパスが追加されたファイルリスト
 */
export function markPrivateFiles(fileList, parentPath = '/') {
    if (!fileList || !Array.isArray(fileList)) {
        return fileList;
    }
    
    return fileList.map(file => {
        // ファイルのフルパスを構築
        const fullPath = parentPath + file.name;
        const isPrivate = isPrivateFile(fullPath);
        
        // フラグとパスを追加
        const markedFile = {
            ...file,
            isPrivate: isPrivate,
            path: fullPath  // パスを明示的に追加
        };
        
        // ディレクトリの場合は再帰的に処理
        if (file.type === 'dir' && file.files && Array.isArray(file.files)) {
            // ディレクトリの場合、パスの末尾に/を付ける
            const dirPath = fullPath.endsWith('/') ? fullPath : fullPath + '/';
            markedFile.files = markPrivateFiles(file.files, dirPath);
        }
        
        return markedFile;
    });
}

/**
 * ファイルリストから指定されたパスのファイルが存在するか確認する
 * ネストされた構造にも対応
 * @param {Array} fileList - ファイルリスト
 * @param {string} targetPath - 検索対象のファイルパス
 * @returns {boolean} ファイルが存在する場合true
 */
export function fileExistsInList(fileList, targetPath) {
    if (!fileList || !Array.isArray(fileList)) {
        return false;
    }
    
    for (let file of fileList) {
        if (file.path === targetPath) {
            return true;
        }
        // ディレクトリの場合は再帰的に検索
        if (file.type === "dir" && file.files && Array.isArray(file.files)) {
            if (fileExistsInList(file.files, targetPath)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * ファイルリストから指定されたパスのファイル情報を取得する
 * ネストされた構造にも対応
 * @param {Array} fileList - ファイルリスト
 * @param {string} targetPath - 検索対象のファイルパス
 * @returns {Object|null} ファイル情報オブジェクト、見つからない場合null
 */
export function findFileInList(fileList, targetPath) {
    if (!fileList || !Array.isArray(fileList)) {
        return null;
    }
    
    for (let file of fileList) {
        if (file.path === targetPath) {
            return file;
        }
        // ディレクトリの場合は再帰的に検索
        if (file.type === "dir" && file.files && Array.isArray(file.files)) {
            const found = findFileInList(file.files, targetPath);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

/** ファイル名のみの場合フルパスを返す
 * @param {string} fileName - ファイル名
 * @param {string} dirPath - ディレクトリパス
 * @returns {string} フルパス
 */
export function getFullPath(fileName, dirPath) {
    // ファイル名がフルパスの場合(/から始まる)の場合はそのまま返す
    if (fileName.startsWith('/')) {
        return fileName;
    }
    if (dirPath.endsWith('/')) {
        return `${dirPath}${fileName}`;
    }
    return `${dirPath}/${fileName}`;
}

/**
 * ファイル名に番号を付けて別の名前を生成する
 * 例: "file.txt" → "file(1).txt", "file(2).txt" など
 * @param {string} originalPath - 元のパス（例: "/dir/file.txt"）
 * @param {Array} fileList - ファイルリスト
 * @returns {string} 新しいパス
 */
export function generateUniqueFileName(originalPath, fileList) {
    const lastSlashIndex = originalPath.lastIndexOf('/');
    const dirPath = originalPath.substring(0, lastSlashIndex + 1);
    const fileName = originalPath.substring(lastSlashIndex + 1);
    
    // ファイル名と拡張子に分割
    const lastDotIndex = fileName.lastIndexOf('.');
    let baseName, ext;
    if (lastDotIndex > 0) {
        baseName = fileName.substring(0, lastDotIndex);
        ext = fileName.substring(lastDotIndex);
    } else {
        baseName = fileName;
        ext = '';
    }
    
    // 番号を付けたファイル名を試す
    let counter = 1;
    let newPath;
    while (counter <= 1000) {
        newPath = `${dirPath}${baseName}(${counter})${ext}`;
        if (!fileExistsInList(fileList, newPath)) {
            return newPath;
        }
        counter++;
    }
    
    // 万が一1000回まで失敗した場合はタイムスタンプを使用
    return `${dirPath}${baseName}(${Date.now()})${ext}`;
}

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

    // URLのクエリパラメータを更新
    let url = new URL(window.location.href);
    url.searchParams.set("dir", path);
    window.history.pushState({}, "", url);

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
        //editor.explorer.setMenuTitle(dir);
        editor.explorer.setTitle(dir);
        
        
        // サーバーから最新データを取得したのでクライアント側の更新時刻をクリア
        clearClientMtimes();
        
        // ソート設定を取得してファイルリストをソート
        const sortSettings = getSortSettings();
        if (appState.FILE_LIST && appState.FILE_LIST.files) {
            appState.FILE_LIST.files = sortFiles(appState.FILE_LIST.files, sortSettings.sortBy, sortSettings.order);
        }
        
        // 非公開ファイルのマーキング（パスとisPrivateフラグを追加）
        if (appState.FILE_LIST && appState.FILE_LIST.files) {
            appState.FILE_LIST.files = markPrivateFiles(appState.FILE_LIST.files, path);
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
            console.error(data.message);
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
            if(editor && typeof editor.removeFileIcon === 'function'){
                editor.removeFileIcon(currentFile.path, '*');
            }
            mConsole.print("File saved: " + currentFile.path, "success");
            phpSyntaxCheck(currentFile.path, api, DEBUG, mConsole);
            
            // クライアント側の更新時刻を記録
            updateClientMtime(currentFile.path);
            
            // mtimeソート時はエクスプローラーを再ソート
            if (appState) {
                refreshExplorerSort(appState, editor);
                // 保存したファイルのハイライトを復元
                // （別のファイルを開く場合は、openFile側でハイライトが更新される）
                restoreFileHighlight(appState, editor);
            }
        }
        ret = 1;
    });
    return ret;
}

export async function renameFile(path, newPath, api, mConsole) {

    if (!path || !newPath) {
        mConsole.print("Invalid file paths.", "error");
        return false;
    }

    // newPathが相対パスの場合、pathを基準にフルパスに変換
    const fileDir = path.substr(0, path.lastIndexOf("/")) || '/';
    const newFullPath = getFullPath(newPath, fileDir);

    let ret;
    let body = {
        action: "rename",
        path: path,
        newPath: newFullPath,
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

export async function duplicateFile(path, newPath, api, mConsole) {
    let ret;
    let body = {
        action: "duplicate",
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

export async function uploadFiles(fileInput, dir, api, mConsole, filesToRename = []) {
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
    
    console.log(`Uploading ${files.length} files to ${dir}`);
    
    // PHPの max_file_uploads 制限に対応するため、バッチ処理
    const BATCH_SIZE = 20; // 安全のため20ファイルずつ
    const totalFiles = files.length;
    let uploadedCount = 0;
    let allErrors = [];
    
    // ファイルをバッチに分割
    for (let batchStart = 0; batchStart < totalFiles; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalFiles);
        const batchFiles = Array.from(files).slice(batchStart, batchEnd);
        
        console.log(`Uploading batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: files ${batchStart + 1}-${batchEnd} of ${totalFiles}`);
        
        const fd = new FormData();
        fd.append("action", "upload");
        fd.append("path", dir);
        
        // このバッチに該当するファイル名変更マップを作成
        const batchRenames = [];
        const hasRelativePath = batchFiles[0] && batchFiles[0].webkitRelativePath;
        
        console.log('filesToRename type:', Array.isArray(filesToRename) ? 'array' : typeof filesToRename, 'value:', filesToRename);
        
        if (filesToRename) {
            if (hasRelativePath && !Array.isArray(filesToRename)) {
                // フォルダアップロード: 単一オブジェクトが渡される
                // すべてのファイルの相対パスの最上位フォルダ名を置換
                console.log('Folder rename (single object):', JSON.stringify(filesToRename));
                batchRenames.push(filesToRename);
            } else if (Array.isArray(filesToRename) && filesToRename.length > 0) {
                // 個別ファイルアップロード: 配列が渡される
                console.log('File rename (array):', JSON.stringify(filesToRename));
                for (let i = batchStart; i < batchEnd; i++) {
                    const file = files[i];
                    const fileName = file.name;
                    const rename = filesToRename.find(r => r.original === fileName);
                    if (rename) {
                        console.log(`File to rename in batch: ${rename.original} -> ${rename.renamed}`);
                        batchRenames.push(rename);
                    }
                }
            }
        }
        
        if (batchRenames.length > 0) {
            console.log('Batch renames to send:', JSON.stringify(batchRenames));
            fd.append("fileRenames", JSON.stringify(batchRenames));
        }
        
        // フォルダアップロードの場合、このバッチの相対パスマップを作成
        if (hasRelativePath) {
            const relativePathMap = [];
            batchFiles.forEach((file, idx) => {
                const relativePath = file.webkitRelativePath || file.name;
                relativePathMap.push(relativePath);
                console.log(`Batch file ${batchStart + idx}: ${relativePath} (${file.size} bytes)`);
            });
            fd.append("relativePaths", JSON.stringify(relativePathMap));
        } else {
            batchFiles.forEach((file, idx) => {
                console.log(`Batch file ${batchStart + idx}: ${file.name} (${file.size} bytes)`);
            });
        }
        
        batchFiles.forEach(file => {
            fd.append("files[]", file);
        });
        
        try {
            const response = await fetch("/api/file_upload.php", {
                method: "POST",
                body: fd,
            });
            
            const data = await response.json();
            
            if (data.status === "error") {
                console.error("Batch upload error:", data.error);
                mConsole.print(`Batch upload error: ${data.error}`, "error");
                allErrors.push(`Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${data.error}`);
                continue; // 次のバッチへ
            }
            
            if (data.status === "session_error") {
                sessionError();
                return false;
            }
            
            console.log(`Batch uploaded successfully: ${data.uploaded} files`);
            uploadedCount += data.uploaded || 0;
            
            // バッチ内のエラーを記録
            if (data.errors && data.errors.length > 0) {
                console.warn("Batch errors:", data.errors);
                allErrors.push(...data.errors);
            }
            
        } catch (error) {
            console.error("Batch upload fetch error:", error);
            allErrors.push(`Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: Network error`);
        }
        
        // 進捗表示
        if (totalFiles > BATCH_SIZE) {
            mConsole.print(`Progress: ${uploadedCount}/${totalFiles} files uploaded...`, "info");
        }
    }
    
    // 最終結果を表示
    if (allErrors.length > 0) {
        mConsole.print(`${uploadedCount}/${totalFiles} files uploaded successfully`, "warning");
        mConsole.print(`${allErrors.length} errors occurred`, "error");
        console.warn("Upload errors:", allErrors);
        ret = uploadedCount > 0; // 一部成功していれば true
    } else {
        mConsole.print(`${uploadedCount} files uploaded successfully`, "success");
        ret = true;
    }
    
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

export async function phpSyntaxCheck(path, api, DEBUG, mConsole=null) {
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
        if (data.result) {
            DEBUG && console.log("PHP syntax error found:", data.message);
            if (mConsole){
                data.message.forEach(message => {
                    mConsole.print(message.replaceAll("\n", "<br>"), "error");
                });
            }
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
        
        // 注意: ハイライト復元は呼び出し元で明示的に行う
        // ファイル保存後に別のファイルを開く場合、ここで古いファイルをハイライトしてしまう問題を避けるため
    }
}
