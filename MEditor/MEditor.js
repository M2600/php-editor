// general functions

class Path {
    constructor(path){
        
    }

    static join(...paths){
        let path = "";
        paths.forEach((p) => {
            path += "/" + p;
        })
        path = path.replace(/\/+/g, "/");
        if(path[path.length - 1] != "/"){
            path += "/";
        }
        return path;
    }

    static joinAsFile(...paths){
        let path = this.join(...paths);
        path = path.replace(/\/$/, "");
        return path;
    }

    
}



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
        //delete this.editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-p"];

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


    on(event, job) {
        this.editor.getSession().on(event, job);
    }
    off(event, job) {
        this.editor.getSession().off(event, job);
    }
    
    removeAllListeners(event) {
        this.editor.getSession().removeAllListeners(event);
    }



    /**
     * Load my settings
     */
    loadMySettings() {
        this.mySettings();
        this.myKeybindings();
        this.myEvents();
        this.setupAIAssistant();
    }

    /**
     * Setup AI Assistant for this editor
     */
    setupAIAssistant() {
        // Add AI commands to the editor if AI Assistant is available
        if (typeof aiAssistant !== 'undefined') {
            aiAssistant.addAICommands(this.editor);
        }
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
        this.root=document.querySelector('script[src*="MEditor.js"]').outerHTML.match(/\"(.*)MEditor.js(.*)\"/)[1]||'./';


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

        (function() {
            document.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' && e.isComposing) || e.keyCode === 229) {
                    e.stopPropagation();
                }
            }, { capture: true });
        })();

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

    // localStorage キー
    STORAGE_KEYS = {
        leftWidth: 'meditor-left-width',
        rightWidth: 'meditor-right-width',
        bottomHeight: 'meditor-bottom-height'
    }

    // パネルサイズをlocalStorageに保存
    savePanelSizes() {
        if (!this.page || !this.page.main) return;
        const left = this.page.main.left.element;
        const right = this.page.main.right.element;
        const mid = this.page.main.mid.element;
        const midMain = this.page.main.mid.container.main.element;
        const midBottom = this.page.main.mid.container.bottom.element;
        // 幅・高さを取得
        const leftWidth = left.offsetWidth;
        const rightWidth = right.offsetWidth;
        const bottomHeight = midBottom.offsetHeight;
        localStorage.setItem(this.STORAGE_KEYS.leftWidth, leftWidth.toString());
        localStorage.setItem(this.STORAGE_KEYS.rightWidth, rightWidth.toString());
        localStorage.setItem(this.STORAGE_KEYS.bottomHeight, bottomHeight.toString());
    }

    // localStorageからパネルサイズを復元
    restorePanelSizes() {
        if (!this.page || !this.page.main) return;
        const parentElement = this.page.element;
        const left = this.page.main.left.element;
        const right = this.page.main.right.element;
        const mid = this.page.main.mid.element;
        const midMain = this.page.main.mid.container.main.element;
        const midBottom = this.page.main.mid.container.bottom.element;

        const savedLeftWidth = localStorage.getItem(this.STORAGE_KEYS.leftWidth);
        const savedRightWidth = localStorage.getItem(this.STORAGE_KEYS.rightWidth);
        const savedBottomHeight = localStorage.getItem(this.STORAGE_KEYS.bottomHeight);

        // まず左右・下部のサイズをセット
        let leftWidth = left.offsetWidth;
        let rightWidth = right.offsetWidth;
        let bottomHeight = midBottom.offsetHeight;
        if (savedLeftWidth) {
            const w = parseInt(savedLeftWidth);
            if (w >= this.pageSettings.split.minWidth) leftWidth = w;
        }
        if (savedRightWidth) {
            const w = parseInt(savedRightWidth);
            if (w >= this.pageSettings.split.minWidth) rightWidth = w;
        }
        if (savedBottomHeight) {
            const h = parseInt(savedBottomHeight);
            if (h >= this.pageSettings.split.minHeight) bottomHeight = h;
        }
        // パネル幅・高さを反映
        left.style.width = leftWidth + 'px';
        right.style.width = rightWidth + 'px';
        midBottom.style.height = bottomHeight + 'px';

        // midパネルの幅・高さを再計算
        const totalWidth = parentElement.clientWidth;
        const midWidth = totalWidth - leftWidth - rightWidth;
        mid.style.width = midWidth + 'px';
        mid.style.left = leftWidth + 'px';

        // midMainの高さ
        const totalHeight = mid.offsetHeight;
        const midMainHeight = totalHeight - bottomHeight;
        midMain.style.height = midMainHeight + 'px';
        midBottom.style.top = midMainHeight + 'px';

        // 最後に全体再調整
        this.adjustPage();
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
            // テキスト選択防止
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.userSelect = "none";
            window.addEventListener("mousemove", leftSashMove);
            window.addEventListener("mouseup", function a (e){
                window.removeEventListener("mousemove", leftSashMove);
                window.removeEventListener("mouseup", a);
                document.body.style.userSelect = prevUserSelect;
                // サイズ変更完了時にlocalStorageに保存
                this.savePanelSizes();
            }.bind(this));
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
            // テキスト選択防止
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.userSelect = "none";
            window.addEventListener("mousemove", midSashMove);
            window.addEventListener("mouseup", function a(e) {
                window.removeEventListener("mousemove", midSashMove);
                window.removeEventListener("mouseup", a);
                document.body.style.userSelect = prevUserSelect;
                // サイズ変更完了時にlocalStorageに保存
                this.savePanelSizes();
            }.bind(this));
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

        right.hide = () => {
            right.element.style.display = "none";
            rightSash.element.style.display = "none";
            this.adjustPage();
        }


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
            // テキスト選択防止
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.userSelect = "none";
            window.addEventListener("mousemove", rightSashMove);
            window.addEventListener("mouseup", function a(e) {
                window.removeEventListener("mousemove", rightSashMove);
                window.removeEventListener("mouseup", a);
                document.body.style.userSelect = prevUserSelect;
                // サイズ変更完了時にlocalStorageに保存
                this.savePanelSizes();
            }.bind(this));
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
        
        // パネルサイズをlocalStorageから復元
        this.restorePanelSizes();
        
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
            if (!this.BASE_DIR){
                this.BASE_DIR = explorerContents.path;
            }
            if (!this.BASE_DIR.endsWith("/")){
                this.BASE_DIR += "/";
            }
            
            // this.BASE_DIR is not "/" and add "../" file to explorerContents
            if (this.BASE_DIR != "/") {
                let parentDir = {
                    name: "../",
                    type: "file",
                }
                explorerContents.files.unshift(parentDir);
            }
            this.DEBUG && console.log("explorer.loadExplorer() explorerContents: ", explorerContents);
            
            let explorerContent = this.explorer;
            // clear old contents
            explorerContent.content.element.innerHTML = "";
            //console.log(this.explorer);
            explorer.files = [];
            this.explorerRecursive(explorerContent, explorerContents, this.BASE_DIR);
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
                let dirIcon = dir.getElementsByClassName(this.CLASS_NAME_PREFIX + "dir-icon")[0];
                let dirContent = dir.getElementsByClassName(this.CLASS_NAME_PREFIX + "dir-content")[0];
                dirName.classList.toggle(this.CLASS_NAME_PREFIX + "dir-name-expanded");
                dirContent.classList.toggle(this.CLASS_NAME_PREFIX + "dir-content-show");
                // toggle icon
                if(dirName.classList.contains(this.CLASS_NAME_PREFIX + "dir-name-expanded")){
                    dirIcon.innerHTML = "▼";
                }
                else{
                    dirIcon.innerHTML = "▶";
                }
                //console.log(dirName, dirContent);
                // save to localStorage
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
                {text: "New Folder", title: "Create New Folder", clickAction: (e) => {
                    parentObj.explorer.newDirClickAction();
                }},
                {text: "Upload", title: "Upload File", clickAction: (e) => {
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

        parentObj.explorer.dirClickAction = (dirInfo) => {
            console.log(dirInfo);
        }
        parentObj.explorer.setDirClickAction = (func) => {
            parentObj.explorer.dirClickAction = func;
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

        parentObj.explorer.moveClickAction = (fileInfo) => {
            console.log("move: ", fileInfo);
        }
        parentObj.explorer.setMoveClickAction = (func) => {
            parentObj.explorer.moveClickAction = func;
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
        let currentDirName = Path.join(currentDir, dirInfo.name);

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
                //this.DEBUG && console.log(filePath);
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
                {text: "rename", title: "Rename File", clickAction: (e) => {this.explorer.renameClickAction(fileInfo);}},
                {text: "move", title: "Move File", clickAction: (e) => {
                    e.stopPropagation();
                    this.explorer.moveClickAction(fileInfo);
                }},
                {text: "duplicate", title: "Duplicate File", clickAction: (e) => {this.explorer.duplicateClickAction(fileInfo);}},
                {text: "delete", title: "Delete File", clickAction: (e) => {this.explorer.deleteClickAction(fileInfo);}},
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
        if (fileInfo.name == "../"){
            file.element.addEventListener("click", (e) => {
                let old = document.getElementsByClassName(this.CLASS_NAME_PREFIX + "file-selected");
                for(let i=0; i<old.length; i++) {
                    old[i].classList.remove(this.CLASS_NAME_PREFIX + "file-selected");
                }
                this.explorer.dirClickAction(fileInfo);
            });
        }
        else{
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
        }

        let fileName = {};
        fileName.element = document.createElement("div");
        fileName.element.classList.add(this.CLASS_NAME_PREFIX + "file-name");
        fileName.element.innerHTML = file.name;
        file.element.appendChild(fileName.element);
        file.nameElm = fileName;

        // 追加アイコン表示（例: 未保存*や警告など）
        file.iconElm = null;
        if (fileInfo.icon) {
            let iconElm = document.createElement("span");
            iconElm.classList.add(this.CLASS_NAME_PREFIX + "file-icon");
            // icon: 文字列（例: "*"）、または {text, title, class} 形式も許容
            if (typeof fileInfo.icon === "string") {
                iconElm.textContent = fileInfo.icon;
            } else if (typeof fileInfo.icon === "object") {
                iconElm.textContent = fileInfo.icon.text || "";
                if (fileInfo.icon.title) iconElm.title = fileInfo.icon.title;
                if (fileInfo.icon.class) iconElm.classList.add(fileInfo.icon.class);
            }
            fileName.element.appendChild(iconElm);
            file.iconElm = iconElm;
        }

        let fileControl = this.fileControl(file, fileInfo);
        file.control = fileControl;

        parentObj.content.element.appendChild(file.element);
        parentObj.files.push(file);
    }

    /**
     * ファイルパスを指定してエクスプローラのファイルアイコンを外部から追加・更新・削除する
     * @param {string} path ファイルの絶対パス（explorerFileで設定されるfile.pathと同じ）
     * @param {string|object|null} icon 追加したいアイコン（"*"や{ text, title, class }）。null/空で非表示
     */
    setFileIcon(path, icon) {
        // ファイル要素を取得
        const fileBtn = document.getElementById(path);
        if (!fileBtn) return false;
        // ファイル名要素
        const fileNameDiv = fileBtn.querySelector('.' + this.CLASS_NAME_PREFIX + 'file-name');
        if (!fileNameDiv) return false;
        // 既存アイコン要素
        let iconElm = fileNameDiv.querySelector('.' + this.CLASS_NAME_PREFIX + 'file-icon');
        if (iconElm) {
            if (!icon) {
                iconElm.remove();
                return true;
            }
            // 更新
            if (typeof icon === "string") {
                iconElm.textContent = icon;
                iconElm.title = "";
                iconElm.className = this.CLASS_NAME_PREFIX + "file-icon";
            } else if (typeof icon === "object") {
                iconElm.textContent = icon.text || "";
                iconElm.title = icon.title || "";
                iconElm.className = this.CLASS_NAME_PREFIX + "file-icon";
                if (icon.class) iconElm.classList.add(icon.class);
            }
            return true;
        } else if (icon) {
            // 新規追加
            iconElm = document.createElement("span");
            iconElm.classList.add(this.CLASS_NAME_PREFIX + "file-icon");
            if (typeof icon === "string") {
                iconElm.textContent = icon;
            } else if (typeof icon === "object") {
                iconElm.textContent = icon.text || "";
                if (icon.title) iconElm.title = icon.title;
                if (icon.class) iconElm.classList.add(icon.class);
            }
            fileNameDiv.appendChild(iconElm);
            return true;
        }
        return false;
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
                {text: "rename", title: "Rename Directory", clickAction: (e) => {
                    //console.log("rename: ", dirInfo);
                    this.explorer.renameDirClickAction(dirInfo);
                }},
                {text: "new file", title: "Create New File", clickAction: (e) => {
                    //console.log("new file: ", dirInfo);
                    this.explorer.newFileClickAction(dirInfo);
                }},
                {text: "new folder", title: "Create New Folder", clickAction: (e) => {
                    //console.log("new folder: ", dirInfo);
                    this.explorer.newDirClickAction(dirInfo);
                }},
                {text: "upload", title: "Upload File", clickAction: (e) => {
                    //console.log("upload: ", dirInfo);
                    this.explorer.uploadClickAction(dirInfo);
                }},
                {text: "delete", title: "Delete Directory", clickAction: (e) => {
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
            //this.explorer.toggleExpand(dir.path);
            this.explorer.dirClickAction(dirInfo);
        });
        dir.element.appendChild(dirMenu.element);
        dir.menu = dirMenu;

        let dirName = {};
        dirName.element = document.createElement("div");
        dirName.element.classList.add(this.CLASS_NAME_PREFIX + "dir-name");
        //dirName.element.innerHTML = dir.name + "/";
        dirMenu.element.appendChild(dirName.element);
        dirMenu.name = dirName;

        let dirIcon = {};
        dirIcon.element = document.createElement("div");
        dirIcon.element.classList.add(this.CLASS_NAME_PREFIX + "dir-icon");
        dirIcon.element.innerHTML = "▶";
        dirIcon.element.addEventListener("click", (e) => {
            e.stopPropagation();
            this.explorer.toggleExpand(dir.path);
        });
        dirMenu.name.element.appendChild(dirIcon.element);
        dirMenu.name.icon = dirIcon;

        let dirNameText = {};
        dirNameText.element = document.createElement("div");
        dirNameText.element.classList.add(this.CLASS_NAME_PREFIX + "dir-name-text");
        dirNameText.element.innerHTML = dir.name + "/";
        dirMenu.name.element.appendChild(dirNameText.element);
        dirMenu.name.Text = dirNameText;

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
                dirIcon.element.innerHTML = "▼";
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
                this.DEBUG && console.log("scrolling", out);
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


    dictMenu(parentObj) {
        let dictMenu = {};
        dictMenu.element = document.createElement("div");
        dictMenu.element.classList.add(this.CLASS_NAME_PREFIX + "dict-menu");
        parentObj.element.appendChild(dictMenu.element);
        parentObj.dictMenu = dictMenu;
        dictMenu.items = [];

        let dictMenuTitle = {};
        dictMenuTitle.element = document.createElement("div");
        dictMenuTitle.element.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-title");
        dictMenuTitle.element.innerHTML = "Dictionary";
        dictMenu.element.appendChild(dictMenuTitle.element);
        dictMenu.title = dictMenuTitle;

        let dictMenuContent = {};
        dictMenuContent.element = document.createElement("div");
        dictMenuContent.element.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-content");
        dictMenu.element.appendChild(dictMenuContent.element);
        dictMenu.content = dictMenuContent;



        dictMenu.setTitle = (title) => {
            dictMenu.title.element.innerHTML = title;
        }


        /*** Create add button to dictMenu
         */
        dictMenu.addButton = () => {
            let button = {};
            button.element = document.createElement("button");
            button.element.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-add-button");
            button.element.innerHTML = "+";
            button.element.addEventListener("click", (e) => {
                let item = {"":""};
                dictMenu.addItem(item);
            })
            dictMenu.element.appendChild(button.element);
        }



        /*** add item to dictMenu 
            * @param {object} items
            * items = {
            *     key: value
            * }
        */

        dictMenu.addItem = (item) => {
            let keys = Object.keys(item);
            keys.forEach((k) => {
                let dict = {key: k, value: item[k]};
                dictMenu.items.push(dict);
                let itemElement = document.createElement("div");
                itemElement.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item");
                
                let key = document.createElement("div");
                key.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-key");
                let keyInput = document.createElement("input");
                keyInput.type = "text";
                keyInput.placeholder = "key";
                keyInput.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-key-input");
                keyInput.value = k;
                keyInput.addEventListener("change", (e) => {
                    dict["key"] = keyInput.value;
                });
                key.appendChild(keyInput);

                let value = document.createElement("div");
                value.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-value");
                let valueInput = document.createElement("input");
                valueInput.type = "text";
                valueInput.placeholder = "value";
                valueInput.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-value-input");
                valueInput.value = item[k];
                valueInput.addEventListener("change", (e) => {
                    dict["value"] = valueInput.value;
                })
                value.appendChild(valueInput);
                
                let separator = document.createElement("span");
                separator.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-separator");
                separator.innerHTML = " : ";

                let deleteButton = document.createElement("button");
                deleteButton.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-delete-button");
                deleteButton.innerHTML = "×";
                deleteButton.addEventListener("click", (e) => {
                    dictMenu.items = dictMenu.items.filter((i) => i != dict);
                    itemElement.remove();
                });
                itemElement.appendChild(key);
                itemElement.appendChild(separator);
                itemElement.appendChild(value);
                itemElement.appendChild(deleteButton);
                dictMenu.content.element.appendChild(itemElement);
            });
        }

        dictMenu.getItems = () => {
            return dictMenu.items;
        }

        dictMenu.getItemsAsObject = () => {
            let obj = {};
            dictMenu.items.forEach((item) => {
                if(item.key == "" || item.value == ""){
                    return;
                }
                obj[item.key] = item.value;
            })
            return obj;
        }

        return dictMenu;
    }

    createDictMenu(parentObj, opt={}) {
        let dictMenu = this.dictMenu(parentObj);
        dictMenu.items = [];
        dictMenu.options = opt;

        return dictMenu;
    }

    /**
     * 
     * 
     * @param {*} parentObj 
     */
    chat(parentObj) {


        let chat = {};
        chat.element = document.createElement("div");
        chat.element.classList.add(this.CLASS_NAME_PREFIX + "chat");
        parentObj.element.appendChild(chat.element);

        // ファイルコンテキスト表示エリア
        chat.fileContextInfo = document.createElement("div");
        chat.fileContextInfo.className = this.CLASS_NAME_PREFIX + "chat-filecontext";
        chat.fileContextInfo.style.display = "none";
        chat.element.insertBefore(chat.fileContextInfo, chat.element.firstChild);

        // ファイルコンテキスト表示制御メソッド
        chat.setFileContextInfo = function(file) {
            if (file && file.name) {
                chat.fileContextInfo.innerHTML = `<span class=\"${this.CLASS_NAME_PREFIX}chat-filecontext-label\">ファイルコンテキスト:</span> <span class=\"${this.CLASS_NAME_PREFIX}chat-filecontext-name\">${file.name}</span> をAIに送信します。`;
                chat.fileContextInfo.style.display = '';
            } else {
                chat.fileContextInfo.innerHTML = '';
                chat.fileContextInfo.style.display = 'none';
            }
        };

        // ローディングアイコン
        chat.loading = {};
        chat.loading.element = document.createElement("div");
        chat.loading.element.className = this.CLASS_NAME_PREFIX + "chat-loading";
        chat.loading.element.style.display = "none";
        chat.loading.element.innerHTML = '<span class="loader"></span> AI応答中...';
        // chat.contentが後で生成されるため、appendChildは後で行う

        // ローディング表示/非表示メソッド
        chat.showLoading = function() {
            // 一度削除してから末尾に再追加
            if (chat.loading.element.parentNode) {
                chat.loading.element.parentNode.removeChild(chat.loading.element);
            }
            chat.content.element.appendChild(chat.loading.element);
            chat.loading.element.style.display = "flex";
            chat.content.element.scrollTop = chat.content.element.scrollHeight;
        };
        chat.hideLoading = function() {
            chat.loading.element.style.display = "none";
        };

        // 上部メニュー
        chat.topMenu = {};
        chat.topMenu.element = document.createElement("div");
        chat.topMenu.element.classList.add(this.CLASS_NAME_PREFIX + "chat-top-menu");
        chat.element.appendChild(chat.topMenu.element);

        chat.topMenu.title = {};
        chat.topMenu.title.element = document.createElement("div");
        chat.topMenu.title.element.classList.add(this.CLASS_NAME_PREFIX + "chat-top-menu-title");
        chat.topMenu.title.element.innerHTML = "Chat";
        chat.topMenu.element.appendChild(chat.topMenu.title.element);

        // チャット履歴表示エリア
        chat.content = {};
        chat.content.element = document.createElement("div");
        chat.content.element.classList.add(this.CLASS_NAME_PREFIX + "chat-content");
        chat.element.appendChild(chat.content.element);

        // ローディングアイコンを履歴エリアに追加
        chat.content.element.appendChild(chat.loading.element);


        // 入力エリア
        chat.inputArea = {};
        chat.inputArea.element = document.createElement("div");
        chat.inputArea.element.classList.add(this.CLASS_NAME_PREFIX + "chat-input-area");
        chat.element.appendChild(chat.inputArea.element);

        // モデルセレクター生成メソッド
        // 旧: chat.inputArea.topMenu.element に追加していたものを chat.topMenu.element に移動
        chat.createModelSelector = function(options={}) {
            // 既存のセレクターがあれば削除
            if (chat.modelSelector && chat.modelSelector.element && chat.modelSelector.element.parentNode) {
                chat.modelSelector.element.parentNode.removeChild(chat.modelSelector.element);
            }
            // セレクター生成
            let selector = {};
            selector.element = document.createElement("select");
            selector.element.classList.add(this.CLASS_NAME_PREFIX + "chat-model-selector");
            if (options.models && Array.isArray(options.models)) {
                options.models.forEach((model) => {
                    let opt = document.createElement("option");
                    opt.value = model.id || model.value || model;
                    opt.textContent = model.name || model.label || model.id || model;
                    selector.element.appendChild(opt);
                    if(options.defaultValue && (model.id === options.defaultValue || model.value === options.defaultValue || model === options.defaultValue)) {
                        opt.selected = true;
                    }
                });
            }
            if (options.onChange) {
                selector.element.addEventListener("change", (e) => {
                    options.onChange(e.target.value);
                });
            }
            // トップメニューに追加
            chat.topMenu.element.appendChild(selector.element);
            chat.modelSelector = selector;

            selector.getValue = function() {
                return this.element.value;
            }
            return selector;
        }.bind(this);

        // --- チャット履歴クリア機能 ---
        chat.clearBtn = {};
        chat.clearBtn.element = document.createElement("button");
        chat.clearBtn.element.textContent = "クリア";
        chat.clearBtn.element.className = this.CLASS_NAME_PREFIX + "chat-clear-btn";
        chat.clearBtn.element.style.marginLeft = "0.5em";
        chat.topMenu.element.appendChild(chat.clearBtn.element);

        // 履歴クリア処理
        chat.clearHistory = function() {
            // chat.messages（UI履歴）
            if (Array.isArray(chat.messages)) chat.messages.length = 0;
            // 画面上の履歴
            if (chat.content && chat.content.element) chat.content.element.innerHTML = "";
            // 外部変数の履歴もクリアしたい場合は外部で上書きすること
        };
        chat.clearBtn.element.addEventListener("click", () => chat.clearHistory());

        // テキストエリア（入力内容に応じて高さ自動調整）
        chat.inputArea.textarea = document.createElement("textarea");
        chat.inputArea.textarea.classList.add(this.CLASS_NAME_PREFIX + "chat-input");
        chat.inputArea.textarea.placeholder = "メッセージを入力...";
        chat.inputArea.textarea.addEventListener("input", function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        chat.inputArea.element.appendChild(chat.inputArea.textarea);

        // 送信ボタン
        chat.inputArea.sendBtn = document.createElement("button");
        chat.inputArea.sendBtn.classList.add(this.CLASS_NAME_PREFIX + "chat-send-btn");
        chat.inputArea.sendBtn.innerHTML = "送信";
        chat.inputArea.element.appendChild(chat.inputArea.sendBtn);

        // チャット履歴管理
        chat.messages = [];

        // --- スクロール制御 ---
        chat.autoScroll = true;
        chat.content.element.addEventListener('scroll', function() {
            const el = chat.content.element;
            // 2px以内なら最下部とみなす
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 2) {
                chat.autoScroll = true;
            } else {
                chat.autoScroll = false;
            }
        });

        // コードブロックにコピーアイコンを追加する共通関数
        const addCopyButtonsToCodeBlocks = (rootElement) => {
            const codeBlocks = rootElement.querySelectorAll("pre");
            codeBlocks.forEach((block) => {
                // 既にメニューがあればスキップ
                if (block.querySelector('.' + this.CLASS_NAME_PREFIX + 'chat-code-menu')) return;
                const codeMenu = document.createElement("div");
                codeMenu.classList.add(this.CLASS_NAME_PREFIX + "chat-code-menu");  
                const copyBtn = document.createElement("button");
                copyBtn.classList.add(this.CLASS_NAME_PREFIX + "chat-code-copy-btn");
                copyBtn.innerHTML = "コピー";
                copyBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const code = block.querySelector("code");
                    if (!code) {
                        console.warn("コードブロック内に <code> タグが見つかりません。");
                        return;
                    }
                    const codeText = code.innerText || code.textContent;
                    navigator.clipboard.writeText(codeText).then(() => {
                        copyBtn.innerHTML = "コピー済み";
                        setTimeout(() => {
                            copyBtn.innerHTML = "コピー";
                        }, 2000);
                    }).catch(err => {
                        console.error("コードのコピーに失敗しました:", err);
                    });
                });
                codeMenu.appendChild(copyBtn);
                block.before(codeMenu);
            });
        };


        chat.onApplyToCode = (code, applyBtn) => {
            // 適用処理をここに追加
            console.log("コード適用:", code);
        }

        // コードブロックに「コードに適用」ボタンを追加するメソッド
        chat.addApplyToCodeButtonsToChat = function (rootElement) {
            if (!rootElement || !rootElement.querySelector) {
                console.warn("rootElementが無効です。");
                return;
            }
            const codeBlocks = rootElement.querySelectorAll('pre');
            codeBlocks.forEach(block => {
                const codeMenu = block.previousElementSibling;
                if (!codeMenu) {
                    console.warn("コードブロックの前にメニューが見つかりません。");
                    return;
                }
                if (codeMenu.querySelector('.' + this.CLASS_NAME_PREFIX + 'chat-code-apply-btn')) return; // 既に存在する場合はスキップ
                const applyBtn = document.createElement('button');
                applyBtn.classList.add(this.CLASS_NAME_PREFIX + 'chat-code-apply-btn');
                applyBtn.innerHTML = 'コードに適用';
                
                
                // ローディング状態管理の強化
                applyBtn.startLoading = () => {
                    applyBtn.disabled = true;
                    applyBtn.classList.add('loading');
                    applyBtn.innerHTML = '適用中...';
                };
                
                applyBtn.stopLoading = () => {
                    applyBtn.disabled = false;
                    applyBtn.classList.remove('loading');
                    applyBtn.innerHTML = 'コードに適用';
                };
                
                // 成功状態表示
                applyBtn.showSuccess = () => {
                    applyBtn.classList.remove('loading');
                    applyBtn.classList.add('success');
                    applyBtn.innerHTML = '適用完了';
                    
                    // 2秒後に元に戻す
                    setTimeout(() => {
                        applyBtn.classList.remove('success');
                        applyBtn.innerHTML = 'コードに適用';
                    }, 2000);
                };
                
                // エラー状態表示
                applyBtn.showError = () => {
                    applyBtn.classList.remove('loading');
                    applyBtn.classList.add('error');
                    applyBtn.innerHTML = 'エラー';
                    console.log('Error state - classes:', applyBtn.className);
                    
                    // 2秒後に元に戻す
                    setTimeout(() => {
                        applyBtn.classList.remove('error');
                        applyBtn.innerHTML = 'コードに適用';
                    }, 2000);
                };
                applyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const code = block.querySelector('code');
                    if (!code) {
                        console.warn("コードブロック内に <code> タグが見つかりません。");
                        return;
                    }
                    const codeText = code.innerText || code.textContent;
                    chat.onApplyToCode(codeText, applyBtn); // コード適用処理を呼び出す
                });
                codeMenu.appendChild(applyBtn);
            });
        }.bind(this);


        // メッセージ追加メソッド
        chat.addMessage = (text, from = "user", markdown = false) => {
            const msg = {};
            msg.element = document.createElement("div");
            msg.element.classList.add(this.CLASS_NAME_PREFIX + "chat-message");
            msg.element.classList.add(this.CLASS_NAME_PREFIX + "chat-message-" + from);
            msg.element.innerText = text;

            if (markdown) {
                // textが既にHTMLとして処理済みかチェック
                if (text.includes('<') && text.includes('>')) {
                    // 既にHTMLとして処理済みの場合は直接設定
                    msg.element.innerHTML = text;
                } else {
                    // まだMarkdown形式の場合は変換
                    const html = marked.parse(text);
                    msg.element.innerHTML = html;
                }
                addCopyButtonsToCodeBlocks(msg.element);
                chat.addApplyToCodeButtonsToChat(msg.element);
            }

            chat.content.element.appendChild(msg.element);
            chat.content.element.scrollTop = chat.content.element.scrollHeight;
            chat.messages.push({ text, from });
        };

        // ストリーム用: 直近のAIメッセージをリアルタイムで更新
        chat.updateLastAIMessage = (text, markdown = false) => {
            // 直近のAIメッセージ要素を取得
            const aiMsgs = chat.content.element.querySelectorAll('.' + this.CLASS_NAME_PREFIX + 'chat-message-ai');
            if (aiMsgs.length === 0) return;
            const aiMsgDiv = aiMsgs[aiMsgs.length - 1];
            if (markdown) {
                // textが既にHTMLとして処理済みかチェック
                if (text.includes('<') && text.includes('>')) {
                    // 既にHTMLとして処理済みの場合は直接設定
                    aiMsgDiv.innerHTML = text;
                } else {
                    // まだMarkdown形式の場合は変換
                    aiMsgDiv.innerHTML = marked.parse(text);
                }
                addCopyButtonsToCodeBlocks(aiMsgDiv);
                chat.addApplyToCodeButtonsToChat(aiMsgDiv);
            } else {
                aiMsgDiv.innerText = text;
            }
            if (chat.loading.element.parentNode) {
                chat.loading.element.parentNode.removeChild(chat.loading.element);
            }
            chat.content.element.appendChild(chat.loading.element);
            // スクロール位置を更新（autoScrollがtrueのときのみ）
            if (chat.autoScroll) {
                chat.content.element.scrollTop = chat.content.element.scrollHeight;
            }
        };

        // 最後のAIメッセージのテキストを取得
        chat.getLastAIMessageText = () => {
            const aiMsgs = chat.content.element.querySelectorAll('.' + this.CLASS_NAME_PREFIX + 'chat-message-ai');
            if (aiMsgs.length === 0) return '';
            const lastAiMsg = aiMsgs[aiMsgs.length - 1];
            return lastAiMsg.innerText || lastAiMsg.textContent || '';
        };

        // 送信処理
        chat.inputArea.sendBtn.addEventListener("click", () => {
            const value = chat.inputArea.textarea.value.trim();
            if (value) {
                chat.addMessage(value, "user");
                //chat.inputArea.textarea.value = "";
                chat.inputArea.textarea.rows = 1;
                // ここでAIへの送信処理を追加可能
                // 例: chat.addMessage("AIの返答例", "ai");
            }
        });

        // Enterキーで送信（Shift+Enterで改行）
        chat.inputArea.textarea.addEventListener("keydown", function(e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chat.inputArea.sendBtn.click();
            }
        });

        chat.setTitle = (title) => {
            chat.topMenu.title.element.innerHTML = title;
        };

        // CSS: loaderアニメーション（必要なら）


        return chat;
    }

    createChat(parentObj, opt={}) {
        let chat = this.chat(parentObj);
        chat.options = opt;
        chat.messages = [];

        return chat;
    }




    /**
     * Aceエディタ本体上にインラインで差分をハイライト表示する（カスタムマーカー利用）
     * @param {object} aceEditor Aceエディタインスタンス（ace.edit()の戻り値）
     * @param {string} original 元の内容
     * @param {string} proposed 変更後の内容
     * @returns {function} diffを消すための関数
     */
    _showDiffInEditor(aceEditor, original, proposed) {
        if (typeof Diff === 'undefined') {
            alert('jsdiff(Diff)が読み込まれていません');
            return;
        }
        // Rangeクラスを取得
        const Range = ace.require('ace/range').Range;
        const session = aceEditor.getSession();
        const markerIds = [];
        const diff = Diff.diffLines(original, proposed);
        let origLine = 0;
        let propLine = 0;
        diff.forEach(part => {
            const lines = part.value.split('\n');
            const lineCount = lines.length - (lines[lines.length-1] === '' ? 1 : 0);
            if (part.added) {
                for (let i = 0; i < lineCount; i++) {
                    const range = new Range(propLine + i, 0, propLine + i, 1e5);
                    const id = session.addMarker(range, 'meditor-diff-marker-added', 'fullLine');
                    markerIds.push(id);
                }
                propLine += lineCount;
            } else if (part.removed) {
                origLine += lineCount;
            } else {
                origLine += lineCount;
                propLine += lineCount;
            }
        });

        return function clearDiffMarkers() {
            markerIds.forEach(id => session.removeMarker(id));
        };
    }

    /**
     * Aceエディタ本体上にunified diff風に変更前(-)・変更後(+)行を挿入して表示する
     * @param {object} aceEditor Aceエディタインスタンス（ace.edit()の戻り値）
     * @param {string} original 元の内容
     * @param {string} proposed 変更後の内容
     * @returns {function} diff表示を解除し元に戻す関数
     */
    _showDiffUnifiedInEditor(aceEditor, original, proposed) {
        aceEditor.isDiffView = true;
        if (typeof Diff === 'undefined') {
            alert('jsdiff(Diff)が読み込まれていません');
            return;
        }
        const Range = ace.require('ace/range').Range;
        const session = aceEditor.getSession();
        // 元の内容とreadOnly状態を退避
        const originalContent = session.getValue();
        const wasReadOnly = aceEditor.getReadOnly();
        // unified diff用テキスト生成
        const diff = Diff.diffLines(original, proposed);
        let lines = [];
        let lineTypes = [];
        diff.forEach(part => {
            const partLines = part.value.split('\n');
            if (partLines[partLines.length-1] === '') partLines.pop();
            if (part.added) {
                partLines.forEach(l => { lines.push('+ ' + l); lineTypes.push('added'); });
            } else if (part.removed) {
                partLines.forEach(l => { lines.push('- ' + l); lineTypes.push('removed'); });
            } else {
                partLines.forEach(l => { lines.push('  ' + l); lineTypes.push('context'); });
            }
        });
        session.setValue(lines.join('\n'));
        aceEditor.setReadOnly(true);

        // マーカーを追加
        const markerIds = [];
        for (let i = 0; i < lineTypes.length; i++) {
            if (lineTypes[i] === 'added') {
                const range = new Range(i, 0, i, 1e5);
                const id = session.addMarker(range, 'meditor-diff-line-added', 'fullLine');
                markerIds.push(id);
            } else if (lineTypes[i] === 'removed') {
                const range = new Range(i, 0, i, 1e5);
                const id = session.addMarker(range, 'meditor-diff-line-removed', 'fullLine');
                markerIds.push(id);
            }
        }

        // diff表示解除用
        return () => {
            session.setValue(originalContent);
            aceEditor.setReadOnly(wasReadOnly);
            markerIds.forEach(id => session.removeMarker(id));
            aceEditor.isDiffView = false;
        };
    }

    /**
     * 現在のファイルと変更予定ファイルの差分を表示する
     * @param {object} file ファイルオブジェクト
     * @param {string} proposed 変更後の内容
     * @returns {function} diff表示を解除し元に戻す関数
     */
    showDiff(file, proposed) {
        const aceEditor = file.aceObj.editor;
        if (aceEditor.isDiffView) {
            // 既にdiff表示中なら何もしない
            return;
        }
        const original = aceEditor.getValue();
        const clear = this._showDiffUnifiedInEditor(aceEditor, original, proposed);
        // diff表示を解除するための関数を返す
        return () => {
            // エディタのdiff表示を解除
            clear();
            //　変更なしに設定
            file.changed = false;
            // エクスプローラーのアイコンを元に戻す
            this.setFileIcon(file.path, null);
        };
    }




    diffApplyMenu(rootElement, file, proposed, onApply, onIgnore) {
        // 差分適用確認ダイアログを生成
        const menu = {};
        menu.element = document.createElement("div");
        menu.element.classList.add(this.CLASS_NAME_PREFIX + "diff-apply-menu");

        // メッセージ
        const msg = document.createElement("div");
        msg.textContent = "この変更を適用しますか？";
        msg.classList.add(this.CLASS_NAME_PREFIX + "diff-apply-menu-msg");
        menu.element.appendChild(msg);

        // ボタンコンテナ
        const btnContainer = document.createElement("div");
        btnContainer.classList.add(this.CLASS_NAME_PREFIX + "diff-apply-menu-btns");

        // 適用ボタン
        const applyBtn = document.createElement("button");
        applyBtn.textContent = "適用";
        applyBtn.classList.add(this.CLASS_NAME_PREFIX + "diff-apply-btn");
        applyBtn.addEventListener("click", () => {
            // 変更を適用
            if (typeof onApply === "function") {
                onApply(file, proposed);
            } else {
                console.error("onApply callback is not a function");
            }
            if (menu.element.parentNode) menu.element.parentNode.removeChild(menu.element);
        });

        // 無視ボタン
        const ignoreBtn = document.createElement("button");
        ignoreBtn.textContent = "無視";
        ignoreBtn.classList.add(this.CLASS_NAME_PREFIX + "diff-ignore-btn");
        ignoreBtn.addEventListener("click", () => {
            if (typeof onIgnore === "function") {
                onIgnore(file);
            }
            // ダイアログを閉じる
            if (menu.element.parentNode) menu.element.parentNode.removeChild(menu.element);
        });

        btnContainer.appendChild(applyBtn);
        btnContainer.appendChild(ignoreBtn);
        menu.element.appendChild(btnContainer);

        // 画面に追加
        rootElement.appendChild(menu.element);

        // ESCキーで閉じる
        const escHandler = (e) => {
            if (e.key === "Escape") {
                if (typeof onIgnore === "function") {
                    onIgnore(file);
                }
                // ダイアログを閉じる
                if (menu.element.parentNode) menu.element.parentNode.removeChild(menu.element);
                window.removeEventListener("keydown", escHandler);
            }
        };
        window.addEventListener("keydown", escHandler);

        return menu;
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
        contents=[{text: "Menu1", title: "desc", clickAction: (e) => {console.log("menu1");}}]
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
            content.element.title = contents[i].title;
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
        window.addEventListener("keydown", (e) => {
            if(e.key == "Escape"){
                this.removePopupMenus();
            }
        });

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
            //console.log("popup window clicked");
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
            //console.log(e);
            // if the click is on the close button, do not activate the popup window
            if(!pWindowCloseButton.element.contains(e.target) && e.target !== pWindowCloseButton.element){
                this.activatePopupWindow(pWindow);
            }
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
            console.log("popup window close button clicked");
            e.stopPropagation();
            pWindow.remove();
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

        window.addEventListener("keydown", (e) => {
            if(e.key == "Escape"){
                pWindow.remove();
            }
        })


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












