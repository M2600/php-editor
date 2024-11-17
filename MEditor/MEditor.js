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


        this.editor.commands.addCommand({
            name: "save",
            bindKey: {
                win: "Ctrl-S",
                mac: "Command-S"
            },
            exec: function (editor) {
                console.log("save shortcut")
                //pushSaveButton();
            }
        });

        this.editor.commands.addCommand({
            name: "run",
            bindKey: {
                win: "F10",
                mac: "",
            },
            exec: function (editor) {
                console.log("run shortcut");
                //pushRunButton();
                //openInOtherWindow();
            }
        })
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
        
        
        
    }

    adjustSash() {
        let parentElement = this.page.element;
        let left = this.page.main.left;
        let mid = this.page.main.mid;
        let right = this.page.main.right;

        left.sash.element.style.left = parentElement.clientLeft + left.element.clientWidth - this.pageSettings.splitSash.width / 2 + "px";
        mid.container.bottom.sash.element.style.top = mid.container.main.element.clientHeight - this.pageSettings.splitSash.width / 2 + "px";
        right.sash.element.style.left = parentElement.clientLeft + parentElement.clientWidth - right.element.clientWidth - this.pageSettings.splitSash.width / 2 + "px";
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


    generateButton(parentObj, text, clickAction, name="") {
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
        if(name) parentObj[name] = button;
        //else
        return button;
    }


    generateHeader (parentObj, title="Editor") {
        parentObj.header = {};
        parentObj.header.element = document.createElement("div");
        parentObj.header.element.classList.add(this.CLASS_NAME_PREFIX + "header");

        parentObj.header.title = {};
        parentObj.header.title.element = document.createElement("h1");
        parentObj.header.title.element.classList.add(this.CLASS_NAME_PREFIX + "header-title");
        parentObj.header.title.element.innerHTML = title;

        parentObj.header.menu = {};
        parentObj.header.menu.element = document.createElement("div");
        parentObj.header.menu.element.classList.add(this.CLASS_NAME_PREFIX + "header-menu");

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
    createExplorer(attachTo = this.page.main.left) {
        let explorer = this.generateExplorer(attachTo);

        /**
         * 受け取ったオブジェクトをもとにエクスプローラーをロードする。
         * 
         * @param {object} explorerContents ファイルの情報を格納したオブジェクトの配列 例: [{name: "file.txt", type: "text"}, {name: "image.png", type: "image"}, {name: "dir1", type: "dir", files: [{name: "file2.php", type: "text"}]}]
         * 
         */
        explorer.loadExplorer = (explorerContents) => {

            let explorerContent = this.explorer;
            console.log(this.explorer);

            this.explorerRecursive(explorerContent, explorerContents);
        }

        return explorer;
    }


    generateExplorer(parentObj) {
        parentObj.explorer = {};
        parentObj.explorer.element = document.createElement("div");
        parentObj.explorer.element.classList.add(this.CLASS_NAME_PREFIX + "explorer");
        parentObj.explorer.files = [];
        parentObj.element.appendChild(parentObj.explorer.element);

        parentObj.explorer.title = {};
        parentObj.explorer.title.element = document.createElement("h2");
        parentObj.explorer.title.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-title");
        parentObj.explorer.title.element.innerHTML = "Explorer";
        parentObj.explorer.element.appendChild(parentObj.explorer.title.element);

        parentObj.explorer.menu = {};
        parentObj.explorer.menu.element = document.createElement("div");
        parentObj.explorer.menu.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-menu");
        parentObj.explorer.element.appendChild(parentObj.explorer.menu.element);

        parentObj.explorer.menu.text = {};
        parentObj.explorer.menu.text.element = document.createElement("div");
        parentObj.explorer.menu.text.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-menu-text");
        parentObj.explorer.menu.text.element.innerHTML = "Menu";
        parentObj.explorer.menu.element.appendChild(parentObj.explorer.menu.text.element);

        parentObj.explorer.menu.control = {};
        parentObj.explorer.menu.control.element = document.createElement("div");
        parentObj.explorer.menu.control.element.classList.add(this.CLASS_NAME_PREFIX + "explorer-menu-control");
        parentObj.explorer.menu.element.appendChild(parentObj.explorer.menu.control.element);

        parentObj.explorer.menu.control.items = [];
        parentObj.explorer.menu.control.items.push(this.generateButton(parentObj.explorer.menu.control, "New File", () => {
            console.log("New File");
        }));
        parentObj.explorer.menu.control.items.push(this.generateButton(parentObj.explorer.menu.control, "New Folder", () => {
            console.log("New Folder");
        }));
        parentObj.explorer.menu.control.items.push(this.generateButton(parentObj.explorer.menu.control, "⋮", () => {
            console.log("Menu");
        }));


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

        parentObj.explorer.setTitle = (title) => {
            parentObj.explorer.title.element.innerHTML = title;
        }


        this.explorer = parentObj.explorer;
        //console.log(this.explorer);

        return parentObj.explorer;
    }



    explorerRecursive(parentObj, dirInfo) {
        for(let i=0; i<dirInfo.files.length; i++) {
            let fileInfo = dirInfo.files[i];
            if(fileInfo.type == "dir") {
                let dir = this.explorerDir(parentObj, fileInfo);
                this.explorerRecursive(dir, fileInfo);
            }
            else {
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
                {text: "rename", clickAction: (e) => {console.log("rename", fileInfo);}},
                {text: "duplicate", clickAction: (e) => {console.log("duplicate", fileInfo);}},
                {text: "delete", clickAction: (e) => {console.log("delete", fileInfo);}},
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
        file.element = document.createElement("button");
        file.element.id = file.name;
        file.element.classList.add(this.CLASS_NAME_PREFIX + "file");
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

    explorerDir(parentObj, dirInfo) {
        let dir = {};
        dir.name = dirInfo.name;
        dir.type = dirInfo.type;
        dir.files = [];
        dir.element = document.createElement("div");
        dir.element.id = dir.name;
        dir.element.classList.add(this.CLASS_NAME_PREFIX + "dir");
        
        let dirMenu = {};
        dirMenu.element = document.createElement("button");
        dirMenu.element.classList.add(this.CLASS_NAME_PREFIX + "dir-menu");
        dirMenu.element.addEventListener("click", (e) => {
            dirName.element.classList.toggle(this.CLASS_NAME_PREFIX + "dir-name-expanded");
            dirContent.element.classList.toggle(this.CLASS_NAME_PREFIX + "dir-content-show");
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


        parentObj.content.element.appendChild(dir.element);
        parentObj.files.push(dir);
        return dir;
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


    popupWindow(parentObj, title) {
        let dialog = {};
        dialog.element = document.createElement("div");
        dialog.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window");

        let dialogTitle = {};
        dialogTitle.element = document.createElement("div");
        dialogTitle.element.classList.add(this.CLASS_NAME_PREFIX + "popup-window-title");
        dialogTitle.element.innerHTML = title;
        dialog.element.appendChild(dialogTitle.element);
        
        parentObj.element.appendChild(dialog.element);
        parentObj.popupWindows.push(dialog);
        return dialog;
    }

    // =============== Public Methods ===============

    /**
     * エディタのレイアウトを再適用する。エディタのコンテナ要素のサイズが変更されたときなどに呼び出す。
     */
    adjustEditor() {
        this.adjustPage();
    }


}












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
