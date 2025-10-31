/**
 * UI ダイアログ機能
 */

import { hideAllPreviewer, getParentDir, getCurrentPath } from '../utils/helpers.js';
import { APP_STATE } from '../core/config.js';
import { 
    renameFile, 
    deleteFile, 
    createFile, 
    createDir, 
    renameDir, 
    deleteDir, 
    uploadFiles,
    loadExplorer,
    cleanupAceInstance,
    cleanupAceInstancesInDir,
    fileExistsInList,
    generateUniqueFileName
} from '../core/file-manager.js';

// ポップアップ重複チェック関数
function checkWindowExists(windowName, editor, DEBUG) {
    let windowExists = false;
    DEBUG && console.log("popup windows: ", editor.page.popupWindows);
    editor.page.popupWindows.forEach((popup) => {
        if (popup.title == windowName) {
            DEBUG && console.log("popup window already exists");
            windowExists = true;
            return;
        }
    });
    return windowExists;
}

/**
 * ファイル名の妥当性をチェック
 * @param {string} fileName - チェック対象のファイル名
 * @returns {Object} { valid: boolean, message: string }
 */
function validateFileName(fileName) {
    if (!fileName || fileName.trim() === "") {
        return { valid: false, message: "ファイル名を入力してください" };
    }
    
    // 特殊文字のチェック（ファイルシステムで使用禁止の文字）
    const invalidChars = /[<>:"|?*\\\s]/;
    if (invalidChars.test(fileName)) {
        return { valid: false, message: "使用できない文字が含まれています: < > : \" | ? * \\ スペース" };
    }
    
    // ドットのみの場合（.や..）
    if (/^\.+$/.test(fileName)) {
        return { valid: false, message: "ファイル名として無効です" };
    }
    
    return { valid: true, message: "" };
}

export function renameFileDialog(path, editor, api, mConsole, DEBUG) {
    let windowName = "Rename file";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }

    let rename = async () => {
        const newPath = input.value.startsWith('/') ? input.value : '/' + input.value;
        console.log("Rename: ", path, " -> ", newPath);
        DEBUG && console.log("popup window: ", popupWindow);
        
        // ファイル名の妥当性をチェック
        const fileName = input.value.startsWith('/') ? input.value.substring(1) : input.value;
        const validation = validateFileName(fileName);
        if (!validation.valid) {
            mConsole.print("Error: " + validation.message, "error");
            return;
        }
        
        // 同名のファイルが既に存在するかチェック（元のパスと異なる場合のみ）
        if (path !== newPath && fileExistsInList(APP_STATE.FILE_LIST.files, newPath)) {
            mConsole.print("Error: A file with the same name already exists: " + newPath, "error");
            return;
        }
        
        popupWindow.remove();
        hideAllPreviewer();
        const renamedPath = await renameFile(path, newPath, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
        
        // リネーム成功時、新しいファイル名でファイルを開く
        if (renamedPath && editor.explorer && editor.explorer.files && Array.isArray(editor.explorer.files)) {
            // renamedPathが相対パスの場合、先頭に/を追加
            const normalizedPath = renamedPath.startsWith('/') ? renamedPath : '/' + renamedPath;
            const fileInfo = editor.explorer.files.find(f => f.path === normalizedPath);
            if (fileInfo && typeof editor.explorer.fileClickAction === 'function') {
                editor.explorer.fileClickAction(fileInfo);
            }
            editor.explorer.highlightFile(normalizedPath);
        }
    }

    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "File name";
    input.value = path;
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    
    // ステータスメッセージ要素（警告のみ表示）
    let statusMessage = document.createElement("div");
    statusMessage.style.marginTop = ".3rem";
    statusMessage.style.marginBottom = ".5rem";
    statusMessage.style.color = "red";
    statusMessage.style.fontSize = "0.85em";
    statusMessage.style.display = "none";
    contents.appendChild(statusMessage);
    
    // 入力値の変更を監視
    input.addEventListener("input", () => {
        const newPath = input.value.startsWith('/') ? input.value : '/' + input.value;
        const fileName = input.value.startsWith('/') ? input.value.substring(1) : input.value;
        
        // ファイル名の妥当性をチェック
        const validation = validateFileName(fileName);
        if (!validation.valid) {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "❌ " + validation.message;
            return;
        }
        
        // 元のパスと同じか、ファイルが使用可能な場合
        if (path === newPath || !fileExistsInList(APP_STATE.FILE_LIST.files, newPath)) {
            statusMessage.style.display = "none";
        }
        // 同名のファイルが存在する場合
        else {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "⚠️ このファイル名は既に使用されています";
        }
    });
    
    input.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            rename();
        }
    });
    contents.appendChild(input);
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    let renameButton = document.createElement("button");
    renameButton.innerHTML = "Rename";
    renameButton.classList.add("meditor-button");
    renameButton.addEventListener("click", async () => {
        await rename();
    });
    controls.appendChild(renameButton);
    let popupWindow = editor.popupWindow(windowName, contents, {
        width: "20em"
    });
    input.focus();
}

export function moveFileDialog(file, editor, api, mConsole, fileList) {
    const parent = {};
    parent.element = document.getElementById(file.path);
    console.log("parent: ", parent);
    let options = [];
    console.log("Move file: ", file);
    
    // If current dir is not root, add ".." to the list
    if(editor.BASE_DIR != "/"){
        options.push({
            text: "../",
            title: getParentDir(editor.BASE_DIR),
            clickAction: async (e) => {
                let targetDir = getParentDir(editor.BASE_DIR);
                let newPath = Path.joinAsFile(targetDir, file.name);
                
                // 同名ファイルが存在する場合は、ユニークなファイル名に変更
                if (fileExistsInList(APP_STATE.FILE_LIST.files, newPath)) {
                    newPath = generateUniqueFileName(newPath, APP_STATE.FILE_LIST.files);
                    mConsole.print(`File renamed to "${newPath.substring(newPath.lastIndexOf('/') + 1)}" as same name already exists`, "info");
                }
                
                console.log("Move file to: ", file.path, newPath);
                await renameFile(file.path, newPath, api, mConsole);
                await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
            }
        })
    }
    
    // If dir of file is not current dir, add current dir to the list
    if(getParentDir(file.path) != editor.BASE_DIR){
        options.push({
            text: "./",
            title: editor.BASE_DIR,
            clickAction: async (e) => {
                let newPath = Path.joinAsFile(editor.BASE_DIR, file.name);
                
                // 同名ファイルが存在する場合は、ユニークなファイル名に変更
                if (fileExistsInList(APP_STATE.FILE_LIST.files, newPath)) {
                    newPath = generateUniqueFileName(newPath, APP_STATE.FILE_LIST.files);
                    mConsole.print(`File renamed to "${newPath.substring(newPath.lastIndexOf('/') + 1)}" as same name already exists`, "info");
                }
                
                console.log("Move file to: ", file.path, newPath);
                await renameFile(file.path, newPath, api, mConsole);
                await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
            }
        });
    }
    
    fileList.files.forEach(f => {
        if (f.type == "dir") {
            options.push({
                text: "./" + f.name + "/",
                title: f.path,
                clickAction: async (e) => {
                    let newPath = Path.joinAsFile(f.path, file.name);
                    
                    // 同名ファイルが存在する場合は、ユニークなファイル名に変更
                    if (fileExistsInList(APP_STATE.FILE_LIST.files, newPath)) {
                        newPath = generateUniqueFileName(newPath, APP_STATE.FILE_LIST.files);
                        mConsole.print(`File renamed to "${newPath.substring(newPath.lastIndexOf('/') + 1)}" as same name already exists`, "info");
                    }
                    
                    console.log("Move file to: ", file.path, newPath);
                    await renameFile(file.path, newPath, api, mConsole);
                    await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
                }
            });
        }
    });
    
    let moveMenu = editor.popupMenu(parent, options);
    return moveMenu;
}

export function deleteFileDialog(path, editor, api, mConsole, currentFile, DEBUG) {
    let windowName = "Delete file";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }
    
    let contents = document.createElement("div");
    let message = document.createElement("div");
    message.innerHTML = path + ": 本当に削除しますか？";
    contents.appendChild(message);
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    let deleteButton = document.createElement("button");
    deleteButton.innerHTML = "Delete";
    deleteButton.classList.add("meditor-button");
    deleteButton.addEventListener("click", async () => {
        console.log("Delete: ", path);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        
        // 削除前にAceインスタンスをクリーンアップ
        cleanupAceInstance(path, APP_STATE.ACE_LIST);
        
        await deleteFile(path, api, mConsole);
        if(currentFile.path == path){
            currentFile = false;
            hideAllPreviewer();
        }
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });
    controls.appendChild(deleteButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}

export function newFileDialog(dir, editor, api, mConsole, currentFile, saveFile, DEBUG){
    let windowName = "新しいファイル";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }
    
    let currentDir;
    if(!dir){
        currentDir = getCurrentPath(editor.BASE_DIR);
    }
    else{
        currentDir = dir.path;
        if(currentDir[currentDir.length - 1] != "/"){
            currentDir += "/";
        }
    }

    let create = async () => {
        const newFilePath = currentDir + input.value;
        console.log("Create: ", newFilePath);
        DEBUG && console.log("popup window: ", popupWindow);
        
        // ファイル名の妥当性をチェック
        const validation = validateFileName(input.value);
        if (!validation.valid) {
            mConsole.print("Error: " + validation.message, "error");
            return;
        }
        
        // 同名のファイルが既に存在するかチェック
        if (fileExistsInList(APP_STATE.FILE_LIST.files, newFilePath)) {
            mConsole.print("Error: A file with the same name already exists: " + newFilePath, "error");
            return;
        }
        
        popupWindow.remove();
        if(currentFile && !currentFile.readonly){
            await saveFile(currentFile.path, currentFile.aceObj.editor.getValue());
            mConsole.print("File saved: " + currentFile.path, "success");
        }
        hideAllPreviewer();
        await createFile(newFilePath, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
        
        // 新規作成したファイルを自動で開く
        if (editor.explorer && editor.explorer.files && Array.isArray(editor.explorer.files)) {
            const fileInfo = editor.explorer.files.find(f => f.path === newFilePath);
            if (fileInfo && typeof editor.explorer.fileClickAction === 'function') {
                editor.explorer.fileClickAction(fileInfo);
            }
            editor.explorer.highlightFile(newFilePath);
        }
    }

    console.log("New file: " + currentDir);
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "ファイル名";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    
    // ステータスメッセージ要素（警告のみ表示）
    let statusMessage = document.createElement("div");
    statusMessage.style.marginTop = ".3rem";
    statusMessage.style.marginBottom = ".5rem";
    statusMessage.style.color = "red";
    statusMessage.style.fontSize = "0.85em";
    statusMessage.style.display = "none";
    contents.appendChild(statusMessage);
    
    // 入力値の変更を監視
    input.addEventListener("input", () => {
        const newFilePath = currentDir + input.value;
        
        // ファイル名の妥当性をチェック
        const validation = validateFileName(input.value);
        if (!validation.valid) {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "❌ " + validation.message;
            return;
        }
        
        // 同名ファイルのチェック
        if (input.value === "" || !fileExistsInList(APP_STATE.FILE_LIST.files, newFilePath)) {
            statusMessage.style.display = "none";
        } else {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "⚠️ このファイル名は既に使用されています";
        }
    });
    
    input.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            create();
        }
    });
    contents.appendChild(input);
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    let createButton = document.createElement("button");
    createButton.innerHTML = "作成";
    createButton.classList.add("meditor-button");
    createButton.addEventListener("click", async () => {
        await create();
    });
    controls.appendChild(createButton);
    let popupWindow = editor.popupWindow(windowName, contents, {
        width: "20em"
    });
    input.focus();
}

export function newDirDialog(dir, editor, api, mConsole, DEBUG) {
    DEBUG && console.log(dir);
    let windowName = "New folder";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }

    let currentDir;
    if(!dir){
        currentDir = getCurrentPath(editor.BASE_DIR);
    }
    else{
        currentDir = dir.path;
        if(currentDir[currentDir.length - 1] != "/"){
            currentDir += "/";
        }
    }

    let create = async () => {
        const newDirPath = currentDir + input.value;
        console.log("Create: ", newDirPath);
        DEBUG && console.log("popup window: ", popupWindow);
        
        // ファイル名の妥当性をチェック
        const validation = validateFileName(input.value);
        if (!validation.valid) {
            mConsole.print("Error: " + validation.message, "error");
            return;
        }
        
        // 同名のフォルダが既に存在するかチェック
        if (fileExistsInList(APP_STATE.FILE_LIST.files, newDirPath + "/")) {
            mConsole.print("Error: A folder with the same name already exists: " + newDirPath, "error");
            return;
        }
        
        popupWindow.remove();
        await createDir(newDirPath, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    }

    console.log("New folder: " + currentDir);
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Folder name";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    
    // ステータスメッセージ要素（警告のみ表示）
    let statusMessage = document.createElement("div");
    statusMessage.style.marginTop = ".3rem";
    statusMessage.style.marginBottom = ".5rem";
    statusMessage.style.color = "red";
    statusMessage.style.fontSize = "0.85em";
    statusMessage.style.display = "none";
    contents.appendChild(statusMessage);
    
    // 入力値の変更を監視
    input.addEventListener("input", () => {
        const newDirPath = currentDir + input.value;
        
        // ファイル名の妥当性をチェック
        const validation = validateFileName(input.value);
        if (!validation.valid) {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "❌ " + validation.message;
            return;
        }
        
        // 同名フォルダのチェック
        if (input.value === "" || !fileExistsInList(APP_STATE.FILE_LIST.files, newDirPath + "/")) {
            statusMessage.style.display = "none";
        } else {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "⚠️ このフォルダ名は既に使用されています";
        }
    });
    
    input.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            create();
        }
    });
    contents.appendChild(input);
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    let createButton = document.createElement("button");
    createButton.innerHTML = "Create";
    createButton.classList.add("meditor-button");
    createButton.addEventListener("click", async () => {
        await create();
    });
    controls.appendChild(createButton);
    let popupWindow = editor.popupWindow(windowName, contents);
    input.focus();
}

export function renameDirDialog(path, editor, api, mConsole, DEBUG) {
    let windowName = "Rename folder";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }

    let rename = async () => {
        console.log("Rename: ", path);
        DEBUG && console.log("popup window: ", popupWindow);
        
        // ファイル名の妥当性をチェック
        const validation = validateFileName(input.value);
        if (!validation.valid) {
            mConsole.print("Error: " + validation.message, "error");
            return;
        }
        
        popupWindow.remove();
        await renameDir(path, input.value, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    }

    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Folder name";
    input.value = path;
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    
    // ステータスメッセージ要素（警告のみ表示）
    let statusMessage = document.createElement("div");
    statusMessage.style.marginTop = ".3rem";
    statusMessage.style.marginBottom = ".5rem";
    statusMessage.style.color = "red";
    statusMessage.style.fontSize = "0.85em";
    statusMessage.style.display = "none";
    contents.appendChild(statusMessage);
    
    // 入力値の変更を監視
    input.addEventListener("input", () => {
        // ファイル名の妥当性をチェック
        const validation = validateFileName(input.value);
        if (!validation.valid) {
            statusMessage.style.display = "block";
            statusMessage.innerHTML = "❌ " + validation.message;
        } else {
            statusMessage.style.display = "none";
        }
    });
    
    input.addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            rename();
        }
    });
    contents.appendChild(input);
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    let renameButton = document.createElement("button");
    renameButton.innerHTML = "Rename";
    renameButton.classList.add("meditor-button");
    renameButton.addEventListener("click", async () => {
        await rename();
    });
    controls.appendChild(renameButton);
    let popupWindow = editor.popupWindow(windowName, contents);
    input.focus();
}

export function deleteDirDialog(path, editor, api, mConsole, DEBUG) {
    let windowName = "Delete folder";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }
    
    let contents = document.createElement("div");
    let message = document.createElement("div");
    message.innerHTML = path + ": フォルダ内のファイルも削除されます。本当に削除しますか？";
    contents.appendChild(message);
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    let deleteButton = document.createElement("button");
    deleteButton.innerHTML = "Delete";
    deleteButton.classList.add("meditor-button");
    deleteButton.addEventListener("click", async () => {
        console.log("Delete: ", path);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
    // ディレクトリ配下のAceを事前にクリーンアップ
    cleanupAceInstancesInDir(path, APP_STATE.ACE_LIST);
        await deleteDir(path, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });
    controls.appendChild(deleteButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}

export function fileUploadDialog(dir, editor, api, mConsole, DEBUG) {
    let path;
    if(!dir){
        path = getCurrentPath(editor.BASE_DIR);
    }
    else{
        path = dir.path;
        if(path[path.length - 1] != "/"){
            path += "/";
        }
    }
    
    let windowName = "Upload files";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }

    let contents = document.createElement("div");
    contents.style.padding = "1em";
    
    // MEditorのファイルアップロードコンポーネントを使用
    const uploadArea = editor.createFileUploadArea(null, {
        multiple: true,
        showFileList: true,
        onFilesSelected: (files) => {
            // ファイルが選択されたらアップロードボタンを有効化
            uploadButton.disabled = files.length === 0;
        }
    });
    
    contents.appendChild(uploadArea.element);
    
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = "1rem";
    controls.style.gap = "0.5rem";
    contents.appendChild(controls);
    
    let uploadButton = document.createElement("button");
    uploadButton.innerHTML = "Upload";
    uploadButton.classList.add("meditor-button");
    uploadButton.disabled = true; // 初期状態は無効
    uploadButton.addEventListener("click", async () => {
        DEBUG && console.log("popup window: ", popupWindow);
        
        const files = uploadArea.getFiles();
        if (files.length === 0) {
            mConsole.print("No files selected", "warning");
            return;
        }
        
        // ファイルとフォルダを分類
        const filesWithPath = []; // フォルダ内のファイル（webkitRelativePathに/を含む）
        const standaloneFiles = []; // 単体ファイル（webkitRelativePathなしまたは/を含まない）
        const topLevelFolders = new Set(); // 最上位フォルダ名の集合
        
        for (const file of files) {
            if (file.webkitRelativePath && file.webkitRelativePath.includes('/')) {
                // フォルダ内のファイル
                filesWithPath.push(file);
                const topLevelFolder = file.webkitRelativePath.split('/')[0];
                topLevelFolders.add(topLevelFolder);
            } else {
                // 単体ファイル
                standaloneFiles.push(file);
            }
        }
        
        let renameInfo = null;
        
        // フォルダがある場合、最上位フォルダのリネームをチェック
        if (topLevelFolders.size > 0) {
            const folderRenames = [];
            for (const topLevelFolder of topLevelFolders) {
                const targetPath = path + topLevelFolder;
                if (fileExistsInList(APP_STATE.FILE_LIST.files, targetPath + '/')) {
                    const newFolderPath = generateUniqueFileName(targetPath, APP_STATE.FILE_LIST.files);
                    const newFolderName = newFolderPath.substring(newFolderPath.lastIndexOf('/') + 1);
                    
                    folderRenames.push({
                        original: topLevelFolder,
                        renamed: newFolderName
                    });
                    
                    mConsole.print(`Folder "${topLevelFolder}" will be renamed to "${newFolderName}" as same name already exists`, "info");
                }
            }
            
            // フォルダのリネームがある場合
            if (folderRenames.length > 0) {
                // 複数のフォルダがある場合は配列、単一の場合はオブジェクト
                renameInfo = folderRenames.length === 1 ? folderRenames[0] : folderRenames;
            }
        }
        
        // 単体ファイルがある場合、個別チェック
        if (standaloneFiles.length > 0) {
            const filesToRename = [];
            for (const file of standaloneFiles) {
                const targetPath = path + file.name;
                
                if (fileExistsInList(APP_STATE.FILE_LIST.files, targetPath)) {
                    const newPath = generateUniqueFileName(targetPath, APP_STATE.FILE_LIST.files);
                    const newName = newPath.substring(newPath.lastIndexOf('/') + 1);
                    filesToRename.push({
                        original: file.name,
                        renamed: newName
                    });
                    mConsole.print(`File "${file.name}" will be renamed to "${newName}" as same name already exists`, "info");
                }
            }
            
            // ファイルのリネームがある場合
            if (filesToRename.length > 0) {
                if (renameInfo) {
                    // フォルダとファイル両方のリネームがある場合は配列にまとめる
                    if (Array.isArray(renameInfo)) {
                        renameInfo = [...renameInfo, ...filesToRename];
                    } else {
                        renameInfo = [renameInfo, ...filesToRename];
                    }
                } else {
                    renameInfo = filesToRename;
                }
            }
        }
        
        popupWindow.remove();
        
        // uploadFiles用にFileListを作成
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        
        const mockInput = { files: dataTransfer.files };
        await uploadFiles(mockInput, path, api, mConsole, renameInfo);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });
    controls.appendChild(uploadButton);
    
    let cancelButton = document.createElement("button");
    cancelButton.innerHTML = "Cancel";
    cancelButton.classList.add("meditor-button");
    cancelButton.addEventListener("click", () => {
        popupWindow.remove();
    });
    controls.appendChild(cancelButton);
    
    let popupWindow = editor.popupWindow(windowName, contents);
}
