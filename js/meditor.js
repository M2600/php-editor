function hideAllPreviewer(){
    let viewers = document.querySelectorAll(".viewer");
    viewers.forEach((viewer) => {
        viewer.style.display = "none";
    })
}

var USER_ID = "user_id";
var CURRENT_FILE = false;

const editor = new MEditor();
editor.DEBUG = true;

async function main(){
    await editor.editor("main");

    editor.setChangeThemeAction((theme) => {
        console.log("Theme: ", theme);
        if(CURRENT_FILE.aceObj != undefined){
            if(theme == "dark"){
                CURRENT_FILE.aceObj.editor.setTheme("ace/theme/monokai");
            }
            else{
                CURRENT_FILE.aceObj.editor.setTheme("ace/theme/chrome");
            }
        }
    });


    const editorEditor = editor.workPlace(editor.page.main.mid.container.main);

    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "Save",
        (e) => {
            console.log("Save: ");
        }
    ))
    editorEditor.menu.left.items.push(editor.generateButton(
        editorEditor.menu.left,
        "Run",
        (e) => {
            console.log("Run: ");
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
    explorer.setFileClickAction((file) => {
        hideAllPreviewer();
        console.log(file);
        if(file.type == "text"){
            if(file.aceObj == undefined || file.aceObj == null){
                let aceDOM = document.createElement("div");
                editorEditor.content.element.appendChild(aceDOM);
                aceDOM.id = "ace-" + file.name;
                aceDOM.classList.add("viewer");
                aceDOM.style.width = "100%";
                aceDOM.style.height = "100%";
                const ace = new AceWrapper(aceDOM.id);
                ace.loadMySettings();
                file.aceObj = ace;
                file.aceObj.setValue(file.name);
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
            if(file.viewer == undefined || file.viewer == null){
                let imgContainer = document.createElement("div");
                imgContainer.id = "img-" + file.name;
                imgContainer.classList.add("viewer");
                imgContainer.style.width = "100%";
                imgContainer.style.height = "100%";
                editor.page.main.mid.container.main.element.appendChild(imgContainer);

                let img = document.createElement("img");
                imgContainer.appendChild(img);
                img.src = "";
                
                file.viewer = imgContainer;
            }
            else(
                console.log("image already exists")
            )

            file.viewer.style.display = "block";
        }
        CURRENT_FILE = file;
        
    })

    explorer.setNewFileClickAction(() => {
        console.log("re: New file: ");
        editor.popupWindow("New file");
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

    explorer.setMenuTitle(USER_ID + "/");
    explorer.loadExplorer(testFiles);
}

main();



// //editor.execCommand("showSettingsMenu") 


// const DEBUG = true;

// const FILEPAGEBASEURL = "/user-programs/";

// const EXT_LANG = [
//     {
//         ext: ["php"],
//         lang: "php"
//     },
//     {
//         ext: ["html", "htm"],
//         lang: "html"
//     },
//     {
//         ext: ["css"],
//         lang: "css"
//     },
//     {
//         ext: ["js"],
//         lang: "javascript"
//     },
//     {
//         ext: ["txt"],
//         lang: "text"
//     }
// ];


// var FILELIST = [];
// var FILENAME = false;
// var READONLY = false;
// var USERID = false;
// var NEWFILEDISABLED = false;
// var DELETEDIALOGDISABLED = false;
// var RENAMEDIALOGDISABLED = false;
// var DUPLICATEDIALOGDISABLED = false;

// var RUNBROWSERTAB = false;


// function sessionError() {
//     console.error("Session error");
//     window.location.href = "/login.php";
// }

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


// function fileNameCheck(fileName) {
//     allowedChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.";

//     if (fileName.length == 0) {
//         return false;
//     }

//     for (let i = 0; i < fileName.length; i++) {
//         if (allowedChars.indexOf(fileName[i]) == -1) {
//             return false;
//         }
//     }
//     return true;
// }

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


// function fileMenu(parent, path) {
//     removeMenu();

//     // ファイルメニュー表示中はエクスプローラーをスクロールできなくする
//     let explorerContent = document.getElementById("explorer-content");
//     explorerContent.style.overflowY = "hidden";

//     window.addEventListener("click", removeMenu);

//     let menu = document.createElement("div");
//     menu.classList.add("file-menu");
//     let rect = parent.getBoundingClientRect();
//     //let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
//     menu.style.top = (rect.top) + "px";
//     menu.style.left = parent.offsetLeft + parent.offsetWidth + "px";
//     menu.addEventListener("click", (e) => {
//         e.stopPropagation();
//     });

//     parent.appendChild(menu);

//     let duplicateButton = document.createElement("button");
//     duplicateButton.classList.add("file-menu-item");
//     duplicateButton.innerHTML = "<i class=\"fa-solid fa-copy\"></i>複製";
//     duplicateButton.addEventListener("click", async (e) => {
//         e.stopPropagation();
//         console.log("Duplicate");
//         newPath = await duplicateFile(path);
//         await loadExplorer();
//         await loadFile(newPath);
//     });

//     menu.appendChild(duplicateButton);

//     let renameButton = document.createElement("button");
//     renameButton.classList.add("file-menu-item");
//     renameButton.innerHTML = "<i class=\"fa-solid fa-pen\"></i>名前変更";
//     renameButton.addEventListener("click", (e) => {
//         e.stopPropagation();
//         console.log("rename");
//         renameDialog(path);
//         removeMenu();
//     });

//     menu.appendChild(renameButton);

//     let deleteButton = document.createElement("button");
//     deleteButton.classList.add("file-menu-item");
//     deleteButton.style.color = "red";
//     deleteButton.innerHTML = "<i class=\"fa-solid fa-trash\"></i>削除";
//     deleteButton.addEventListener("click", (e) => {
//         e.stopPropagation();
//         console.log("delete");
//         deleteDialog(path);
//         removeMenu();
//     });

//     menu.appendChild(deleteButton);

//     if (menu.getBoundingClientRect().bottom > document.documentElement.clientHeight) {
//         menu.style.top = document.documentElement.clientHeight - menu.clientHeight;
//     }
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



// async function loadExplorer() {
//     let explorerContent = document.getElementById("explorer-content");
//     let explorerTitle = document.getElementById("explorer-title");
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "list",
//             path: ""
//         }),
//     }).then(response => response.json())
//         .then(data => {
//             DEBUG && console.log(data);
//             if (data.status == "session_error") {
//                 sessionError();
//                 return;
//             }
//             USERID = data.id;
//             explorerTitle.innerHTML = USERID + "/";
//             explorerContent.innerHTML = "";
//             let files = data.files;
//             $FILELIST = files;
//             files.forEach(file => {
//                 let fileElement = document.createElement("div");
//                 fileElement.id = file;
//                 fileElement.classList.add("file");
//                 fileElement.addEventListener("click", () => {
//                     loadFile(file);
//                 });

//                 fileName = document.createElement("div");
//                 fileName.classList.add("file-name");
//                 fileName.innerHTML = file;
//                 fileElement.appendChild(fileName);

//                 fileControl = document.createElement("div");
//                 fileControl.classList.add("file-control");
//                 fileControl.innerHTML = "⋮";
//                 fileControl.addEventListener("click", (e) => {
//                     e.stopPropagation();
//                     fileMenu(fileElement, file);
//                 });

//                 fileElement.appendChild(fileControl);


//                 explorerContent.appendChild(fileElement);
//             });
//             DEBUG && console.log("Explorer loaded");

//         });
// }


// function extToLang(ext) {
//     lang = "";
//     EXT_LANG.forEach(extLang => {
//         if (extLang.ext.indexOf(ext) > -1) {
//             DEBUG && console.log(extLang.lang);
//             lang = extLang.lang;
//         }
//     });
//     return lang;
// }

// async function openInOtherWindow() {
//     if (!FILENAME) {
//         return;
//     }
//     if (!READONLY) {
//         await saveFile(FILENAME, editor.getValue());
//     }
//     console.log(RUNBROWSERTAB);
//     if (!RUNBROWSERTAB || RUNBROWSERTAB.closed) {
//         RUNBROWSERTAB = window.open(FILEPAGEBASEURL + USERID + "/" + FILENAME);
//     }
//     else {
//         RUNBROWSERTAB.location.href = FILEPAGEBASEURL + USERID + "/" + FILENAME;
//         RUNBROWSERTAB.focus();
//     }
// }

// function editorBlockMessage(message) {
//     let mainBody = document.getElementById("main-body");

//     let messageContainer = document.createElement("div");
//     messageContainer.id = "editor-block-message";
//     messageContainer.classList.add("editor-block-message");

//     let messageText = document.createElement("p");
//     messageText.innerHTML = message;
//     messageContainer.appendChild(messageText);

//     mainBody.appendChild(messageContainer);
// }

// async function previewImage(imageBase64) {
//     let editorElm = document.getElementById("editor");
//     editorElm.style.display = "none";

//     let imgContainer = document.createElement("div");
//     imgContainer.id = "preview-image-container";
//     imgContainer.classList.add("preview-image-container");


//     let img = document.createElement("img");
//     img.id = "preview-image";
//     img.classList.add("preview-image");
//     img.src = "data:image/png;base64," + imageBase64;
//     imgContainer.appendChild(img);

//     let mainBody = document.getElementById("main-body");
//     mainBody.appendChild(imgContainer);
//     READONLY = true;
// }


// async function loadFile(path) {
//     if (FILENAME && !READONLY) {
//         saveFile(FILENAME, editor.getValue());
//     }
//     let fileElement = document.getElementById(path);
//     let saveButton = document.getElementById("save-button");
//     let runButton = document.getElementById("run-button");
//     let fileName = document.getElementById("file-name");
//     let openOtherWindow = document.getElementById("open-other-window");

//     openOtherWindow.removeEventListener("click", openInOtherWindow);
//     saveButton.removeEventListener("click", pushSaveButton);
//     runButton.removeEventListener("click", pushRunButton);


//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "get",
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
//         let editorElm = document.getElementById("editor");
//         resetEditor();
//         if (data.fileType == "text") {
//             READONLY = false;
//             editorElm.style.display = "block";
//             editor.setValue(data.content);
//             mode = "ace/mode/" + extToLang(path.split(".").pop());
//             DEBUG && console.log(path.split(".").pop());
//             DEBUG && console.log(mode);
//             editor.getSession().setMode(mode);
//             editor.setReadOnly(false);
//             editor.gotoLine(0);
//         }
//         else if (data.fileType == "image") {
//             previewImage(data.content);
//         }
//         else {
//             editorElm.style.display = "none";
//             READONLY = true;
//             editorBlockMessage("このファイルは表示できません。");
//             console.error("Invalid file type");
//         }

//         FILENAME = path;
//         fileName.innerHTML = FILENAME;
//         openOtherWindow.addEventListener("click", openInOtherWindow);
//         saveButton.addEventListener("click", pushSaveButton);
//         runButton.addEventListener("click", pushRunButton);
//         DEBUG && console.log("File loaded");

//     });

//     oldSelectedFile = document.getElementsByClassName("selected-file");
//     for (let i = 0; i < oldSelectedFile.length; i++) {
//         oldSelectedFile[i].classList.remove("selected-file");
//     }
//     fileElement.classList.add("selected-file");
//     editor.focus();
// }

// async function pushSaveButton() {
//     let logOutput = document.getElementById("log-output");
//     logOutput.innerHTML = "";
//     if (!FILENAME || READONLY) {
//         return;
//     }
//     let content = editor.getValue();
//     saveFile(FILENAME, content).then(() => {
//         phpSyntaxCheck(FILENAME);
//     });
// }

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



// async function saveFile(path, content) {
//     let logOutput = document.getElementById("log-output");
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headere: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "save",
//             path: path,
//             content: content
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
//         DEBUG && console.log("File saved");
//         logOutput.innerHTML += "<span class=\"success\">File saved</span><br>";
//         logOutput.scrollTop = logOutput.scrollHeight;
//     })
// }


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



// async function createFile(path) {
//     ret = "";
//     await fetch("/api/file_manager.php", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             action: "touch",
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
//         DEBUG && console.log("File created");
//         ret = data.createdFilePath;
//     });
//     return ret;
// }




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
