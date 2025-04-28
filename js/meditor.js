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










var USER_ID = "user_id";
var CURRENT_FILE = false;
var FILE_LIST = {};
var RUN_BROWSER_TAB = undefined;

const DEBUG = true;

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
    });


    mConsole = editor.console(editor.page.main.mid.container.bottom);


    const editorEditor = editor.workPlace(editor.page.main.mid.container.main);

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
        },
    ))

    const explorer = editor.createExplorer(editor.page.main.left, opt={
        title: "エクスプローラー",
    });
    explorer.setFileClickAction(async function (file) {
        DEBUG && console.log("fileInfo", file);
        apiRet = await loadFile(file.path);
        hideAllPreviewer();
        if(file.type == "text"){
            file.readonly = false;
            if(file.aceObj == undefined || file.aceObj == null){
                let aceDOM = document.createElement("div");
                editorEditor.content.element.appendChild(aceDOM);
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
                let img = editor.imageViewer(editorEditor.content, src);
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
                msg = editor.viewerMessage(editorEditor.content, "このファイルはプレビューできません");
                msg.element.classList.add("viewer");
                file.viewer = msg;
            }
            else{
                DEBUG && console.log("viewer message already exists");
            }
            file.viewer.element.style.display = "flex";
        }
        CURRENT_FILE = file;
        
    })

    explorer.setNewFileClickAction((dir) => {
        newFileDialog(dir);
    })

    explorer.setNewDirClickAction(() => {
        console.log("re: New dir: ");
    })

    explorer.setRenameClickAction((file) => {
        console.log("re: Rename: ", file);
    })

    explorer.setDuplicateClickAction((file) => {
        console.log("re: Duplicate: ", file);
    })

    explorer.setDeleteClickAction((file) => {
        console.log("re: Delete: ", file);
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
            {
                name: "js",
                type: "dir",
                files: [
                    {
                        name: "script.js",
                        type: "text",
                    },
                    {
                        name: "modules",
                        type: "dir",
                        files: [
                            {
                                name: "module.js",
                                type: "text",
                            },
                            {
                                name: "module2.js",
                                type: "text",
                            },
                            {
                                name: "module3.js",
                                type: "text",
                            },
                            {
                                name: "module4.js",
                                type: "text",
                            },
                            {
                                name: "module5.js",
                                type: "text",
                            },
                            {
                                name: "module6.js",
                                type: "text",
                            },
                            {
                                name: "module7.js",
                                type: "text",
                            },
                            {
                                name: "module8.js",
                                type: "text",
                            },
                            {
                                name: "module9.js",
                                type: "text",
                            },
                            {
                                name: "module10.js",
                                type: "text",
                            },
                            {
                                name: "module11.js",
                                type: "text",
                            },
                            {
                                name: "module12.js",
                                type: "text",
                            },
                            {
                                name: "module13.js",
                                type: "text",
                            },
                            {
                                name: "module14.js",
                                type: "text",
                            },
                            {
                                name: "module15.js",
                                type: "text",
                            },
                            {
                                name: "module16.js",
                                type: "text",
                            },
                            {
                                name: "module17.js",
                                type: "text",
                            },
                            {
                                name: "module18.js",
                                type: "text",
                            },
                            {
                                name: "module19.js",
                                type: "text",
                            },
                            {
                                name: "module20.js",
                                type: "text",
                            },
                            {
                                name: "module21.js",
                                type: "text",
                            },
                            {
                                name: "module22.js",
                                type: "text",
                            },
                            {
                                name: "module23.js",
                                type: "text",
                            },
                            {
                                name: "module24.js",
                                type: "text",
                            },
                            {
                                name: "module25.js",
                                type: "text",
                            },
                            {
                                name: "module26.js",
                                type: "text",
                            },
                            {
                                name: "module27.js",
                                type: "text",
                            },
                            {
                                name: "module28.js",
                                type: "text",
                            },
                            {
                                name: "module29.js",
                                type: "text",
                            },
                            {
                                name: "module30.js",
                                type: "text",
                            },
                        ]
                    }
                ]
            },
            {
                name: "css",
                type: "dir",
                files: [
                    {
                        name: "style.css",
                        type: "text",
                    }
                ]
            }
        ]
    }

    // explorer.setMenuTitle(USER_ID + "/");
    // explorer.loadExplorer(testFiles);

    await loadExplorer();
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




// async function renameDialog(path) {
//     if (RENAMEDIALOGDISABLED) {
//         return;
//     }
//     RENAMEDIALOGDISABLED = true;

//     let dialog = document.createElement("div");
//     dialog.classList.add("rename-dialog");

//     let func = () => {
//         let newName = document.getElementById("new-file-name").value;
//         if (!fileNameCheck(newName)) {
//             console.error("Invalid file name");
//             return;
//         }
//         if (fileNameExist(newName)) {
//             console.error("File name already exists");
//             return;
//         }
//         dialog.remove();
//         RENAMEDIALOGDISABLED = false;
//         renameFile(path, newName).then(newPath => {
//             loadExplorer().then(() => {
//                 FILENAME = false;
//                 loadFile(newPath);
//             });
//         });
//     }

//     let newName = document.createElement("input");
//     newName.type = "text";
//     newName.id = "new-file-name";
//     newName.placeholder = "New name";
//     newName.value = path;
//     newName.addEventListener("change", () => {
//         if (!fileNameCheck(newName.value)) {
//             newName.style.borderColor = "red";
//         }
//         else if (fileNameExist(newName.value)) {
//             newName.style.borderColor = "orange";
//         }
//         else {
//             newName.style.borderColor = "initial";
//         }
//     })
//     newName.addEventListener("keydown", async (e) => {
//         if (e.key == "Enter") {
//             func();
//         }
//     })
//     dialog.appendChild(newName);

//     let controls = document.createElement("div");
//     controls.classList.add("rename-dialog-controls");
//     dialog.appendChild(controls);

//     let renameButton = document.createElement("button");
//     renameButton.innerHTML = "<i class=\"fa-solid fa-check\"></i>Rename";
//     renameButton.addEventListener("click", func);
//     controls.appendChild(renameButton);

//     let cancelButton = document.createElement("button");
//     cancelButton.innerHTML = "<i class=\"fa-solid fa-ban\"></i>Cancel";
//     cancelButton.addEventListener("click", () => {
//         dialog.remove();
//         RENAMEDIALOGDISABLED = false;
//     });
//     controls.appendChild(cancelButton);

//     document.body.appendChild(dialog);
//     newName.focus();
// }


// async function deleteDialog(path) {
//     if (DELETEDIALOGDISABLED) {
//         return;
//     }
//     DELETEDIALOGDISABLED = true;

//     let dialog = document.createElement("div");
//     dialog.classList.add("delete-dialog");

//     let message = document.createElement("div");
//     message.innerHTML = path + ": 本当に削除しますか？";
//     dialog.appendChild(message);

//     let controls = document.createElement("div");
//     controls.classList.add("delete-dialog-controls");
//     dialog.appendChild(controls);

//     let deleteButton = document.createElement("button");
//     deleteButton.innerHTML = "<i class=\"fa-solid fa-check\"></i>削除";
//     deleteButton.addEventListener("click", async () => {
//         console.log("delete");
//         dialog.remove();
//         DELETEDIALOGDISABLED = false;
//         FILENAME = false;
//         await deleteFile(path);
//         await loadExplorer();
//         FILENAME = false;
//         resetEditor();
//     });
//     controls.appendChild(deleteButton);

//     let cancelButton = document.createElement("button");
//     cancelButton.innerHTML = "<i class=\"fa-solid fa-ban\"></i>キャンセル";
//     cancelButton.addEventListener("click", () => {
//         dialog.remove();
//         DELETEDIALOGDISABLED = false;
//     });
//     controls.appendChild(cancelButton);

//     document.body.appendChild(dialog);
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
        //phpSyntaxCheck(FILENAME);
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




// async function renameFile(path, newPath) {
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "rename",
//             path: path,
//             newPath: newPath,
//         })
//     }).then(response => response.json()).then(data => {
//         DEBUG && console.log(data);
//         if (data.status == "error") {
//             console.error(data.error);
//             return;
//         }
//         if (data.status == "session_error") {
//             sessionError();
//             return;
//         }
//         DEBUG && console.log("File renamed");
//         localnewPath = data.newPath;
//     })
//     return localnewPath;
// }

// async function duplicateFile(path) {
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "duplicate",
//             path: path,
//         })
//     }).then(response => response.json()).then(data => {
//         DEBUG && console.log(data);
//         if (data.status == "error") {
//             console.error(data.error);
//             return;
//         }
//         if (data.status == "session_error") {
//             sessionError();
//             return;
//         }
//         DEBUG && console.log("File duplicated");
//         newPath = data.newPath;
//     })
//     return newPath;
// }

// async function deleteFile(path) {
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "delete",
//             path: path,
//         })
//     }).then(response => response.json()).then(data => {
//         DEBUG && console.log(data);
//         if (data.status == "error") {
//             console.error(data.error);
//             return;
//         }
//         if (data.status == "session_error") {
//             sessionError();
//             return;
//         }
//         DEBUG && console.log("File deleted");
//     })
// }


// async function runFile(path) {
//     let logOutput = document.getElementById("log-output");
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "run",
//             path: path
//         })
//     }).then(response => response.json()).then(data => {
//         DEBUG && console.log(data);
//         if (data.status == "error") {
//             console.error(data.error);
//             return;
//         }
//         if (data.status == "session_error") {
//             sessionError();
//             return;
//         }
//         DEBUG && console.log("File run");

//         if (data.result) {
//             console.log("run error: " + data.message);
//         }
//         else {
//             console.log("run ok");
//         }
//         data.message.forEach(message => {
//             $categoryStr = message.split(":")[0];
//             if ($categoryStr.indexOf("error") > -1) {
//                 logOutput.innerHTML += "<span class=\"error\">" + message.replaceAll("\n", "<br>") + "</span><br>";
//             }
//             else if ($categoryStr.indexOf("Warning") > -1) {
//                 logOutput.innerHTML += "<span class=\"warning\">" + message.replaceAll("\n", "<br>") + "</span><br>";
//             }
//             else {
//                 logOutput.innerHTML += "<span class=\"info\">" + message.replaceAll("\n", "<br>") + "</span><br>";
//             }
//         })

//         logOutput.scrollTop = logOutput.scrollHeight;
//     });
// }



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
        await createFile(currentDir + input.value);
        await loadExplorer();
    });
    controls.appendChild(createButton);
    let popupWindow = editor.popupWindow(windowName, contents);
}


// async function newFileDialog() {
//     if (NEWFILEDISABLED) {
//         return;
//     }
//     NEWFILEDISABLED = true;

//     let dialog = document.createElement("div");
//     dialog.style.position = "absolute";
//     dialog.style.padding = ".5rem";
//     dialog.style.backgroundColor = "var(--color-bg-alt)";
//     dialog.style.color = "var(--color-text-alt)";
//     dialog.style.border = "1px solid #666";
//     dialog.style.top = "50%";
//     dialog.style.left = "50%";
//     dialog.style.zIndex = "1000";
//     dialog.style.transform = "translate(-50%, -50%)";


//     func = () => {
//         let fileName = document.getElementById("new-file-name").value;
//         if (!fileNameCheck(fileName)) {
//             console.error("Invalid file name");
//             return;
//         }
//         dialog.remove();
//         NEWFILEDISABLED = false;
//         createFile(fileName).then(path => {
//             DEBUG && console.log(path);
//             loadExplorer().then(() => {
//                 loadFile(path);
//             })
//         });
//         loadExplorer();
//     }

//     let newFileName = document.createElement("input");
//     newFileName.type = "text";
//     newFileName.id = "new-file-name";
//     newFileName.placeholder = "File name";
//     newFileName.addEventListener("change", () => {
//         if (!fileNameCheck(newFileName.value)) {
//             newFileName.style.borderColor = "red";
//         }
//         else {
//             newFileName.style.borderColor = "initial";
//         }
//     })
//     newFileName.addEventListener("keydown", async (e) => {
//         if (e.key == "Enter") {
//             func();
//         }
//     })
//     dialog.appendChild(newFileName);


//     let controls = document.createElement("div");
//     controls.style.display = "flex";
//     controls.style.flexDirection = "row-reverse";
//     controls.style.marginTop = ".2rem";

//     let createButton = document.createElement("button");
//     createButton.id = "create-file";
//     createButton.innerHTML = "<i class=\"fa-solid fa-check\"></i>作成";
//     createButton.addEventListener("click", func);
//     controls.appendChild(createButton);

//     let cancelButton = document.createElement("button");
//     cancelButton.innerHTML = "<i class=\"fa-solid fa-ban\"></i>キャンセル";
//     cancelButton.addEventListener("click", () => {
//         dialog.remove();
//         NEWFILEDISABLED = false;
//     });
//     controls.appendChild(cancelButton);


//     dialog.appendChild(controls);

//     document.body.appendChild(dialog);
//     newFileName.focus();

// }



// async function uploadFiles() {
//     let input = document.getElementById("file-input");
//     files = input.files;
//     const fd = new FormData();
//     fd.append("action", "upload");
//     for (let i = 0; i < files.length; i++) {
//         fd.append(i, files[i]);
//     }
//     await fetch("/api/file_upload.php", {
//         method: "POST",
//         body: fd,
//     }).then(response => response.json()).then(data => {
//         DEBUG && console.log(data);
//         if (data.status == "error") {
//             console.error(data.error);
//             return;
//         }
//         if (data.status == "session_error") {
//             sessionError();
//             return;
//         }
//         ret = data.paths;
//         DEBUG && console.log("Files uploaded");
//     }).then(() => {
//         loadExplorer();
//     });
//     return ret;
// }



// async function fileUploadDialog() {

//     upload = () => {
//         uploadFiles();
//         dialog.remove();
//     }

//     let dialog = document.createElement("dic");
//     dialog.classList.add("upload-dialog");

//     let fileInput = document.createElement("input");
//     fileInput.type = "file";
//     fileInput.multiple = true;
//     fileInput.id = "file-input";
//     dialog.appendChild(fileInput);

//     let controls = document.createElement("div");
//     controls.classList.add("upload-dialog-controls");

//     let uploadButton = document.createElement("button");
//     uploadButton.innerHTML = "<i class=\"fa-solid fa-check\"></i>アップロード";
//     uploadButton.addEventListener("click", upload);
//     controls.appendChild(uploadButton);

//     let cancelButton = document.createElement("button");
//     cancelButton.innerHTML = "<i class=\"fa-solid fa-ban\"></i>キャンセル";
//     cancelButton.addEventListener("click", () => {
//         dialog.remove();
//     });
//     controls.appendChild(cancelButton);

//     dialog.appendChild(controls);

//     document.body.appendChild(dialog);
// }

// async function phpSyntaxCheck(path) {
//     let logOutput = document.getElementById("log-output");
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "syntax_check",
//             path: path
//         })
//     }).then(response => response.json()).then(data => {
//         DEBUG && console.log(data);
//         if (data.status == "error") {
//             console.error(data.error);
//             return;
//         }
//         if (data.status == "session_error") {
//             sessionError();
//             return;
//         }

//         if (data.result) {
//             console.log("syntax error: " + data.message);
//             data.message.forEach(message => {
//                 $categoryStr = message.split(":")[0];
//                 if ($categoryStr.indexOf("error") > -1) {
//                     logOutput.innerHTML += "<span class=\"error\">" + message.replaceAll("\n", "<br>") + "</span><br>";
//                 }
//                 else if ($categoryStr.indexOf("warning") > -1) {
//                     logOutput.innerHTML += "<span class=\"warning\">" + message.replaceAll("\n", "<br>") + "</span><br>";
//                 }
//                 else {
//                     logOutput.innerHTML += "<span class=\"info\">" + message.replaceAll("\n", "<br>") + "</span><br>";
//                 }
//             });
//         }
//         else {
//             console.log("syntax ok");
//             logOutput.innerHTML += "<span class=\"success\">No syntax error occurred</span><br>";
//         }

//         logOutput.scrollTop = logOutput.scrollHeight;
//     })
// }

// function phpRun(path) { }



// document.getElementById("newFile").addEventListener("click", newFileDialog);
// document.getElementById("uploadFile").addEventListener("click", fileUploadDialog);

// loadExplorer();
