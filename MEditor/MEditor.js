// general functions





// Require: ace.js, ace/ext-language_tools.js

ace.require("ace/ext/language_tools");

class AceWrapper {
    constructor(HTMLId) {
        this.editorDOM = document.getElementById(HTMLId);
        this.editor = ace.edit(HTMLId);
    }

    mySettings() {
        this.editor.$blockScrolling = Infinity;
        this.editor.setTheme("ace/theme/monokai");
        this.editor.setFontSize(14);
        this.editor.setShowPrintMargin(false);
        this.editor.setOptions({
            fontFamily: "monospace",
            enableSnippets: true,
            //enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableEmmet: true,
            scrollPastEnd: 0.2,
            //maxLines: Infinity,
        });
        this.editor.getSession().setUseWrapMode(true);
        this.editor.getSession().setTabSize(4);

        //this.editor.setKeyboardHandler("ace/keyboard/vim");

    }

    myKeybindings() {
        // remove ctrl-p keybind for mac-emacs users
        delete this.editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-p"];

        // ============ SAMPLE ============
        // remove all keybindings except for ctrl-d
        // for (key in editor.keyBinding.$defaultHandler.commandKeyBinding) {
        //     if (key !== "ctrl-d" && key !== "command-d")
        //         delete editor.keyBinding.$defaultHandler.commandKeyBinding[key]
        //}

    }

    myEvents() {
        // this.editor.selection.on('changeCursor', () => {
        //     console.log("change cursor event");
        //     const cursorPosition = this.editor.getCursorPosition().row;
        //     editor.scrollToLine(cursorPosition, true, true, function () {});
        // });
    }






    /**
     * Load my settings
     */
    loadMySettings() {
        this.mySettings();
        this.myKeybindings();
        this.myEvents();
    }

    /**
     * 
     * @param {string} value 
     */
    setValue (value) {
        this.editor.setValue(value);
    }

    /**
     * set editor mode
     */
    setMode(mode) {
        let aceMode = "ace/mode/" + mode;
        this.editor.getSession().setMode(aceMode);
    }

    /**
     * hide editor
     */
    hide() {
        this.editorDOM.style.display = "none";
    }
    
    /**
     * show editor
     */
    show() {
        this.editorDOM.style.display = "block";
    }

    /**
     * focus editor
     */
    focus() {
        this.editor.focus();
    }

}




class MEditor {

    EDITOR_NAME = "MEditor";
    CLASS_NAME_PREFIX = "meditor-";

    DEBUG = false;
    

    constructor() {
        // script path
        this.root=document.querySelector('script[src$="MEditor.js"]').outerHTML.match(/\"(.*)MEditor.js\"/)[1]||'./';


        // variables
        this.EDITORS = [];
        this.FILE_NAME = false;
        this.READONLY = false;
        this.USER_ID = false;
        this.NEW_FILE_DISABLED = false;
        this.DELETE_DIALOG_DISABLED = false;
        this.RENAME_DIALOG_DISABLED = false;
        this.DUPLICATE_DIALOG_DISABLED = false;
        this.THEME = "dark"; // dark | light
        this.runBrowserTab = false;

        //this.explorer = {};


        // page object basically access from inside of the class
        this.page = {
            popupMenus: [],
            popupMenuCloseAction: () => {},
            popupWindows: [],
        };

    }

    async editor(containerId) {
        this.page.element = document.getElementById(containerId);
        this.page.element.classList.add(this.CLASS_NAME_PREFIX + "page");

        await this.pageLayout(this.page);
        return;
    }



    changeThemeAction = (theme) => {
        console.log("Theme changed to: " + theme);
    };

    setChangeThemeAction = (func) => {
        this.changeThemeAction = func;
    }



    pageSettings = {
        split: {
            minWidth: 100,
            minHeight: 60,
            setMinWidth: function(width) {
                this.pageSettings.split.minWidth = width;
            },
            setMinHeight: function(height) {
                this.pageSettings.split.minHeight = height;
            },
        },
        splitSash: {
            /**
             * width of sash
             * Do not change this value directly. Use setWidth method.
             */
            width: 10,
            setWidth: function(width) {
                this.pageSettings.splitSash.width = width;
                this.page.main.left.sash.element.style.width = width + "px";
                this.page.main.right.sash.element.style.width = width + "px";
                this.page.main.mid.container.bottom.sash.element.style.height = width + "px";
            }.bind(this),
        }
    }

    


    layout(parentObj) {
        let parentElement = parentObj.element;

        let header = {};
        header.element = document.createElement("div");
        header.element.classList.add(this.CLASS_NAME_PREFIX + "header");
        parentElement.appendChild(header.element);
        parentObj.header = header;

        let main = {};
        main.element = document.createElement("div");
        main.element.classList.add(this.CLASS_NAME_PREFIX + "main");
        parentElement.appendChild(main.element);
        parentObj.main = main;

        let left = {};
        left.element = document.createElement("div");
        left.element.classList.add(this.CLASS_NAME_PREFIX + "split-v", 
            this.CLASS_NAME_PREFIX + "left",
            this.CLASS_NAME_PREFIX + "split");
        parentObj.main.element.appendChild(left.element);
        parentObj.main.left = left;

        let leftSashMove = (e) => {
            let parentLeft = main.element.getBoundingClientRect().left;
            let leftWidth = e.clientX - parentLeft;
            let midWidth = parentElement.clientWidth - leftWidth - right.element.clientWidth;
            if(leftWidth >= this.pageSettings.split.minWidth && midWidth >= this.pageSettings.split.minWidth){
                left.element.style.width = leftWidth + "px";
                mid.element.style.width = midWidth + "px";
                mid.element.style.left = e.clientX - parentLeft + "px";
                leftSash.element.style.left = e.clientX - parentLeft - this.pageSettings.splitSash.width/2 + "px";
            }
            else{
                this.adjustPage();
            }
        }
        
        let leftSash = {};
        leftSash.element = document.createElement("div");
        leftSash.element.classList.add(this.CLASS_NAME_PREFIX + "sash-v");
        leftSash.element.style.width = this.pageSettings.splitSash.width + "px";
        leftSash.element.addEventListener("mousedown", (e) => {
            window.addEventListener("mousemove", leftSashMove);
            window.addEventListener("mouseup", function a (e){
                window.removeEventListener("mousemove", leftSashMove);
                window.removeEventListener("mouseup", a);
            });
        });
        parentObj.main.element.appendChild(leftSash.element);
        parentObj.main.left.sash = leftSash;
        
        let mid = {};
        mid.element = document.createElement("div");
        mid.element.classList.add(this.CLASS_NAME_PREFIX + "split-v",
            this.CLASS_NAME_PREFIX + "mid",
            this.CLASS_NAME_PREFIX + "split");
        parentObj.main.element.appendChild(mid.element);
        parentObj.main.mid = mid;

        let midContainer = {};
        midContainer.element = document.createElement("div");
        midContainer.element.classList.add(this.CLASS_NAME_PREFIX + "mid-container");
        parentObj.main.mid.element.appendChild(midContainer.element);
        parentObj.main.mid.container = midContainer;


        let midMain = {};
        midMain.element = document.createElement("div");
        midMain.element.classList.add(this.CLASS_NAME_PREFIX + "split-h",
            this.CLASS_NAME_PREFIX + "mid-main",
            this.CLASS_NAME_PREFIX + "split");
        parentObj.main.mid.container.element.appendChild(midMain.element);
        parentObj.main.mid.container.main = midMain;
        

        let midBottom = {};
        midBottom.element = document.createElement("div");
        midBottom.element.classList.add(this.CLASS_NAME_PREFIX + "split-h",
            this.CLASS_NAME_PREFIX + "mid-bottom",
            this.CLASS_NAME_PREFIX + "split");
        parentObj.main.mid.container.element.appendChild(midBottom.element);
        parentObj.main.mid.container.bottom = midBottom;

        let midSashMove = (e) => {
            let midContainerTop = midContainer.element.getBoundingClientRect().top;
            let midContainerBottom = midContainer.element.getBoundingClientRect().bottom;
            //console.log(midContainerTop, midContainerBottom, e.clientY);
            let midMainHeight = e.clientY - midContainerTop;
            let midBottomHeight = midContainerBottom - e.clientY;
            if(midMainHeight >= this.pageSettings.split.minHeight && midBottomHeight >= this.pageSettings.split.minHeight){
                midMain.element.style.height = midMainHeight + "px";
                midBottom.element.style.height = midBottomHeight + "px";
                midBottom.element.style.top = e.clientY - midContainerTop + "px";
                mainSash.element.style.top = e.clientY- midContainerTop - this.pageSettings.splitSash.width/2 + "px";
            }
            else{
                this.adjustPage();
            }
        }

        let mainSash = {};
        mainSash.element = document.createElement("div");
        mainSash.element.classList.add(this.CLASS_NAME_PREFIX + "sash-h");
        mainSash.element.style.height = this.pageSettings.splitSash.width + "px";
        mainSash.element.addEventListener("mousedown", (e) => {
            window.addEventListener("mousemove", midSashMove);
            window.addEventListener("mouseup", function a(e) {
                window.removeEventListener("mousemove", midSashMove);
                window.removeEventListener("mouseup", a);
            });
        });
        parentObj.main.mid.container.element.appendChild(mainSash.element);
        parentObj.main.mid.container.bottom.sash = mainSash;

        let right = {};
        right.element = document.createElement("div");
        right.element.classList.add(this.CLASS_NAME_PREFIX + "split-v",
            this.CLASS_NAME_PREFIX + "right",
            this.CLASS_NAME_PREFIX + "split");
        parentObj.main.element.appendChild(right.element);
        parentObj.main.right = right;


        let rightSashMove = (e) => {
            let parentLeft = parentElement.getBoundingClientRect().left;
            let parentRight = parentElement.getBoundingClientRect().right;
            let rightWidth = parentRight - e.clientX;
            let midWidth = parentElement.clientWidth - left.element.clientWidth - rightWidth;
            if(rightWidth >= this.pageSettings.split.minWidth && midWidth >= this.pageSettings.split.minWidth){
                mid.element.style.width = midWidth + "px";
                right.element.style.width = rightWidth + "px";
                rightSash.element.style.left = e.clientX - parentLeft - this.pageSettings.splitSash.width/2 + "px";
            }
            else{
                this.adjustPage();
            }
        }

        let rightSash = {};
        rightSash.element = document.createElement("div");
        rightSash.element.classList.add(this.CLASS_NAME_PREFIX + "sash-v");
        rightSash.element.style.width = this.pageSettings.splitSash.width + "px";
        rightSash.element.addEventListener("mousedown", (e) => {
            window.addEventListener("mousemove", rightSashMove);
            window.addEventListener("mouseup", function a(e) {
                window.removeEventListener("mousemove", rightSashMove);
                window.removeEventListener("mouseup", a);
            });
        });
        parentObj.main.element.appendChild(rightSash.element);
        parentObj.main.right.sash = rightSash;

        this.adjustPage();
        // adjust page when parent element resized
        const observer = new ResizeObserver(this.adjustPage.bind(this));
        observer.observe(parentObj.element);
    }

    adjustPage() {
        //console.log("adjustPage");
        this.adjustSplit();
        this.adjustSash();
    }

    adjustSplit() {
        this.page.element.style.minWidth = this.pageSettings.split.minWidth * 3 + "px";
        let parentElement = this.page.element;
        let left = this.page.main.left;
        let mid = this.page.main.mid;
        let right = this.page.main.right;

        let leftWidth = parentElement.clientWidth - mid.element.clientWidth - right.element.clientWidth;
        let midWidth = parentElement.clientWidth - left.element.clientWidth - right.element.clientWidth;
        let rightWidth = parentElement.clientWidth - left.element.clientWidth - mid.element.clientWidth;

        if(midWidth < this.pageSettings.split.minWidth){
            mid.element.style.width = this.pageSettings.split.minWidth + "px";
            //midWidth = this.pageSettings.split.minWidth;
            mid.element.style.left = left.element.clientWidth + "px";

            let delta = this.pageSettings.split.minWidth - midWidth;
            if(leftWidth >= this.pageSettings.split.minWidth + delta/2 && rightWidth >= this.pageSettings.split.minWidth + delta/2){
                leftWidth -= delta/2;
                rightWidth -= delta/2;
                left.element.style.width = leftWidth + "px";
                mid.element.style.left = left.element.clientWidth + "px";
                right.element.style.width = rightWidth + "px";
            }
            else if(leftWidth >= this.pageSettings.split.minWidth + delta){
                leftWidth -= delta;
                left.element.style.width = leftWidth + "px";
                mid.element.style.left = left.element.clientWidth + "px";
            }
            else if(rightWidth >= this.pageSettings.split.minWidth + delta){
                rightWidth -= delta;
                right.element.style.width = rightWidth + "px";
            }

        }
        else{
            mid.element.style.width = midWidth + "px";
        }
        leftWidth = parentElement.clientWidth - midWidth - right.element.clientWidth;
        
        
        let midMain = mid.container.main;
        let midBottom = mid.container.bottom;

        let midMainHeight = mid.element.offsetHeight - midBottom.element.offsetHeight;
        let midBottomHeight = midBottom.element.offsetHeight;

        if(midMainHeight < this.pageSettings.split.minHeight){
            midMain.element.style.height = this.pageSettings.split.minHeight + "px";
            midMainHeight = this.pageSettings.split.minHeight;
            midBottom.element.style.top = this.pageSettings.split.minHeight + "px";
            midBottomHeight = mid.element.clientHeight - midMainHeight;
        }
        else{
            midMain.element.style.height = midMainHeight + "px";
            midBottom.element.style.top = midMainHeight + "px";
        }
    }

    adjustSash() {
        let parentElement = this.page.element;
        let left = this.page.main.left;
        let mid = this.page.main.mid;
        let right = this.page.main.right;

        left.sash.element.style.left = parentElement.clientLeft + left.element.clientWidth - this.pageSettings.splitSash.width / 2 + "px";
        mid.container.bottom.sash.element.style.top = mid.container.main.element.clientHeight - this.pageSettings.splitSash.width / 2 + "px";
        right.sash.element.style.left = parentElement.clientLeft + parentElement.clientWidth - right.element.clientWidth - this.pageSettings.splitSash.width / 2 + "px";

        let midContainer = mid.container;
        let midMain = midContainer.main;
        let midBottom = midContainer.bottom;

        midBottom.sash.element.style.top = midContainer.element.clientTop + midMain.element.clientHeight - this.pageSettings.splitSash.width / 2 + "px";
    }

    async pageLayout(parentObj) {
        await this.loadCSS(this.root+"colors.css");
        await this.loadCSS(this.root+"MEditor.css");
        this.layout(parentObj);
        // let header = this.generateHeader(parentObj, "PHP Editor");
        // let main = this.generateMain(parentObj);
        // let leftPanel = this.generateLeftPanel(main);
        // let explorer = this.generateExplorer(leftPanel);

        this.generateHeader(parentObj.header, "PHP Editor");
        //this.generateExplorer(parentObj.main.left);
        return;
    }


    async loadCSS(cssPath=this.root+"MEditor.css" ,parentObj=this.page) {

        parentObj.css = {};
        parentObj.css.loader = {};
        parentObj.css.loader.element = document.createElement("link");
        parentObj.css.loader.element.rel = "stylesheet";
        parentObj.css.loader.element.href = cssPath;

        parentObj.element.appendChild(parentObj.css.loader.element);

        // Wait to load css
        await new Promise((resolve) => {
            let load = async(event) => {
                parentObj.css.loader.element.removeEventListener("load", load);
                parentObj.css.loader.element.removeEventListener("error", error);
                resolve(event);
            }
            let error = async(event) => {
                parentObj.css.loader.element.removeEventListener("error", error);
                parentObj.css.loader.element.removeEventListener("load", load);
                console.error(event);
                resolve(event);
            }
            parentObj.css.loader.element.addEventListener("load", load);
            parentObj.css.loader.element.addEventListener("error", error);
        });
        return;
    }


    generateButton(parentObj, text, clickAction) {
        let button = {};
        button.element = document.createElement("button");
        button.element.classList.add(this.CLASS_NAME_PREFIX + "button");
        button.element.innerHTML = text;
        if(clickAction){
            button.element.addEventListener("click", clickAction.bind(this));
        }
        button.addTrigger = (event, func) => {
            button.element.addEventListener(event, func);
        }
        button.removeTrigger = (event, func) => {
            button.element.removeEventListener(event, func);
        }

        parentObj.element.appendChild(button.element);
        //if(name) parentObj[name] = button;
        //else
        return button;
    }


    generateHeader (parentObj, title="Editor") {
        parentObj.header = {};
        parentObj.header.element = document.createElement("div");
        parentObj.header.element.classList.add(this.CLASS_NAME_PREFIX + "header-container");

        parentObj.header.title = {};
        parentObj.header.title.element = document.createElement("h1");
        parentObj.header.title.element.classList.add(this.CLASS_NAME_PREFIX + "header-title");
        parentObj.header.title.element.innerHTML = title;

        parentObj.header.menu = {};
        parentObj.header.menu.element = document.createElement("div");
        parentObj.header.menu.element.classList.add(this.CLASS_NAME_PREFIX + "header-menu");

        parentObj.header.menu.items = [];
        let ThemeButton = this.generateButton(parentObj.header.menu, "Theme", (e) => {
            console.log("theme clicked");
            if(document.body.getAttribute("theme") == "dark"){
                document.body.setAttribute("theme", "light");
                this.THEME = "light";
            }
            else{
                document.body.setAttribute("theme", "dark");
                this.THEME = "dark";
            }
            this.changeThemeAction(this.THEME);
        });
        parentObj.header.menu.items.push(ThemeButton);

        parentObj.header.element.appendChild(parentObj.header.title.element);
        parentObj.header.element.appendChild(parentObj.header.menu.element);

        parentObj.element.appendChild(parentObj.header.element);

        return parentObj.header;
    }

    /**
     * 
     * @param {editorObject} attachTo Editorを配置する親要素 Ex: this.page.main.left
     * @returns explorerObject
     */
    createExplorer(attachTo = this.page.main.left, opt={}) {
        let explorer = this.generateExplorer(attachTo, opt);

        /**
         * 受け取ったオブジェクトをもとにエクスプローラーをロードする。
         * 
         * @param {object} explorerContents ファイルの情報を格納したオブジェクトの配列 例: [{name: "file.txt", type: "text"}, {name: "image.png", type: "image"}, {name: "dir1", type: "dir", files: [{name: "file2.php", type: "text"}]}]
         * 
         */
        explorer.loadExplorer = (explorerContents) => {

            let explorerContent = this.explorer;
            // clear old contents
            explorerContent.content.element.innerHTML = "";
            console.log(this.explorer);
            explorer.files = [];
            this.explorerRecursive(explorerContent, explorerContents);
        }


        /**
         * エクスプローラーのディレクトリ」のエキスパンドをトグルする
         * 
         * @param {string} path path must be starts with "/" and ends with "/"
         */
        explorer.toggleExpand = (path) => {

            let expandList = localStorage.getItem("explorerExpandedList");
            if(expandList){
                expandList = JSON.parse(expandList);
            }
            else{
                expandList = [];
            }

            let dir = document.getElementById(path);
            if(dir){
                let dirName = dir.getElementsByClassName(this.CLASS_NAME_PREFIX + "dir-name")[0];
                let dirContent = dir.getElementsByClassName(this.CLASS_NAME_PREFIX + "dir-content")[0];
                dirName.classList.toggle(this.CLASS_NAME_PREFIX + "dir-name-expanded");
                dirContent.classList.toggle(this.CLASS_NAME_PREFIX + "dir-content-show");
                //console.log(dirName, dirContent);
                if(dirName.classList.contains(this.CLASS_NAME_PREFIX + "dir-name-expanded")){
                    expandList.push(path);
                }
                else{
                    let index = expandList.indexOf(path);
                    if(index > -1){
                        expandList.splice(index, 1);
                    }
                }
                localStorage.setItem("explorerExpandedList", JSON.stringify(expandList));
                return true;
            }
            console.error("Directory not found: ", path);
            return false;
        }



        explorer.setTitle = (title) => {
            explorer.title.element.innerHTML = title;
        }

        explorer.setMenuTitle = (menuTitle) => {
            explorer.menu.text.element.innerHTML = menuTitle;
        }

        return explorer;
    }


    generateExplorer(parentObj, opt={}) {
        let defaultOpt = {
            title: "Explorer",
            menuTitle: "/"
        }
        opt = Object.assign(defaultOpt, opt);

        parentObj.explorer = {};
        parentObj.explorer.element = document.createElement("div");
        parentObj.explorer.element.classList.add(this.CLASS_NAME_PREFIX + "explorer");
        parentObj.explorer.files = [];
        parentObj.element.appendChild(parentObj.explorer.element);

        parentObj.explorer.title = {};
        parentObj.explorer.title.element = document.createElement("h3");
        parentObj.explorer.title.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-title");
        parentObj.explorer.title.element.innerHTML = opt.title;
        parentObj.explorer.element.appendChild(parentObj.explorer.title.element);

        parentObj.explorer.menu = {};
        parentObj.explorer.menu.element = document.createElement("div");
        parentObj.explorer.menu.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-menu");
        parentObj.explorer.element.appendChild(parentObj.explorer.menu.element);

        parentObj.explorer.menu.text = {};
        parentObj.explorer.menu.text.element = document.createElement("div");
        parentObj.explorer.menu.text.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-menu-text");
        parentObj.explorer.menu.text.element.innerHTML = opt.menuTitle;
        parentObj.explorer.menu.element.appendChild(parentObj.explorer.menu.text.element);

        parentObj.explorer.menu.control = {};
        parentObj.explorer.menu.control.element = document.createElement("div");
        parentObj.explorer.menu.control.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-menu-control");
        parentObj.explorer.menu.element.appendChild(parentObj.explorer.menu.control.element);

        parentObj.explorer.menu.control.items = [];
        let newFileButton = this.generateButton(
            parentObj.explorer.menu.control,
            "New File",
            (e) => {parentObj.explorer.newFileClickAction();}
        );
        
        parentObj.explorer.menu.control.items.push(newFileButton);
        //parentObj.explorer.menu.control.items.push(this.generateButton(parentObj.explorer.menu.control, "New Folder", this.EXPLORER_NEW_DIR_ACTION));
        let otherButton = this.generateButton(
            parentObj.explorer.menu.control,
            "⋮",
        );
        otherButton.addTrigger("click", (e) => {
            e.stopPropagation();
            console.log("menu clicked");

            this.popupMenu(otherButton, [
                {text: "New Folder", clickAction: (e) => {
                    parentObj.explorer.newDirClickAction();
                }},
                {text: "Upload", clickAction: (e) => {
                    parentObj.explorer.uploadClickAction(); 
                }},
            ]);
            this.page.popupMenuCloseAction = () => {
                //parentObj.explorer.content.element.style.overflowY = "auto";
            }
            //parentObj.explorer.content.element.style.overflowY = "hidden";
        });
        parentObj.explorer.menu.control.items.push(otherButton);


        parentObj.explorer.content = {};
        parentObj.explorer.content.element = document.createElement("div");
        parentObj.explorer.content.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-content");
        parentObj.explorer.element.appendChild(parentObj.explorer.content.element);


        // Methods

        parentObj.explorer.fileClickAction = (fileInfo) => {
            console.log(fileInfo);
        }
        parentObj.explorer.setFileClickAction = (func) => {
            parentObj.explorer.fileClickAction = func;
        }


        parentObj.explorer.newFileClickAction = (dir) => {
            console.log("new file: ", dir);
        }
        parentObj.explorer.setNewFileClickAction = (func) => {
            parentObj.explorer.newFileClickAction = func;
        }

        parentObj.explorer.newDirClickAction = (fileInfo) => {
            console.log("new dir: ", fileInfo);
        }
        parentObj.explorer.setNewDirClickAction = (func) => {
            parentObj.explorer.newDirClickAction = func;
        }

        parentObj.explorer.renameClickAction = (fileInfo) => {
            console.log("rename: ", fileInfo);
        }
        parentObj.explorer.setRenameClickAction = (func) => {
            parentObj.explorer.renameClickAction = func;
        }

        parentObj.explorer.duplicateClickAction = (fileInfo) => {
            console.log("duplicate: ", fileInfo);
        }
        parentObj.explorer.setDuplicateClickAction = (func) => {
            parentObj.explorer.duplicateClickAction = func;
        }

        parentObj.explorer.deleteClickAction = (fileInfo) => {
            console.log("delete: ", fileInfo);
        }
        parentObj.explorer.setDeleteClickAction = (func) => {
            parentObj.explorer.deleteClickAction = func;
        }


        // dir actions
        parentObj.explorer.renameDirClickAction = (dirInfo) => {
            console.log("rename dir: ", dirInfo);
        }
        parentObj.explorer.setRenameDirClickAction = (func) => {
            parentObj.explorer.renameDirClickAction = func;
        }

        parentObj.explorer.deleteDirClickAction = (dirInfo) => {
            console.log("delete dir: ", dirInfo);
        }
        parentObj.explorer.setDeleteDirClickAction = (func) => {
            parentObj.explorer.deleteDirClickAction = func;
        }


        parentObj.explorer.uploadClickAction = (dir) => {
            console.log("upload: ", dir);
        }

        parentObj.explorer.setUploadClickAction = (func) => {
            parentObj.explorer.uploadClickAction = func;
        }



        parentObj.explorer.setTitle = (title) => {
            parentObj.explorer.title.element.innerHTML = title;
        }


        this.explorer = parentObj.explorer;
        //console.log(this.explorer);

        return parentObj.explorer;
    }



    explorerRecursive(parentObj, dirInfo, currentDir="") {
        // build currentDir
        let currentDirName = currentDir + dirInfo.name
        if(!currentDirName.endsWith("/")) currentDirName += "/";

        for(let i=0; i<dirInfo.files.length; i++) {
            let fileInfo = dirInfo.files[i];
            if(fileInfo.type == "dir") {
                fileInfo.path = currentDirName + fileInfo.name;
                if(!fileInfo.path.endsWith("/")){
                    fileInfo.path += "/";
                }
                let dir = this.explorerDir(parentObj, fileInfo);
                this.explorerRecursive(dir, fileInfo, currentDirName);
            }
            else {
                let filePath = currentDirName + fileInfo.name;
                this.DEBUG && console.log(filePath);
                fileInfo.path = filePath;
                this.explorerFile(parentObj, fileInfo);
            }
        }
    }


    fileControl(parentObj, fileInfo) {
        let fileControl = {};
        fileControl.element = document.createElement("div");
        fileControl.element.classList.add(this.CLASS_NAME_PREFIX + "file-control");
        
        parentObj.control = fileControl;
        parentObj.element.appendChild(fileControl.element);

        let fileMenu = {};
        fileMenu = this.generateButton(fileControl, "⋮");
        fileMenu.element.classList.add(this.CLASS_NAME_PREFIX + "file-menu");
        fileMenu.addTrigger("click", (e) => {
            e.stopPropagation();
            console.log("file menu clicked:", fileInfo);
            this.popupMenu(fileMenu, [
                {text: "rename", clickAction: (e) => {this.explorer.renameClickAction(fileInfo);}},
                {text: "duplicate", clickAction: (e) => {this.explorer.duplicateClickAction(fileInfo);}},
                {text: "delete", clickAction: (e) => {this.explorer.deleteClickAction(fileInfo);}},
            ]);
            this.page.popupMenuCloseAction = () => {
                this.explorer.content.element.style.overflowY = "auto";
            }
            this.explorer.content.element.style.overflowY = "hidden";
        });

        fileControl.menu = fileMenu;
        
        return fileControl;
    }

    explorerFile(parentObj, fileInfo) {
        let file = {};
        file.name = fileInfo.name;
        file.type = fileInfo.type;
        file.path = fileInfo.path;
        file.element = document.createElement("button");
        file.element.id = file.path;
        file.element.classList.add(this.CLASS_NAME_PREFIX + "file");
        file.element.title = fileInfo.path;
        // highlight selected file
        file.element.addEventListener("click", (e) => {
            let old = document.getElementsByClassName(this.CLASS_NAME_PREFIX + "file-selected");
            for(let i=0; i<old.length; i++) {
                old[i].classList.remove(this.CLASS_NAME_PREFIX + "file-selected");
            }
            file.element.classList.toggle(this.CLASS_NAME_PREFIX + "file-selected");
        });
        file.element.addEventListener("click", function a(e) {
            this.explorer.fileClickAction(fileInfo);
        }.bind(this));

        let fileName = {};
        fileName.element = document.createElement("div");
        fileName.element.classList.add(this.CLASS_NAME_PREFIX + "file-name");
        fileName.element.innerHTML = file.name;
        file.element.appendChild(fileName.element);
        file.nameElm = fileName;
        
        let fileControl = this.fileControl(file, fileInfo);
        file.control = fileControl;

        parentObj.content.element.appendChild(file.element);
        parentObj.files.push(file);
    }

    dirControl(parentObj, dirInfo){
        let dirControl = {};
        dirControl.element = document.createElement("div");
        dirControl.element.classList.add(this.CLASS_NAME_PREFIX + "dir-control");

        parentObj.control = dirControl;
        parentObj.element.appendChild(dirControl.element);

        let dirMenu = {};
        dirMenu = this.generateButton(dirControl, "⋮");
        dirMenu.element.classList.add(this.CLASS_NAME_PREFIX + "dir-menu-button");
        dirMenu.addTrigger("click", (e) => {
            e.stopPropagation();
            console.log("dir menu clicked:", dirInfo);
            this.popupMenu(dirMenu, [
                {text: "rename", clickAction: (e) => {
                    //console.log("rename: ", dirInfo);
                    this.explorer.renameDirClickAction(dirInfo);
                }},
                {text: "new file", clickAction: (e) => {
                    //console.log("new file: ", dirInfo);
                    this.explorer.newFileClickAction(dirInfo);
                }},
                {text: "new folder", clickAction: (e) => {
                    //console.log("new folder: ", dirInfo);
                    this.explorer.newDirClickAction(dirInfo);
                }},
                {text: "upload", clickAction: (e) => {
                    //console.log("upload: ", dirInfo);
                    this.explorer.uploadClickAction(dirInfo);
                }},
                {text: "delete", clickAction: (e) => {
                    //console.log("delete: ", dirInfo);
                    this.explorer.deleteDirClickAction(dirInfo);
                }}
            ]);
            this.page.popupMenuCloseAction = () => {
                this.explorer.content.element.style.overflowY = "auto";
            }
            this.explorer.content.element.style.overflowY = "hidden";
        })

        dirControl.menu = dirMenu;

        return dirControl;
    }

    explorerDir(parentObj, dirInfo) {
        let dir = {};
        dir.name = dirInfo.name;
        dir.type = dirInfo.type;
        dir.path = dirInfo.path;
        dir.files = [];
        dir.element = document.createElement("div");
        dir.element.id = dir.path;
        dir.element.classList.add(this.CLASS_NAME_PREFIX + "dir");
        
        let dirMenu = {};
        dirMenu.element = document.createElement("button");
        dirMenu.element.classList.add(this.CLASS_NAME_PREFIX + "dir-menu");
        dirMenu.element.title = dirInfo.name;
        dirMenu.element.addEventListener("click", (e) => {
            this.explorer.toggleExpand(dir.path);
        });
        dir.element.appendChild(dirMenu.element);
        dir.menu = dirMenu;

        let dirName = {};
        dirName.element = document.createElement("div");
        dirName.element.classList.add(this.CLASS_NAME_PREFIX + "dir-name");
        dirName.element.innerHTML = dir.name + "/";
        dirMenu.element.appendChild(dirName.element);
        dirMenu.name = dirName;

        let dirContent = {};
        dirContent.element = document.createElement("div");
        dirContent.element.classList.add(this.CLASS_NAME_PREFIX + "dir-content");
        dir.element.appendChild(dirContent.element);
        dir.content = dirContent;


        // expand dir if it is in the expanded list
        let expandList = localStorage.getItem("explorerExpandedList");
        if(expandList){
            expandList = JSON.parse(expandList);
            if(expandList.includes(dir.path)){
                dirName.element.classList.add(this.CLASS_NAME_PREFIX + "dir-name-expanded");
                dirContent.element.classList.add(this.CLASS_NAME_PREFIX + "dir-content-show");
            }
        }


        let dirControl = this.dirControl(dirMenu, dirInfo);
        dir.control = dirControl;

        parentObj.content.element.appendChild(dir.element);
        parentObj.files.push(dir);
        return dir;
    }



    generateEditorMenu(parentObj) {
        let menu = {};
        menu.element = document.createElement("div");
        menu.element.classList.add(this.CLASS_NAME_PREFIX + "editor-menu");
        parentObj.element.appendChild(menu.element);
        parentObj.menu = menu;

        let menuLeft = {};
        menuLeft.items = [];
        menuLeft.element = document.createElement("div");
        menuLeft.element.classList.add(this.CLASS_NAME_PREFIX + "editor-menu-left");
        menu.element.appendChild(menuLeft.element);
        menu.left = menuLeft;
        

        let menuRight = {};
        menuRight.items = [];
        menuRight.element = document.createElement("div");
        menuRight.element.classList.add(this.CLASS_NAME_PREFIX + "editor-menu-right");
        menu.element.appendChild(menuRight.element);
        menu.right = menuRight;

        return menu;
    }

    /**
     * 
     * @param {editorObject} parentObj 
     */
    editorMenu(parentObj) {
        let menu = this.generateEditorMenu(parentObj);
        return menu;
    }


    imageViewer(parentObj, src) {
        let imgViewer = {};
        imgViewer.element = document.createElement("div");
        imgViewer.element.classList.add(this.CLASS_NAME_PREFIX + "image-viewer-container");
        parentObj.element.appendChild(imgViewer.element);
        
        let img = {};
        img.element = document.createElement("img");
        img.element.src = src;
        img.element.classList.add(this.CLASS_NAME_PREFIX + "image-viewer");
        imgViewer.element.appendChild(img.element);
        imgViewer.img = img;

        return imgViewer;
    }

    viewerMessage(parentObj, message) {
        let msgContainer = {};
        msgContainer.element = document.createElement("div");
        msgContainer.element.classList.add(this.CLASS_NAME_PREFIX + "viewer-message-container");
        parentObj.element.appendChild(msgContainer.element);

        let msg = {};
        msg.element = document.createElement("div");
        msg.element.classList.add(this.CLASS_NAME_PREFIX + "viewer-message");
        msg.element.innerHTML = message;
        msgContainer.element.appendChild(msg.element);
        msgContainer.msg = msg;

        return msgContainer;
    }


    console(parentObj) {
        let mConsole = {};
        mConsole.element = document.createElement("div");
        mConsole.element.classList.add(this.CLASS_NAME_PREFIX + "console");
        parentObj.element.appendChild(mConsole.element);

        let consoleMenu = {};
        consoleMenu.element = document.createElement("div");
        consoleMenu.element.classList.add(this.CLASS_NAME_PREFIX + "console-menu");
        mConsole.element.appendChild(consoleMenu.element);
        mConsole.menu = consoleMenu;

        let consoleContent = {};
        consoleContent.element = document.createElement("div");
        consoleContent.element.classList.add(this.CLASS_NAME_PREFIX + "console-content");
        mConsole.element.appendChild(consoleContent.element);
        mConsole.content = consoleContent;

        let consoleTextarea = {};
        consoleTextarea.element = document.createElement("div");
        consoleTextarea.element.classList.add(this.CLASS_NAME_PREFIX + "console-textarea");
        consoleContent.element.appendChild(consoleTextarea.element);
        mConsole.textarea = consoleTextarea;

        
        // variables
        mConsole.autoScroll = true;

        
        // methods
        /**
         * clear console history
         */
        mConsole.clear = () => {
            consoleTextarea.element.innerHTML = "";
        }

        /**
         * set auto scroll
         */
        mConsole.setAutoScroll = (bool) => {
            mConsole.autoScroll = bool;
        }

        /**
         * print text to console
         * @param {string} text
         * @param {"info" | "success" | "warning" | "error"} mode
         */
        mConsole.print = (text, mode = "info") => {
            this.DEBUG && console.log("console out: ", text);
            let out = consoleTextarea.element;
            if (typeof text != "string") {
                text = text.toString();
            }
            text.replaceAll("\n", "<br>");

            let line = document.createElement("span");
            line.innerHTML = text;
            line.classList.add(this.CLASS_NAME_PREFIX + "console-line");
            if(mode == "info") {
                line.classList.add(this.CLASS_NAME_PREFIX + "console-line-info");
            }
            else if(mode == "success") {
                line.classList.add(this.CLASS_NAME_PREFIX + "console-line-accept");
            }
            else if(mode == "warning") {
                line.classList.add(this.CLASS_NAME_PREFIX + "console-line-warning");
            }
            else if(mode == "error") {
                line.classList.add(this.CLASS_NAME_PREFIX + "console-line-error");
            }
            out.appendChild(line);
            out.appendChild(document.createElement("br"));

            if(mConsole.autoScroll) {
                DEBUG && console.log("scrolling", out);
                out.scrollTop = out.scrollHeight;
            }
        }




        return mConsole;
    }
    

    workPlace(parentObj) {
        let workPlace = {};
        workPlace.element = document.createElement("div");
        workPlace.element.classList.add(this.CLASS_NAME_PREFIX + "editor");
        parentObj.element.appendChild(workPlace.element);
        parentObj.workPlace = workPlace;

        this.workPlace = workPlace;

        let workPlaceMenu = this.editorMenu(workPlace);
        workPlace.menu = workPlaceMenu;

        let content = {};
        content.element = document.createElement("div");
        content.element.classList.add(this.CLASS_NAME_PREFIX + "editor-content");
        workPlace.element.appendChild(content.element);
        workPlace.content = content;

        return workPlace;
    }



    removePopupMenus() {
        for(let i=0; i<this.page.popupMenus.length; i++) {
            this.page.popupMenus[i].element.remove();
            window.removeEventListener("click", this.removePopupMenus.bind(this));
        }
        this.page.popupMenus = [];
        this.page.popupMenuCloseAction();
        this.page.popupMenuCloseAction = () => {};
    }

    popupMenu(
        parentObj, 
        contents=[{text: "Menu1", clickAction: (e) => {console.log("menu1");}}, {text: "Menu2", clickAction: (e) => {}}]
    ) {

        this.removePopupMenus();

        let menu = {};
        menu.element = document.createElement("div");
        menu.element.classList.add(this.CLASS_NAME_PREFIX + "popup-menu");
        this.page.element.appendChild(menu.element);

        menu.contents = contents;

        for(let i=0; i<menu.contents.length; i++) {
            let content = {};
            content.element = document.createElement("button");
            content.element.classList.add(this.CLASS_NAME_PREFIX + "popup-menu-item");
            content.element.innerHTML = contents[i].text;
            content.element.addEventListener("click", contents[i].clickAction);
            menu.element.appendChild(content.element);
            menu.contents[i].element = content;
        }

        // let parentTop = parentObj.element.offsetTop;
        
        // let parentBoundingTop = parentObj.element.getBoundingClientRect().top;

        // let gap = parentBoundingTop - parentTop;

        // console.log("menu bottom out of page");
        // console.log("parent offsetTop: " + parentObj.element.offsetTop);
        // console.log("parent bounding top: " + parentObj.element.getBoundingClientRect().top);
        // console.log("page top: " + this.page.top);
        // console.log("page bounding top: " + this.page.element.getBoundingClientRect().bottom);
        // console.log("menu clientHight: " + menu.element.clientHeight);
        // console.log("gap: " + gap);
        
        // if(menu.element.getBoundingClientRect().bottom > this.page.element.getBoundingClientRect().bottom){
        //     menu.element.style.top = this.page.element.getBoundingClientRect().bottom - menu.element.clientHeight - gap + "px";
        // }
        // else{
        //     menu.element.style.top = parentObj.element.getBoundingClientRect().top - gap + "px";
        // }
        if(parentObj.element.getBoundingClientRect().bottom + menu.element.clientHeight > this.page.element.getBoundingClientRect().bottom){
            menu.element.style.top = parentObj.element.getBoundingClientRect().bottom - menu.element.clientHeight + "px";
        }
        else{
            menu.element.style.top = parentObj.element.getBoundingClientRect().top + window.scrollY + "px";
        }
        menu.element.style.left = parentObj.element.getBoundingClientRect().right + window.scrollX + "px";

        window.addEventListener("click", this.removePopupMenus.bind(this));

        this.page.popupMenus.push(menu);

        return menu;
    }


    activatePopupWindow(pWindow) {
        let parentElm = pWindow.element.parentElement;
        if(parentElm == null){
            console.log("popup window parent element is null");
            return;
        }
        parentElm.appendChild(pWindow.element);
    }

    popupWindow(title, contents) {
        let pWindow = {};
        pWindow.title = title;


        pWindow.element = document.createElement("div");
        pWindow.element.addEventListener("click", function a(e) {
            this.activatePopupWindow(pWindow);
            //console.log(e);
            if(e.target.tagName == "INPUT" || e.target.tagName == "TEXTAREA"){
                e.target.focus();
            }
        }.bind(this));
        pWindow.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window");

        let pWindowTitleBar = {};
        pWindowTitleBar.element = document.createElement("div");
        pWindowTitleBar.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window-title-bar");
        pWindowTitleBar.element.addEventListener("mousedown", function a(e){
            //console.log("window title bar clicked");
            this.activatePopupWindow(pWindow);
            if(e.target != e.currentTarget){
                return;
            }
            
            let startCursor = {x: e.clientX, y: e.clientY};
            //console.log("start cursor:", startCursor);

            function movement(e) {
                let dx = e.clientX - startCursor.x;
                let dy = e.clientY - startCursor.y;
                let l = pWindow.element.getBoundingClientRect().left + dx;
                let t = pWindow.element.getBoundingClientRect().top + dy;
                //console.log("mouse move:", e.clientX, e.clientY, dx, dy, l, t);
                pWindow.element.style.transform = "translate(0, 0)";
                pWindow.element.style.left = l + "px";
                pWindow.element.style.top = t + "px";
                startCursor = {x: e.clientX, y: e.clientY};
            }
            window.addEventListener("mousemove", movement);

            window.addEventListener("mouseup", (e) => {
                window.removeEventListener("mousemove", movement);
                window.removeEventListener("mouseup", a);
            });
        }.bind(this));
        
        pWindow.element.appendChild(pWindowTitleBar.element);

        let pWindowTitle = {};
        pWindowTitle.element = document.createElement("div");
        pWindowTitle.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window-title");
        pWindowTitle.element.innerHTML = title;
        pWindowTitleBar.element.appendChild(pWindowTitle.element);

        let pWindowTitleBarControl = {};
        pWindowTitleBarControl.element = document.createElement("div");
        pWindowTitleBarControl.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window-title-bar-controls");
        pWindowTitleBar.element.appendChild(pWindowTitleBarControl.element);

        let pWindowCloseButton = {};
        pWindowCloseButton.element = document.createElement("button");
        pWindowCloseButton.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window-close-button");
        pWindowCloseButton.element.innerHTML = "×";
        pWindowCloseButton.element.addEventListener("click", (e) => {
            e.stopPropagation();
            pWindow.element.remove();
            this.page.popupWindows = this.page.popupWindows.filter((item) => item != pWindow);
        });
        pWindowTitleBarControl.element.appendChild(pWindowCloseButton.element);


        let pWindowContent = {};
        pWindowContent.element = document.createElement("div");
        pWindowContent.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window-content");
        pWindow.element.appendChild(pWindowContent.element);

        // add contents
        if(Array.isArray(contents)){
            for(let i=0; i<contents.length; i++) {
                if(contents[i] instanceof HTMLElement){
                    pWindowContent.element.appendChild(contents[i]);
                }
                else{
                    console.error("contents must be an array of HTMLElement");
                }
            }
        }
        else if(contents instanceof HTMLElement){
            pWindowContent.element.appendChild(contents);
        }
        else{
            console.error("contents must be an array or HTMLElement");
        }

        this.page.element.appendChild(pWindow.element);

        if(!this.page.popupWindows){
            this.page.popupWindows = [];
        }
        this.page.popupWindows.push(pWindow);



        // methods
        pWindow.remove = () => {
            pWindow.element.remove();
            this.page.popupWindows = this.page.popupWindows.filter((item) => item != pWindow);
        }



        return pWindow;
    }

    // =============== Public Methods ===============

    /**
     * エディタのレイアウトを再適用する。エディタのコンテナ要素のサイズが変更されたときなどに呼び出す。
     */
    adjustEditor() {
        this.adjustPage();
    }


}












