function hideAllPreviewer(){
    let viewers = document.querySelectorAll(".viewer");
    viewers.forEach((viewer) => {
        viewer.style.display = "none";
    })
}


function pathFromDir(path){
    let dir = path.replace(/\+$/, "");
    return dir;
}




class UserConfig {
    constructor(localStorageKey="php-editor-user-config"){
        this.config = {};
        this.localStorageKey = localStorageKey;
        this.load();
    }

    load(){
        let json = localStorage.getItem(this.localStorageKey);
        if(json == null){
            return {};
        }
        try{
            this.config = JSON.parse(json);
        }
        catch(e){
            console.error("Error loading user config: ", e);
            this.config = {};
        }
    }

    save(){
        let json = JSON.stringify(this.config);
        localStorage.setItem(this.localStorageKey, json);
    }



    get(key) {
        this.load();
        let value = this.config[key];
        if(value == undefined){
            return null;
        }
        return value;
    }

    set(key, value) {
        this.config[key] = value;
        this.save();
    }

    remove(key) {
        delete this.config[key];
        this.save();
    }
}






function changeTheme(theme){
    DEBUG && console.log("Theme: ", theme);
    if(theme == "dark"){
        if(CURRENT_FILE){
            CURRENT_FILE.aceObj.editor.setTheme("ace/theme/monokai");
        }
        document.body.setAttribute("theme", "dark");
        editor.THEME = "dark";
    }
    else{
        if(CURRENT_FILE){
            CURRENT_FILE.aceObj.editor.setTheme("ace/theme/chrome");
        }
        document.body.setAttribute("theme", "light");
        editor.THEME = "light";
    }
    userConfig.set("theme", theme);
}





var USER_ID = "user_id";
var CURRENT_FILE = false;
var FILE_LIST = {};
var RUN_BROWSER_TAB = undefined;

const DEBUG = true;

const userConfig = new UserConfig();

const editor = new MEditor();
editor.DEBUG = true;

const FILE_PAGE_BASE_URL = "/user-programs/";

var mConsole;

async function main(){
    await editor.editor("main");

    editor.setChangeThemeAction((theme) => {
        DEBUG && console.log("Theme: ", theme);
        if(CURRENT_FILE.aceObj != undefined){
            if(theme == "dark"){
                CURRENT_FILE.aceObj.editor.setTheme("ace/theme/monokai");
            }
            else{
                CURRENT_FILE.aceObj.editor.setTheme("ace/theme/chrome");
            }
        }
        userConfig.set("theme", theme);
    });


    editor.page.header.header.menu.items.push(editor.generateButton(
        editor.page.header.header.menu,
        "logout",
        (e) => {window.location.href = "/logout.php";}
    ));
// function newDirDialog(dir) {


    mConsole = editor.console(editor.page.main.mid.container.bottom);


    const editorEditor = editor.workPlace(editor.page.main.mid.container.main);
    editor.wp = editorEditor;

    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "Save",
        (e) => {
            console.log("Save: " + CURRENT_FILE.path);
            //mConsole.print("Save: "+CURRENT_FILE.path);
            pushSaveButton();
        }
    ))
    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "Run",
        (e) => {
            console.log("Run: " + CURRENT_FILE.path);
            openInOtherWindow();
        }
    ))

    editorEditor.menu.right.items.push(editor.generateButton(
        editorEditor.menu.right,
        "Debug",
        (e) => {
            console.log("Debug: ");
            runPhp(CURRENT_FILE.path);
        },
    ))

    const explorer = editor.createExplorer(editor.page.main.left, opt={
        title: "エクスプローラー",
    });


    explorer.setFileClickAction(async function (file) {
        openFile(file);
    })

    explorer.setNewFileClickAction((dir) => {
        newFileDialog(dir);
    })

    explorer.setNewDirClickAction((dir) => {
        newDirDialog(dir);
    })

    explorer.setRenameClickAction((file) => {
        renameFileDialog(file.path);
    })

    explorer.setDuplicateClickAction((file) => {
        console.log("re: Duplicate: ", file);
        duplicateFile(file.path).then((newPath) => {
            loadExplorer().then(() => {
                CURRENT_FILE = false;
                loadFile(newPath);
            });
        });
    })

    explorer.setDeleteClickAction((file) => {
        console.log("re: Delete: ", file);
        deleteFileDialog(file.path);
    })

    explorer.setRenameDirClickAction((dir) => {
        console.log("re: rename dir: ", dir);
        renameDirDialog(dir.path);
    })

    explorer.setDeleteDirClickAction((dir) => {
        console.log("re: delete dir: ", dir);
        deleteDirDialog(dir.path);
    })


    explorer.setUploadClickAction((dir) => {
        console.log("re: upload: ");
        if(!dir){
            dir = getCurrentPath();
        }
        fileUploadDialog(dir);
    })




    testFiles = {
        name: "/",
        type: "dir",
        files: [
            {
                name: "index.php",
                type: "text",
            },
            {
                name: "index.html",
                type: "text",
            },
            {
                name: "images",
                type: "dir",
                files: [
                    {
                        name: "image.png",
                        type: "image",
                    },
                    {
                        name: "image2.png",
                        type: "image",
                    }
                ]
            },
        ]
    }

    // explorer.setMenuTitle(USER_ID + "/");
    // explorer.loadExplorer(testFiles);

    await loadExplorer();




    // hide right window
    editor.page.main.right.hide();



    // theme
    let theme = userConfig.get("theme");
    if(theme == null){
        theme = "light";
    }
    changeTheme(theme);
}

main();



//editor.execCommand("showSettingsMenu") 


function aceKeybinds(ace){
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
            //pushRunButton();
            openInOtherWindow();
        }
    })

    ace.commands.removeCommands("jumptomatching");
}





// If extension not same as editor language mode, set here
const EXT_LANG = [
    {
        ext: ["html", "htm"],
        lang: "html"
    },
    {
        ext: ["js"],
        lang: "javascript"
    },
    {
        ext: ["txt"],
        lang: "text"
    }
];


// var FILELIST = [];
// var FILENAME = false;
// var READONLY = false;
// var USERID = false;
// var NEWFILEDISABLED = false;
// var DELETEDIALOGDISABLED = false;
// var RENAMEDIALOGDISABLED = false;
// var DUPLICATEDIALOGDISABLED = false;

// var RUNBROWSERTAB = false;


function sessionError() {
    console.error("Session error");
    window.location.href = "/login.php";
}

// function resetEditor() {
//     let mainBody = document.getElementById("main-body");
//     oldElms = mainBody.children;
//     for (let i = 0; i < oldElms.length; i++) {
//         if (oldElms[i].id != "editor") {
//             oldElms[i].remove();
//         }
//     }
//     let editorElm = document.getElementById("editor");
//     editorElm.style.display = "none";
// }

// function removeMenu() {
//     let explorerContent = document.getElementById("explorer-content");
//     oldMenues = document.getElementsByClassName("file-menu");
//     for (let i = 0; i < oldMenues.length; i++) {
//         oldMenues[i].remove();
//         window.removeEventListener("click", removeMenu);
//     }
//     explorerContent.style.overflowY = "auto";
// }


function fileNameCheck(fileName) {
    allowedChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.";

    if (fileName.length == 0) {
        return false;
    }

    for (let i = 0; i < fileName.length; i++) {
        if (allowedChars.indexOf(fileName[i]) == -1) {
            return false;
        }
    }
    return true;
}

// function fileNameExist(filename) {
//     $exist = false;

//     $FILELIST.forEach(file => {
//         if (file == filename) {
//             $exist = true;
//             return;
//         }
//     });

//     return $exist;
// }




async function loadExplorer() {
    let body = {
        action: "list-object",
        path: ""
    };
    await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "session_error") {
            sessionError();
            return;
        }
        USERID = data.id;
        FILE_LIST = data.files;
        editor.explorer.setMenuTitle(USERID + "/");
        editor.explorer.loadExplorer(data.files);
    });
}


function extToLang(ext) {
    lang = ext;
    EXT_LANG.forEach(extLang => {
        if (extLang.ext.indexOf(ext) > -1) {
            DEBUG && console.log(extLang.lang);
            lang = extLang.lang;
        }
    });
    return lang;
}

async function openInOtherWindow() {
    if (!CURRENT_FILE) {
        return;
    }
    if (!CURRENT_FILE.readonly) {
        await saveFile(CURRENT_FILE.path, CURRENT_FILE.aceObj.editor.getValue());
        mConsole.print("File saved: " + CURRENT_FILE.path, "success");
    }
    console.log(RUN_BROWSER_TAB);
    let url = FILE_PAGE_BASE_URL + USERID;
    if (CURRENT_FILE.path.startsWith("/")){
        url += CURRENT_FILE.path;
    }
    else{
        url += "/" + CURRENT_FILE.path;
    }
    if (!RUN_BROWSER_TAB || RUN_BROWSER_TAB.closed) {
        RUN_BROWSER_TAB = window.open(url);
    }
    else {
        RUN_BROWSER_TAB.location.href = url;
        RUN_BROWSER_TAB.focus();
    }
}





async function loadFile(path) {
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


async function openFile(file) {
    DEBUG && console.log("fileInfo", file);
    apiRet = await loadFile(file.path);
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
            let mode = extToLang(file.path.split(".").pop());
            ace.setMode(mode);
            file.aceObj = ace;
            aceKeybinds(file.aceObj.editor);
            file.aceObj.setValue(apiRet.content);
            file.aceObj.editor.gotoLine(0);
        }
        else{
            console.log("ace already exists");
        }
        // set theme
        if(editor.THEME == "dark") {
            file.aceObj.editor.setTheme("ace/theme/monokai");
        }
        else{
            file.aceObj.editor.setTheme("ace/theme/chrome");
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
        else(
            console.log("image already exists")
        )
        file.viewer.element.style.display = "flex";
    }
    else {
        file.readonly = true;
        if(file.viewer == undefined || file.viewer == null){
            console.log("Unknown file type: ", file.type);
            msg = editor.viewerMessage(editor.wp.content, "このファイルはプレビューできません");
            msg.element.classList.add("viewer");
            file.viewer = msg;
        }
        else{
            DEBUG && console.log("viewer message already exists");
        }
        file.viewer.element.style.display = "flex";
    }
    CURRENT_FILE = file;
}


async function pushSaveButton() {
    if (!CURRENT_FILE || CURRENT_FILE.readonly) {
        return;
    }
    let content = CURRENT_FILE.aceObj.editor.getValue();
    saveFile(CURRENT_FILE.path, content).then((status) => {
        if(status == 1){
            mConsole.print("File save error: " + CURRENT_FILE.path, "error");
            return;
        }
        mConsole.print("File saved: " + CURRENT_FILE.path, "success");
        phpSyntaxCheck(CURRENT_FILE.path);
    });
}

// async function pushRunButton() {
//     let logOutput = document.getElementById("log-output");
//     logOutput.innerHTML = "";
//     if (!FILENAME || READONLY) {
//         return;
//     }
//     saveFile(FILENAME, editor.getValue()).then(() => {
//         runFile(FILENAME);
//     });
// }


async function saveFile(path, content) {
    let body = {
        action: "save",
        path: path,
        content: content
    };
    let ret = await api("/api/file_manager.php", body=body)
    .then(data => {
        if (data.status === "error") {
            console.error(data.error);
            return 1;
        }
        if (data.status === "session_error") {
            sessionError();
            return 0;
        }
        DEBUG && console.log("File saved");
        // *console out 
    })
    return ret;
}





async function renameFile(path, newPath) {
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

function renameFileDialog(path) {
    let windowName = "Rename file";
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
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "File name";
    input.value = path;
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
        console.log("Rename: ", path);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        await renameFile(path, input.value);
        await loadExplorer();
    });
    controls.appendChild(renameButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}


async function duplicateFile(path) {
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


async function deleteFile(path) {
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

function deleteFileDialog(path) {
    let windowName = "Delete file";
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
        await deleteFile(path);
        if(CURRENT_FILE.path == path){
            CURRENT_FILE = false;
            hideAllPreviewer();
        }
        await loadExplorer();
    });
    controls.appendChild(deleteButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}


async function runPhp(path){

    if(!CURRENT_FILE){
        return;
    }

    if(!CURRENT_FILE.readonly){
        await saveFile(path, CURRENT_FILE.aceObj.editor.getValue());
        mConsole.print("File saved: " + path, "success");
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
        $categoryStr = message.split(":")[0];
        if ($categoryStr.indexOf("error") > -1) {
            mConsole.print(message.replaceAll("\n", "<br>"), "error");
        }
        else if ($categoryStr.indexOf("warning") > -1) {
            mConsole.print(message.replaceAll("\n", "<br>"), "warning");
        }
        else {
            mConsole.print(message.replaceAll("\n", "<br>"), "info");
        }
    })
    return ret;
}




async function createFile(path) {
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

function getCurrentPath() {
    if (!CURRENT_FILE){
        return "/";
    }
    else{
        return CURRENT_FILE.path.substring(0, CURRENT_FILE.path.lastIndexOf("/") + 1);
    }
}

function newFileDialog(dir){
    let windowName = "New file";

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
    
    if(!dir){
        var currentDir = getCurrentPath();
    }
    else{
        var currentDir = dir.path;
        if(currentDir[currentDir.length - 1] != "/"){
            currentDir += "/";
        }
    }
    console.log("New file: " + currentDir);
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "File name";
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
        console.log("Create: ", currentDir + input.value);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        if(CURRENT_FILE && !CURRENT_FILE.readonly){
            saveFile(CURRENT_FILE.path, CURRENT_FILE.aceObj.editor.getValue());
            mConsole.print("File saved: " + CURRENT_FILE.path, "success");
        }
        hideAllPreviewer();
        await createFile(currentDir + input.value);
        await loadExplorer();
    });
    controls.appendChild(createButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}


async function createDir(path) {
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

function newDirDialog(dir) {
    DEBUG && console.log(dir);
    let windowName = "New folder";

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

    if(!dir){
        var currentDir = getCurrentPath();
    }
    else{
        var currentDir = dir.path;
        if(currentDir[currentDir.length - 1] != "/"){
            currentDir += "/";
        }
    }
    console.log("New folder: " + currentDir);
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Folder name";
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
        console.log("Create: ", currentDir + input.value);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        await createDir(currentDir + input.value);
        await loadExplorer();
    });
    controls.appendChild(createButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}

    

async function renameDir(path, newPath) {
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

function renameDirDialog(path) {
    let windowName = "Rename folder";
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
    let contents = document.createElement("div");
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Folder name";
    input.value = path;
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
        console.log("Rename: ", path);
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        await renameDir(path, input.value);
        await loadExplorer();
    });
    controls.appendChild(renameButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}

async function deleteDir(path) {
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

function deleteDirDialog(path) {
    let windowName = "Delete folder";
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
        await deleteDir(path);
        await loadExplorer();
    });
    controls.appendChild(deleteButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}




async function uploadFiles(fileInput, dir) {
    if (!dir){
        dir = getCurrentPath();
    }
    let ret;
    if (fileInput.files.length == 0) {
        mConsole.print("No files selected", "error");
        return false;
    }
    let files = fileInput.files;
    const fd = new FormData();
    fd.append("action", "upload");
    fd.append("path", dir);
    for (let i = 0; i < files.length; i++) {
        fd.append(i, files[i]);
    }
    await fetch("/api/file_upload.php", {
        method: "POST",
        body: fd,
    }).then(response => response.json()).then(data => {
        DEBUG && console.log(data);
        if (data.status == "error") {
            console.error(data.error);
            return;
        }
        if (data.status == "session_error") {
            sessionError();
            return;
        }
        ret = data.paths;
        DEBUG && console.log("Files uploaded");
    }).then(() => {
        loadExplorer();
    });
    return ret;
}

async function fileUploadDialog(dir) {
    if(!dir){
        dir = "/";
    }
    let windowName = "Upload files";

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
        console.log("Upload: ");
        DEBUG && console.log("popup window: ", popupWindow);
        popupWindow.remove();
        await uploadFiles(fileInput, dir);
        await loadExplorer();
    });
    
    controls.appendChild(uploadButton);
    
    let popupWindow = editor.popupWindow(windowName, contents);
}





async function phpSyntaxCheck(path) {
    let ret;
    let body = {
        action: "syntax_check",
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
        ret = data;
    });
    if(status == 1){
        mConsole.print("PHP syntax check error: " + path, "error");
        return false;
    }
    if (ret.result) {
        ret.message.forEach(message => {
            $categoryStr = message.split(":")[0];
            if ($categoryStr.indexOf("error") > -1) {
                mConsole.print(message.replaceAll("\n", "<br>"), "error");
            }
            else if ($categoryStr.indexOf("warning") > -1) {
                mConsole.print(message.replaceAll("\n", "<br>"), "warning");
            }
            else {
                mConsole.print(message.replaceAll("\n", "<br>"), "info");
            }
        });
    }
    else {
        mConsole.print("PHP syntax ok: " + path, "success");
    }
    return ret;
}


// function phpRun(path) { }


