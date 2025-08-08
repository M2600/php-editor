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
    cleanupAceInstance
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

export function renameFileDialog(path, editor, api, mConsole, DEBUG) {
    let windowName = "Rename file";
    if (checkWindowExists(windowName, editor, DEBUG)) {
        return;
    }

    let rename = async () => {
        console.log("Rename: ", path);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        hideAllPreviewer();
        await renameFile(path, input.value, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    }

    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "File name";
    input.value = path;
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
                let newPath = Path.joinAsFile(getParentDir(editor.BASE_DIR), file.name);
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
    let windowName = "New file";
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
        console.log("Create: ", currentDir + input.value);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        if(currentFile && !currentFile.readonly){
            await saveFile(currentFile.path, currentFile.aceObj.editor.getValue());
            mConsole.print("File saved: " + currentFile.path, "success");
        }
        hideAllPreviewer();
        await createFile(currentDir + input.value, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    }

    console.log("New file: " + currentDir);
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "File name";
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
        console.log("Create: ", currentDir + input.value);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        await createDir(currentDir + input.value, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    }

    console.log("New folder: " + currentDir);
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Folder name";
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
        popupWindow.remove();
        await renameDir(path, input.value, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    }

    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Folder name";
    input.value = path;
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
    let fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.id = "file-input";
    contents.appendChild(fileInput);
    
    let controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "row-reverse";
    controls.style.marginTop = ".3rem";
    contents.appendChild(controls);
    
    let uploadButton = document.createElement("button");
    uploadButton.innerHTML = "Upload";
    uploadButton.classList.add("meditor-button");
    uploadButton.addEventListener("click", async () => {
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        await uploadFiles(fileInput, path, api, mConsole);
        await loadExplorer(editor.BASE_DIR, api, APP_STATE, editor);
    });
    controls.appendChild(uploadButton);
    
    let popupWindow = editor.popupWindow(windowName, contents);
}
