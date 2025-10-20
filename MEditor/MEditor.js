// general functions

import { api } from "../js/modules/utils/api.js";

export class Path {
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

export class AceWrapper {
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




export class MEditor {
    

    EDITOR_NAME = "MEditor";
    CLASS_NAME_PREFIX = "meditor-";

    DEBUG = false;
    

    constructor(options = {}) {
        // script path and version parameter extraction
        if (options.rootPath) {
            // 外部から明示的にルートパスが指定された場合
            this.root = options.rootPath.endsWith('/') ? options.rootPath : options.rootPath + '/';
            this.version = options.version || '';
        } else if (typeof import.meta !== 'undefined' && import.meta.url) {
            // ESモジュールの場合はimport.meta.urlを使用
            const url = new URL(import.meta.url);
            // バージョンパラメータを抽出 (例: ?v=1.0.0)
            this.version = url.search || '';
            // ブラウザ環境では相対パスに変換
            const currentPath = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
            const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            this.root = currentPath.replace(basePath, './').replace(/^\//, './') || './';
        } else {
            // 通常のscriptタグの場合は従来通り
            const scriptTag = document.querySelector('script[src*="MEditor.js"]');
            const scriptSrc = scriptTag?.getAttribute('src') || '';
            // バージョンパラメータを抽出
            const versionMatch = scriptSrc.match(/\?v=[^"']*/);
            this.version = versionMatch ? versionMatch[0] : '';
            this.root = scriptTag?.outerHTML.match(/\"(.*)MEditor.js(.*)\"/)?.[1] || './';
        }


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

        // パネルトグルボタンへの参照を保存
        this.panelToggleButtons = {
            left: null,
            right: null,
            bottom: null,
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
        bottomHeight: 'meditor-bottom-height',
        leftVisible: 'meditor-left-visible',
        rightVisible: 'meditor-right-visible',
        bottomVisible: 'meditor-bottom-visible'
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

    // パネルの表示状態をlocalStorageに保存
    savePanelVisibility() {
        if (!this.page || !this.page.main) return;
        const leftVisible = this.isPanelVisible('left');
        const rightVisible = this.isPanelVisible('right');
        const bottomVisible = this.isPanelVisible('bottom');
        localStorage.setItem(this.STORAGE_KEYS.leftVisible, leftVisible.toString());
        localStorage.setItem(this.STORAGE_KEYS.rightVisible, rightVisible.toString());
        localStorage.setItem(this.STORAGE_KEYS.bottomVisible, bottomVisible.toString());
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

    // localStorageからパネルの表示状態を復元
    restorePanelVisibility(defaults = { left: true, right: false, bottom: false }) {
        if (!this.page || !this.page.main) return;

        const savedLeftVisible = localStorage.getItem(this.STORAGE_KEYS.leftVisible);
        const savedRightVisible = localStorage.getItem(this.STORAGE_KEYS.rightVisible);
        const savedBottomVisible = localStorage.getItem(this.STORAGE_KEYS.bottomVisible);

        // localStorageに保存された値がない場合はデフォルトで全て表示
        const leftVisible = savedLeftVisible !== null ? savedLeftVisible === 'true' : defaults.left;
        const rightVisible = savedRightVisible !== null ? savedRightVisible === 'true' : defaults.right;
        const bottomVisible = savedBottomVisible !== null ? savedBottomVisible === 'true' : defaults.bottom;

        // パネルの表示状態を直接設定（adjustPage()は最後に1回だけ呼ぶ）
        const displayLeft = leftVisible ? '' : 'none';
        const displayRight = rightVisible ? '' : 'none';
        const displayBottom = bottomVisible ? '' : 'none';

        if (this.page.main.left) {
            this.page.main.left.element.style.display = displayLeft;
            this.setSashVisibility('left', leftVisible);
        }
        if (this.page.main.right) {
            this.page.main.right.element.style.display = displayRight;
            this.setSashVisibility('right', rightVisible);
        }
        if (this.page.main.mid && this.page.main.mid.container && this.page.main.mid.container.bottom) {
            this.page.main.mid.container.bottom.element.style.display = displayBottom;
            this.setSashVisibility('bottom', bottomVisible);
        }

        // 最後に1回だけレイアウト調整
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
            // Block all iframes from capturing mouse events
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.style.pointerEvents = 'none';
            });
            window.addEventListener("mousemove", leftSashMove);
            window.addEventListener("mouseup", function a (e){
                window.removeEventListener("mousemove", leftSashMove);
                window.removeEventListener("mouseup", a);
                document.body.style.userSelect = prevUserSelect;
                // Re-enable iframe pointer events
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = '';
                });
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
            // Block all iframes from capturing mouse events
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.style.pointerEvents = 'none';
            });
            window.addEventListener("mousemove", midSashMove);
            window.addEventListener("mouseup", function a(e) {
                window.removeEventListener("mousemove", midSashMove);
                window.removeEventListener("mouseup", a);
                document.body.style.userSelect = prevUserSelect;
                // Re-enable iframe pointer events
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = '';
                });
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
            // Block all iframes from capturing mouse events
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.style.pointerEvents = 'none';
            });
            window.addEventListener("mousemove", rightSashMove);
            window.addEventListener("mouseup", function a(e) {
                window.removeEventListener("mousemove", rightSashMove);
                window.removeEventListener("mouseup", a);
                document.body.style.userSelect = prevUserSelect;
                // Re-enable iframe pointer events
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = '';
                });
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

        // パネルの表示状態を確認して、非表示の場合は幅を0として扱う
        let leftVisible = this.isPanelVisible('left');
        let rightVisible = this.isPanelVisible('right');
        let leftActualWidth = leftVisible ? left.element.clientWidth : 0;
        let rightActualWidth = rightVisible ? right.element.clientWidth : 0;

        let leftWidth = parentElement.clientWidth - mid.element.clientWidth - rightActualWidth;
        let midWidth = parentElement.clientWidth - leftActualWidth - rightActualWidth;
        let rightWidth = parentElement.clientWidth - leftActualWidth - mid.element.clientWidth;

        if(midWidth < this.pageSettings.split.minWidth){
            mid.element.style.width = this.pageSettings.split.minWidth + "px";
            //midWidth = this.pageSettings.split.minWidth;
            mid.element.style.left = leftActualWidth + "px";

            let delta = this.pageSettings.split.minWidth - midWidth;
            if(leftVisible && leftWidth >= this.pageSettings.split.minWidth + delta/2 && rightVisible && rightWidth >= this.pageSettings.split.minWidth + delta/2){
                leftWidth -= delta/2;
                rightWidth -= delta/2;
                left.element.style.width = leftWidth + "px";
                mid.element.style.left = leftActualWidth + "px";
                right.element.style.width = rightWidth + "px";
            }
            else if(leftVisible && leftWidth >= this.pageSettings.split.minWidth + delta){
                leftWidth -= delta;
                left.element.style.width = leftWidth + "px";
                mid.element.style.left = leftActualWidth + "px";
            }
            else if(rightVisible && rightWidth >= this.pageSettings.split.minWidth + delta){
                rightWidth -= delta;
                right.element.style.width = rightWidth + "px";
            }

        }
        else{
            mid.element.style.width = midWidth + "px";
            mid.element.style.left = leftActualWidth + "px";
        }
        leftWidth = parentElement.clientWidth - midWidth - rightActualWidth;
        
        
        let midMain = mid.container.main;
        let midBottom = mid.container.bottom;

        // 下パネルの表示状態を確認
        let bottomVisible = this.isPanelVisible('bottom');
        let bottomActualHeight = bottomVisible ? midBottom.element.offsetHeight : 0;

        let midMainHeight = mid.element.offsetHeight - bottomActualHeight;
        let midBottomHeight = bottomActualHeight;

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

        // パネルの表示状態を確認
        let leftVisible = this.isPanelVisible('left');
        let rightVisible = this.isPanelVisible('right');
        let bottomVisible = this.isPanelVisible('bottom');

        // 左sash: 左パネルが表示されている場合のみ位置を計算
        if (leftVisible) {
            left.sash.element.style.left = parentElement.clientLeft + left.element.clientWidth - this.pageSettings.splitSash.width / 2 + "px";
        }

        // 右sash: 右パネルが表示されている場合のみ位置を計算
        if (rightVisible) {
            right.sash.element.style.left = parentElement.clientLeft + parentElement.clientWidth - right.element.clientWidth - this.pageSettings.splitSash.width / 2 + "px";
        }

        // 下sash: 下パネルが表示されている場合のみ位置を計算
        let midContainer = mid.container;
        let midMain = midContainer.main;
        let midBottom = midContainer.bottom;

        if (bottomVisible) {
            mid.container.bottom.sash.element.style.top = mid.container.main.element.clientHeight - this.pageSettings.splitSash.width / 2 + "px";
            midBottom.sash.element.style.top = midContainer.element.clientTop + midMain.element.clientHeight - this.pageSettings.splitSash.width / 2 + "px";
        }
    }

    /**
     * sash（パネル間の境界線/リサイズハンドル）の表示/非表示を制御
     * @param {string} position - sashの位置: 'left' | 'right' | 'bottom' | 'all'
     * @param {boolean} visible - true: 表示, false: 非表示
     */
    setSashVisibility(position, visible) {
        if (!this.page || !this.page.main) return;

        const displayValue = visible ? '' : 'none';

        switch(position) {
            case 'left':
                if (this.page.main.left && this.page.main.left.sash) {
                    this.page.main.left.sash.element.style.display = displayValue;
                }
                break;
            
            case 'right':
                if (this.page.main.right && this.page.main.right.sash) {
                    this.page.main.right.sash.element.style.display = displayValue;
                }
                break;
            
            case 'bottom':
                if (this.page.main.mid && 
                    this.page.main.mid.container && 
                    this.page.main.mid.container.bottom && 
                    this.page.main.mid.container.bottom.sash) {
                    this.page.main.mid.container.bottom.sash.element.style.display = displayValue;
                }
                break;
            
            case 'all':
                this.setSashVisibility('left', visible);
                this.setSashVisibility('right', visible);
                this.setSashVisibility('bottom', visible);
                break;
            
            default:
                console.warn(`Unknown sash position: ${position}`);
                return;
        }
    }

    /**
     * 特定のsashを表示
     * @param {string} position - 'left' | 'right' | 'bottom' | 'all'
     */
    showSash(position) {
        this.setSashVisibility(position, true);
    }

    /**
     * 特定のsashを非表示
     * @param {string} position - 'left' | 'right' | 'bottom' | 'all'
     */
    hideSash(position) {
        this.setSashVisibility(position, false);
    }

    /**
     * sashの表示状態を取得
     * @param {string} position - 'left' | 'right' | 'bottom'
     * @returns {boolean} true: 表示, false: 非表示
     */
    isSashVisible(position) {
        if (!this.page || !this.page.main) return false;

        let sashElement = null;
        
        switch(position) {
            case 'left':
                sashElement = this.page.main.left?.sash?.element;
                break;
            case 'right':
                sashElement = this.page.main.right?.sash?.element;
                break;
            case 'bottom':
                sashElement = this.page.main.mid?.container?.bottom?.sash?.element;
                break;
            default:
                return false;
        }

        if (!sashElement) return false;
        return sashElement.style.display !== 'none';
    }

    /**
     * sashの表示状態をトグル
     * @param {string} position - 'left' | 'right' | 'bottom' | 'all'
     */
    toggleSash(position) {
        if (position === 'all') {
            const currentState = this.isSashVisible('left');
            this.setSashVisibility('all', !currentState);
        } else {
            const currentState = this.isSashVisible(position);
            this.setSashVisibility(position, !currentState);
        }
    }

    /**
     * パネルの表示/非表示を制御
     * @param {string} position - パネルの位置: 'left' | 'right' | 'bottom' | 'all'
     * @param {boolean} visible - true: 表示, false: 非表示
     */
    setPanelVisibility(position, visible) {
        if (!this.page || !this.page.main) return;

        const displayValue = visible ? '' : 'none';

        switch(position) {
            case 'left':
                if (this.page.main.left) {
                    this.page.main.left.element.style.display = displayValue;
                    this.setSashVisibility('left', visible);
                }
                break;
            
            case 'right':
                if (this.page.main.right) {
                    this.page.main.right.element.style.display = displayValue;
                    this.setSashVisibility('right', visible);
                }
                break;
            
            case 'bottom':
                if (this.page.main.mid && 
                    this.page.main.mid.container && 
                    this.page.main.mid.container.bottom) {
                    this.page.main.mid.container.bottom.element.style.display = displayValue;
                    this.setSashVisibility('bottom', visible);
                }
                break;
            
            case 'all':
                this.setPanelVisibility('left', visible);
                this.setPanelVisibility('right', visible);
                this.setPanelVisibility('bottom', visible);
                break;
            
            default:
                console.warn(`Unknown panel position: ${position}`);
                return;
        }

        // レイアウトを再調整
        this.adjustPage();

        // 表示状態をlocalStorageに保存（'all'の場合は個別に保存される）
        if (position !== 'all') {
            this.savePanelVisibility();
        }
    }

    /**
     * 特定のパネルを表示
     * @param {string} position - 'left' | 'right' | 'bottom' | 'all'
     */
    showPanel(position) {
        this.setPanelVisibility(position, true);
    }

    /**
     * 特定のパネルを非表示
     * @param {string} position - 'left' | 'right' | 'bottom' | 'all'
     */
    hidePanel(position) {
        this.setPanelVisibility(position, false);
    }

    /**
     * パネルの表示状態を取得
     * @param {string} position - 'left' | 'right' | 'bottom'
     * @returns {boolean} true: 表示, false: 非表示
     */
    isPanelVisible(position) {
        if (!this.page || !this.page.main) return false;

        let panelElement = null;
        
        switch(position) {
            case 'left':
                panelElement = this.page.main.left?.element;
                break;
            case 'right':
                panelElement = this.page.main.right?.element;
                break;
            case 'bottom':
                panelElement = this.page.main.mid?.container?.bottom?.element;
                break;
            default:
                return false;
        }

        if (!panelElement) return false;
        return panelElement.style.display !== 'none';
    }

    /**
     * パネルの表示状態をトグル
     * @param {string} position - 'left' | 'right' | 'bottom' | 'all'
     */
    togglePanel(position) {
        if (position === 'all') {
            const currentState = this.isPanelVisible('left');
            this.setPanelVisibility('all', !currentState);
        } else {
            const currentState = this.isPanelVisible(position);
            this.setPanelVisibility(position, !currentState);
        }
    }

    /**
     * パネルトグルボタンを登録する
     * Register a panel toggle button for automatic state updates
     * @param {string} position - 'left' | 'right' | 'bottom'
     * @param {Object} button - トグルボタンオブジェクト (setState メソッドを持つ)
     */
    registerPanelToggleButton(position, button) {
        if (!button || typeof button.setState !== 'function') {
            console.error("Invalid button: button must have a setState method");
            return;
        }
        if (!['left', 'right', 'bottom'].includes(position)) {
            console.error("Invalid position: must be 'left', 'right', or 'bottom'");
            return;
        }
        this.panelToggleButtons[position] = button;
        this.DEBUG && console.log(`Panel toggle button registered for ${position}`);
    }

    /**
     * パネルトグルボタンの状態を更新する（内部使用）
     * Update panel toggle button state (internal use)
     * @param {string} position - 'left' | 'right' | 'bottom'
     * @param {boolean} visible - パネルが表示されているか
     */
    _updatePanelToggleButton(position, visible) {
        const button = this.panelToggleButtons[position];
        if (button && typeof button.setState === 'function') {
            // setStateはtoggleActionも呼び出すため、状態が変わった時のみ呼ぶ
            if (button.state !== visible) {
                this.DEBUG && console.log(`Updating ${position} panel toggle button to:`, visible);
                // toggleActionを一時的に無効化して無限ループを防ぐ
                const originalAction = button.toggleAction;
                button.toggleAction = null;
                button.setState(visible);
                button.toggleAction = originalAction;
            }
        }
    }

    /**
     * コンポーネントが配置されているパネルとタブを自動的に開く
     * Show a component by opening its parent panel and tab automatically
     * @param {Object} component - コンポーネントオブジェクト (element プロパティを持つ)
     */
    showComponent(component) {
        if (!component || !component.element) {
            console.error("Invalid component: component must have an element property");
            return;
        }

        this.DEBUG && console.log("showComponent() called for component:", component);
        
        // Find the parent structure
        let currentElement = component.element;
        let panelPosition = null;
        let tabContainer = null;
        let tabId = null;
        
        // Traverse up the DOM to find panel and tab information
        while (currentElement && currentElement !== this.page.element) {
            // Check if this is a tab content
            if (currentElement.classList.contains(this.CLASS_NAME_PREFIX + "tab-content")) {
                // Find tab ID by searching in all possible tab containers
                const checkContainer = (panel, panelName) => {
                    const container = panel?.tabContainer;
                    if (!container || !container.tabs) return false;
                    for (let tab of container.tabs) {
                        if (tab.content && tab.content.element === currentElement) {
                            tabId = tab.id;
                            tabContainer = container;
                            panelPosition = panelName;  // Set panel position when tab is found
                            return true;
                        }
                    }
                    return false;
                };
                
                // Search in all panels
                if (this.page.main?.left && checkContainer(this.page.main.left, 'left')) {
                    // Found in left panel
                } else if (this.page.main?.right && checkContainer(this.page.main.right, 'right')) {
                    // Found in right panel
                } else if (this.page.main?.mid?.container?.bottom && checkContainer(this.page.main.mid.container.bottom, 'bottom')) {
                    // Found in bottom panel
                }
                
                // If we found the tab, we can stop searching
                if (tabId) {
                    break;
                }
            }
            
            // Check if this element is a panel
            if (this.page.main?.left?.element === currentElement) {
                panelPosition = 'left';
            } else if (this.page.main?.right?.element === currentElement) {
                panelPosition = 'right';
            } else if (this.page.main?.mid?.container?.bottom?.element === currentElement) {
                panelPosition = 'bottom';
            }
            
            currentElement = currentElement.parentElement;
        }
        
        // Show the panel if found
        if (panelPosition) {
            this.DEBUG && console.log("Found panel position:", panelPosition);
            this.showPanel(panelPosition);
            // Update the toggle button state
            this._updatePanelToggleButton(panelPosition, true);
        }
        
        // Activate the tab if found
        if (tabId && tabContainer) {
            this.DEBUG && console.log("Activating tab:", tabId);
            tabContainer.activateTab(tabId);
        }
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
        
        // パネルの表示状態をlocalStorageから復元
        this.restorePanelVisibility();
        
        return;
    }


    async loadCSS(cssPath=this.root+"MEditor.css" ,parentObj=this.page) {

        parentObj.css = {};
        parentObj.css.loader = {};
        parentObj.css.loader.element = document.createElement("link");
        parentObj.css.loader.element.rel = "stylesheet";
        // CSSファイルにバージョンパラメータを付与
        const cssPathWithVersion = this.version ? `${cssPath}${this.version}` : cssPath;
        parentObj.css.loader.element.href = cssPathWithVersion;

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



    // layout components
    
    




    generateButton(parentObj, text, clickAction, tooltip="") {
        let button = {};
        button.element = document.createElement("button");
        button.element.classList.add(this.CLASS_NAME_PREFIX + "button");
        button.element.innerHTML = text;
        if(tooltip) button.element.title = tooltip;
        if(clickAction){
            button.element.addEventListener("click", clickAction.bind(this));
        }
        button.addTrigger = (event, func) => {
            button.element.addEventListener(event, func);
        }
        button.removeTrigger = (event, func) => {
            button.element.removeEventListener(event, func);
        }
        button.setEnabled = (enabled) => {
            button.element.disabled = !enabled;
        }

        if (parentObj && parentObj.element instanceof HTMLElement) {
            parentObj.element.appendChild(button.element);
        }
        //if(name) parentObj[name] = button;
        //else
        
        return button;
    }

    generateToggleButton(parentObj, textOn, textOff, initialState=false, toggleAction, tooltip="") {
        let button = {};
        button.element = document.createElement("button");
        button.element.classList.add(this.CLASS_NAME_PREFIX + "button");
        button.element.classList.add(this.CLASS_NAME_PREFIX + "toggle-button");
        button.state = initialState;
        button.toggleAction = toggleAction;
        if(tooltip) button.element.title = tooltip;
        if(initialState){
            button.element.classList.add(this.CLASS_NAME_PREFIX + "toggle-button-on");
            button.element.innerHTML = textOn;
        }
        else{
            button.element.innerHTML = textOff;
        }

        button.element.addEventListener("click", (e) => {
            button.state = !button.state;
            if(button.state){
                button.element.classList.add(this.CLASS_NAME_PREFIX + "toggle-button-on");
                button.element.innerHTML = textOn;
            }
            else{
                button.element.classList.remove(this.CLASS_NAME_PREFIX + "toggle-button-on");
                button.element.innerHTML = textOff;
            }
            if(button.toggleAction){
                button.toggleAction(button.state);
            }
        });

        button.setAction = (func) => {
            button.toggleAction = func;
        }
        button.setState = (state) => {
            button.state = state;
            if(button.state){
                button.element.classList.add(this.CLASS_NAME_PREFIX + "toggle-button-on");
                button.element.innerHTML = textOn;
            }
            else{
                button.element.classList.remove(this.CLASS_NAME_PREFIX + "toggle-button-on");
                button.element.innerHTML = textOff;
            }
            if(button.toggleAction){
                button.toggleAction(button.state);
            }
        }

        if (parentObj && typeof parentObj.element === "object"){
            parentObj.element.appendChild(button.element);
        }else{
            console.warn("parentObj has no element property");
        }
        return button;
    }

    checkbox(parentObj, labelText="", initialState=false, changeAction, tooltip="") {        
        let checkbox = {};

        checkbox.changeAction = changeAction;

        checkbox.element = document.createElement("div");
        checkbox.element.classList.add(this.CLASS_NAME_PREFIX + "checkbox-container");

        checkbox.label = {};
        checkbox.label.element = document.createElement("label");
        checkbox.label.element.classList.add(this.CLASS_NAME_PREFIX + "checkbox-label");
        if(tooltip) checkbox.label.element.title = tooltip;
        checkbox.label.element.innerHTML = labelText;
        checkbox.element.appendChild(checkbox.label.element);

        checkbox.input = {};
        checkbox.input.element = document.createElement("input");
        checkbox.input.element.type = "checkbox";
        checkbox.input.element.classList.add(this.CLASS_NAME_PREFIX + "checkbox-input");
        checkbox.input.element.checked = initialState;
        if(checkbox.changeAction){
            checkbox.input.element.addEventListener("change", (e) => {
                checkbox.changeAction(e.target.checked);
            });
        }
        checkbox.label.element.prepend(checkbox.input.element);

        if (parentObj && typeof parentObj.element === "object"){
            parentObj.element.appendChild(checkbox.element);
        }else{
            console.warn("parentObj has no element property");
        }


        checkbox.setState = (state) => {
            checkbox.input.element.checked = state;
        }
        checkbox.getState = () => {
            return checkbox.input.element.checked;
        }

        checkbox.setChangeAction = (func) => {
            checkbox.changeAction = func;
        }
        checkbox.appendTo = (parent) => {
            if (parent && parent instanceof HTMLElement){
                parent.appendChild(checkbox.element);
            }
            else if (parent && parent.element instanceof HTMLElement){
                parent.element.appendChild(checkbox.element);
            }else{
                console.warn("parent has no element property");
            }
        }

        checkbox.setEnabled = (enabled) => {
            checkbox.input.element.disabled = !enabled;
        }

        return checkbox;
    }
    generateCheckbox(parentObj, labelText="", initialState=false, changeAction, tooltip="") {
        let checkbox = this.checkbox(parentObj, labelText, initialState, changeAction, tooltip);
        return checkbox;
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
        // 現在のテーマに応じたアイコンを表示
        const currentTheme = document.body.getAttribute("theme") || "light";
        const themeIcon = "☀";
        let ThemeButton = this.generateButton(parentObj.header.menu, themeIcon, (e) => {
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
        ThemeButton.element.title = "テーマ切り替え (ライト/ダーク)";
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
                // 既存の "../" を削除（重複を防ぐ）
                explorerContents.files = explorerContents.files.filter(f => f.name !== "../");
                
                let parentDir = {
                    name: "../",
                    type: "file",
                }
                explorerContents.files.unshift(parentDir);
            }
            //this.DEBUG && console.log("explorer.loadExplorer() explorerContents: ", explorerContents);
            
            // 現在選択されているファイルのパスを保存
            let selectedFilePath = null;
            const selectedElements = document.getElementsByClassName(this.CLASS_NAME_PREFIX + "file-selected");
            if (selectedElements.length > 0) {
                selectedFilePath = selectedElements[0].id;
            }
            
            let explorerContent = this.explorer;
            // clear old contents
            explorerContent.content.element.innerHTML = "";
            //console.log(this.explorer);
            explorer.files = [];
            this.explorerRecursive(explorerContent, explorerContents, this.BASE_DIR);
            
            // ハイライトを即座に復元
            if (selectedFilePath) {
                const fileElement = document.getElementById(selectedFilePath);
                if (fileElement) {
                    fileElement.classList.add(this.CLASS_NAME_PREFIX + "file-selected");
                }
            }
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
            "新規ファイル",
            (e) => {parentObj.explorer.newFileClickAction();},
            "新しいファイルを作成"
        );
        
        parentObj.explorer.menu.control.items.push(newFileButton);
        
        // ソートメニューボタンを追加
        let sortButton = this.generateButton(
            parentObj.explorer.menu.control,
            "↕",
            (e) => { /* ソートメニューはクリックイベントで処理 */ },
            "ファイルの並び替え"
        );
        sortButton.addTrigger("click", (e) => {
            e.stopPropagation();
            console.log("sort menu clicked");

            // 現在のソート設定を取得
            let currentSort = this.getSortSettings();
            let nameText = currentSort.sortBy === 'name' ? 
                (currentSort.order === 'asc' ? '✓ ファイル名 (A-Z)' : '✓ ファイル名 (Z-A)') : 
                'ファイル名';
            let mtimeText = currentSort.sortBy === 'mtime' ? 
                (currentSort.order === 'asc' ? '✓ 最終更新 (古い-新しい)' : '✓ 最終更新 (新しい-古い)') : 
                '最終更新';

            this.popupMenu(sortButton, [
                {text: nameText, title: "ファイル名でソート", clickAction: (e) => {
                    let newOrder = (currentSort.sortBy === 'name' && currentSort.order === 'asc') ? 'desc' : 'asc';
                    parentObj.explorer.sortClickAction('name', newOrder);
                }},
                {text: mtimeText, title: "最終更新でソート", clickAction: (e) => {
                    let newOrder = (currentSort.sortBy === 'mtime' && currentSort.order === 'asc') ? 'desc' : 'asc';
                    parentObj.explorer.sortClickAction('mtime', newOrder);
                }},
            ]);
            this.page.popupMenuCloseAction = () => {
                //parentObj.explorer.content.element.style.overflowY = "auto";
            }
            //parentObj.explorer.content.element.style.overflowY = "hidden";
        });
        parentObj.explorer.menu.control.items.push(sortButton);
        
        // Reload button
        const reloadButton = this.generateButton(
            parentObj.explorer.menu.control,
            "⟳",
            (e) => {
                if (parentObj.explorer.reloadClickAction) {
                    parentObj.explorer.reloadClickAction();
                }
            },
            "エクスプローラーを再読み込み"
        );
        parentObj.explorer.menu.control.items.push(reloadButton);
        parentObj.explorer.reloadClickAction = () => {
            console.log("Reload explorer action");
        }; // ユーザーが設定するためのプレースホルダー
        parentObj.explorer.setReloadClickAction = (func) => {
            parentObj.explorer.reloadClickAction = func;
        };

        //parentObj.explorer.menu.control.items.push(this.generateButton(parentObj.explorer.menu.control, "New Folder", this.EXPLORER_NEW_DIR_ACTION));
        let otherButton = this.generateButton(
            parentObj.explorer.menu.control,
            "⋮",
            (e) => { /* その他メニューはクリックイベントで処理 */ },
            "その他の操作"
        );
        otherButton.addTrigger("click", (e) => {
            e.stopPropagation();
            console.log("menu clicked");

            this.popupMenu(otherButton, [
                {text: "新規フォルダ", title: "新しいフォルダを作る", clickAction: (e) => {
                    parentObj.explorer.newDirClickAction();
                }},
                {text: "アップロード", title: "ファイルをアップロードする", clickAction: (e) => {
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

        parentObj.explorer.sortClickAction = (sortBy, order) => {
            console.log("sort: ", sortBy, order);
        }
        parentObj.explorer.setSortClickAction = (func) => {
            parentObj.explorer.sortClickAction = func;
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

        /**
         * Show this explorer component by opening its parent panel and tab
         * エクスプローラーが配置されているパネルとタブを自動的に開く
         */
        parentObj.explorer.show = () => {
            this.showComponent(parentObj.explorer);
        }

        /**
         * Highlight a file in the explorer
         * エクスプローラー内のファイルをハイライト表示する（ファイルは開かない）
         * @param {string} filePath - The path of the file to highlight
         */
        parentObj.explorer.highlightFile = (filePath) => {
            // 既存のハイライトを削除
            let oldSelected = document.getElementsByClassName(this.CLASS_NAME_PREFIX + "file-selected");
            for(let i=0; i<oldSelected.length; i++) {
                oldSelected[i].classList.remove(this.CLASS_NAME_PREFIX + "file-selected");
            }
            
            // 該当するファイル要素を探してハイライト
            const fileElement = document.getElementById(filePath);
            if (fileElement) {
                fileElement.classList.add(this.CLASS_NAME_PREFIX + "file-selected");
            }
        }


        this.explorer = parentObj.explorer;
        //console.log(this.explorer);

        return parentObj.explorer;
    }



    /**
     * ソート設定を取得する
     */
    getSortSettings() {
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
            //console.log("file menu clicked:", fileInfo);
            this.popupMenu(fileMenu, [
                {text: "名前変更", title: "ファイル名を変更", clickAction: (e) => {this.explorer.renameClickAction(fileInfo);}},
                {text: "移動", title: "ファイルを別のフォルダに移動", clickAction: (e) => {
                    e.stopPropagation();
                    this.explorer.moveClickAction(fileInfo);
                }},
                {text: "複製", title: "ファイルを複製", clickAction: (e) => {this.explorer.duplicateClickAction(fileInfo);}},
                {text: "削除", title: "ファイルを削除", clickAction: (e) => {this.explorer.deleteClickAction(fileInfo);}},
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
            
            // 右クリックメニューを追加
            file.element.addEventListener("contextmenu", function(e) {
                e.preventDefault();
                e.stopPropagation();
                //console.log("file right-click menu:", fileInfo);
                this.popupMenu(file, 
                    [
                        {text: "名前変更", title: "ファイル名を変更", clickAction: (e) => {this.explorer.renameClickAction(fileInfo);}},
                        {text: "移動", title: "ファイルを別のフォルダに移動", clickAction: (e) => {
                            e.stopPropagation();
                            this.explorer.moveClickAction(fileInfo);
                        }},
                        {text: "複製", title: "ファイルを複製", clickAction: (e) => {this.explorer.duplicateClickAction(fileInfo);}},
                        {text: "削除", title: "ファイルを削除", clickAction: (e) => {this.explorer.deleteClickAction(fileInfo);}},
                    ],
                    {pos: [e.clientX, e.clientY]},
                );
                this.page.popupMenuCloseAction = () => {
                    this.explorer.content.element.style.overflowY = "auto";
                }
                this.explorer.content.element.style.overflowY = "hidden";
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
            //console.log("dir menu clicked:", dirInfo);
            this.popupMenu(dirMenu, [
                {text: "名前変更", title: "フォルダ名を変更", clickAction: (e) => {
                    //console.log("rename: ", dirInfo);
                    this.explorer.renameDirClickAction(dirInfo);
                }},
                {text: "新しいファイル", title: "フォルダ内に新しいファイルを作成", clickAction: (e) => {
                    //console.log("new file: ", dirInfo);
                    this.explorer.newFileClickAction(dirInfo);
                }},
                {text: "新しいフォルダ", title: "フォルダ内に新しいフォルダを作成", clickAction: (e) => {
                    //console.log("new folder: ", dirInfo);
                    this.explorer.newDirClickAction(dirInfo);
                }},
                {text: "アップロード", title: "フォルダ内にファイルをアップロード", clickAction: (e) => {
                    //console.log("upload: ", dirInfo);
                    this.explorer.uploadClickAction(dirInfo);
                }},
                {text: "削除", title: "フォルダを削除", clickAction: (e) => {
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
        
        // フォルダに右クリックメニューを追加
        dirMenu.element.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            e.stopPropagation();
            //console.log("dir right-click menu:", dirInfo);
            this.popupMenu(dirMenu, [
                {text: "名前変更", title: "フォルダ名を変更", clickAction: (e) => {this.explorer.renameDirClickAction(dirInfo);}},
                {text: "新しいファイル", title: "フォルダ内に新しいファイルを作成", clickAction: (e) => {
                    //console.log("new file: ", dirInfo);
                    this.explorer.newFileClickAction(dirInfo);
                }},
                {text: "新しいフォルダ", title: "フォルダ内に新しいフォルダを作成", clickAction: (e) => {
                    //console.log("new folder: ", dirInfo);
                    this.explorer.newDirClickAction(dirInfo);
                }},
                {text: "アップロード", title: "フォルダ内にファイルをアップロード", clickAction: (e) => {
                    //console.log("upload: ", dirInfo);
                    this.explorer.uploadClickAction(dirInfo);
                }},
                {text: "削除", title: "フォルダを削除", clickAction: (e) => {
                    //console.log("delete: ", dirInfo);
                    this.explorer.deleteDirClickAction(dirInfo);
                }}
            ], {pos: [e.clientX, e.clientY]});
            this.page.popupMenuCloseAction = () => {
                this.explorer.content.element.style.overflowY = "auto";
            }
            this.explorer.content.element.style.overflowY = "hidden";
        }.bind(this));
        
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
        if (parentObj && parentObj.element) {
            parentObj.element.appendChild(mConsole.element);
        }

        let consoleMenu = {};
        consoleMenu.element = document.createElement("div");
        consoleMenu.element.classList.add(this.CLASS_NAME_PREFIX + "console-menu");
        mConsole.element.appendChild(consoleMenu.element);
        mConsole.menu = consoleMenu;

        // Left menu container (title and left-aligned items)
        let consoleMenuLeft = {};
        consoleMenuLeft.element = document.createElement("div");
        consoleMenuLeft.element.classList.add(this.CLASS_NAME_PREFIX + "console-menu-left");
        consoleMenu.element.appendChild(consoleMenuLeft.element);
        mConsole.menuLeft = consoleMenuLeft;

        const title = document.createElement("div");
        title.classList.add(this.CLASS_NAME_PREFIX + "console-title");
        title.innerHTML = "Console";
        consoleMenuLeft.element.appendChild(title);
        mConsole.title = title;

        // Right menu container (right-aligned items)
        let consoleMenuRight = {};
        consoleMenuRight.element = document.createElement("div");
        consoleMenuRight.element.classList.add(this.CLASS_NAME_PREFIX + "console-menu-right");
        consoleMenu.element.appendChild(consoleMenuRight.element);
        mConsole.menuRight = consoleMenuRight;

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
                out.scrollTop = out.scrollHeight;
            }
        }

        /**
         * Show this console component by opening its parent panel and tab
         * コンソールが配置されているパネルとタブを自動的に開く
         */
        mConsole.show = () => {
            this.showComponent(mConsole);
        }

        /**
         * Set console title
         * @param {string} title 
         */
        mConsole.setTitle = (title) => {
            mConsole.title.innerHTML = title;
        }

        /**
         * Add component to left menu (next to title)
         * タイトルの右側（左寄せエリア）にコンポーネントを追加
         * @param {Object|HTMLElement} component - Component to add (MEditor component object or DOM element)
         */
        mConsole.addMenuComponent = (component) => {
            if (component && component.element instanceof HTMLElement) {
                consoleMenuLeft.element.appendChild(component.element);
            } else if (component instanceof HTMLElement) {
                consoleMenuLeft.element.appendChild(component);
            } else {
                console.error("Invalid component: must have .element property or be an HTMLElement");
            }
        }

        /**
         * Add component to right menu (right-aligned)
         * 右寄せエリアにコンポーネントを追加
         * @param {Object|HTMLElement} component - Component to add (MEditor component object or DOM element)
         */
        mConsole.addRightMenuComponent = (component) => {
            if (component && component.element instanceof HTMLElement) {
                consoleMenuRight.element.appendChild(component.element);
            } else if (component instanceof HTMLElement) {
                consoleMenuRight.element.appendChild(component);
            } else {
                console.error("Invalid component: must have .element property or be an HTMLElement");
            }
        }

        /**
         * Remove all components from left menu (except title)
         * 左メニューからタイトル以外のすべてのコンポーネントを削除
         */
        mConsole.clearMenuComponents = () => {
            while (consoleMenuLeft.element.children.length > 1) {
                consoleMenuLeft.element.removeChild(consoleMenuLeft.element.lastChild);
            }
        }

        /**
         * Remove all components from right menu
         * 右メニューからすべてのコンポーネントを削除
         */
        mConsole.clearRightMenuComponents = () => {
            consoleMenuRight.element.innerHTML = "";
        }

        return mConsole;
    }
    
    /**
     * Create a vertical stack layout with N resizable panes (top to bottom).
     * Each pane is separated by a horizontal sash that can be dragged to resize.
     *
     * Inputs:
     * - parentObj: target container (object with .element or an HTMLElement)
     * - options:
     *   - count: number of panes (default 2)
     *   - sizes: initial sizes. When unit='ratio', provide weights (e.g., [2,1,1]).
     *            When unit='percent', provide percentages (e.g., [50,30,20]).
     *            When unit='px', provide pixel heights (container-dependent).
     *   - unit: 'ratio' | 'percent' | 'px' (default 'ratio')
     *   - minHeight: min pane height in px (default from pageSettings.split.minHeight)
     *   - sashSize: sash thickness in px (default from pageSettings.splitSash.width)
     *   - preserveProportionsOnResize: if true, maintains ratios on container resize (default true)
     *   - saveKey: localStorage key to persist ratios between sessions (optional)
     *   - onResizeEnd: callback({ratios, px, percent}) after user finishes a drag
     *
     * Outputs:
     * - { element, panes[], getSizes(unit), setSizes(values, unit), getPane(i), destroy() }
     */
    createVStack(parentObj = null, options = {}) {
        const parentEl = parentObj?.element instanceof HTMLElement
            ? parentObj.element
            : (parentObj instanceof HTMLElement ? parentObj : this.page?.element);
        if (!parentEl) {
            console.error("createVStack: invalid parent");
            return null;
        }

        const cfg = Object.assign({
            count: 2,
            sizes: null,
            unit: 'ratio', // ratio | percent | px
            minHeight: this.pageSettings?.split?.minHeight ?? 60,
            sashSize: this.pageSettings?.splitSash?.width ?? 10,
            preserveProportionsOnResize: true,
            saveKey: null,
            onResizeEnd: null,
        }, options || {});

        const container = {};
        container.element = document.createElement('div');
        container.element.classList.add(this.CLASS_NAME_PREFIX + 'vstack-container');
        // inline styles to avoid CSS dependency
        container.element.style.position = 'relative';
        container.element.style.width = '100%';
        container.element.style.height = '100%';
        parentEl.appendChild(container.element);

        // Internal state
        const count = Math.max(1, parseInt(cfg.count || 2));
        const sashSize = Math.max(0, parseInt(cfg.sashSize));
        const minHeight = Math.max(0, parseInt(cfg.minHeight));
        const sashes = [];
        const panes = [];

        // Helpers
        const totalAvailable = () => {
            const h = container.element.clientHeight;
            return Math.max(0, h - (count - 1) * sashSize);
        };

        const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

        const toRatios = (values, unit) => {
            let ratios = [];
            if (!values || values.length !== count) {
                // equal split
                ratios = new Array(count).fill(1 / count);
                return ratios;
            }
            unit = unit || cfg.unit || 'ratio';
            if (unit === 'ratio') {
                const sum = values.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
                ratios = values.map(v => (Number(v) || 0) / sum);
            } else if (unit === 'percent') {
                ratios = values.map(v => (Number(v) || 0) / 100);
                const sum = ratios.reduce((a, b) => a + b, 0) || 1;
                ratios = ratios.map(r => r / sum);
            } else if (unit === 'px') {
                const avail = totalAvailable() || 1;
                ratios = values.map(v => (Number(v) || 0) / avail);
                const sum = ratios.reduce((a, b) => a + b, 0) || 1;
                ratios = ratios.map(r => r / sum);
            } else {
                console.warn('Unknown unit for sizes:', unit);
                ratios = new Array(count).fill(1 / count);
            }
            return ratios;
        };

        const fromRatios = (ratios, unit) => {
            unit = unit || 'ratio';
            const avail = Math.max(1, totalAvailable());
            if (unit === 'ratio') return ratios.slice();
            if (unit === 'percent') return ratios.map(r => r * 100);
            if (unit === 'px') return ratios.map(r => Math.round(r * avail));
            return ratios.slice();
        };

        // Load/save ratios
        const saveRatios = () => {
            if (!cfg.saveKey) return;
            try { localStorage.setItem(cfg.saveKey, JSON.stringify(container._ratios)); } catch {}
        };
        const loadRatios = () => {
            if (!cfg.saveKey) return null;
            try {
                const raw = localStorage.getItem(cfg.saveKey);
                if (!raw) return null;
                const arr = JSON.parse(raw);
                if (Array.isArray(arr) && arr.length === count) return arr;
            } catch {}
            return null;
        };

        // Initialize ratios
        container._ratios = loadRatios() || toRatios(cfg.sizes, cfg.unit);

        // Build panes
        for (let i = 0; i < count; i++) {
            const pane = {};
            pane.element = document.createElement('div');
            pane.element.classList.add(this.CLASS_NAME_PREFIX + 'split-h');
            pane.element.classList.add(this.CLASS_NAME_PREFIX + 'vstack-pane');
            // absolute placement
            pane.element.style.position = 'absolute';
            pane.element.style.left = '0';
            pane.element.style.width = '100%';
            container.element.appendChild(pane.element);
            panes.push(pane);
        }

        // Build sashes (between panes)
        for (let i = 0; i < count - 1; i++) {
            const sash = {};
            sash.index = i; // between pane i and i+1
            sash.element = document.createElement('div');
            sash.element.classList.add(this.CLASS_NAME_PREFIX + 'sash-h');
            sash.element.style.height = sashSize + 'px';
            container.element.appendChild(sash.element);

            // Drag logic
            let startY = 0;
            let startHeights = null; // [upperPx, lowerPx]
            const onMove = (e) => {
                const avail = totalAvailable();
                const dy = e.clientY - startY;
                let upper = startHeights[0] + dy;
                let lower = startHeights[1] - dy;
                // Enforce minimums
                const otherSum = fromRatios(container._ratios, 'px').reduce((a, b, idx) => {
                    if (idx === i || idx === i + 1) return a;
                    return a + b;
                }, 0);
                // Clamp within bounds
                upper = clamp(upper, minHeight, avail - otherSum - minHeight);
                lower = clamp(lower, minHeight, avail - otherSum - minHeight);
                const newUpperRatio = upper / avail;
                const newLowerRatio = lower / avail;
                // Keep others as-is; re-normalize remaining space precisely across i and i+1
                const ratios = container._ratios.slice();
                ratios[i] = newUpperRatio;
                ratios[i + 1] = newLowerRatio;
                // Normalize i and i+1 so total stays 1 - others
                const others = container._ratios.reduce((a, r, idx) => (idx === i || idx === i + 1 ? a : a + r), 0);
                const remain = 1 - others;
                const sumPair = newUpperRatio + newLowerRatio || 1e-6;
                ratios[i] = remain * (newUpperRatio / sumPair);
                ratios[i + 1] = remain * (newLowerRatio / sumPair);
                container._ratios = ratios;
                layout();
            };
            const onUp = (e) => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                document.body.style.userSelect = '';
                // Re-enable iframe pointer events
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = '';
                });
                saveRatios();
                if (typeof cfg.onResizeEnd === 'function') {
                    cfg.onResizeEnd({
                        ratios: container._ratios.slice(),
                        px: fromRatios(container._ratios, 'px'),
                        percent: fromRatios(container._ratios, 'percent')
                    });
                }
            };
            sash.element.addEventListener('mousedown', (e) => {
                // Prevent text selection and iframe interference while resizing
                document.body.style.userSelect = 'none';
                // Block all iframes from capturing mouse events
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = 'none';
                });
                startY = e.clientY;
                const px = fromRatios(container._ratios, 'px');
                startHeights = [px[i], px[i + 1]];
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });

            sashes.push(sash);
        }

        // Layout computation
        const layout = () => {
            const avail = totalAvailable();
            if (avail <= 0) return;
            // Ensure ratios are valid and respect minHeight when possible
            let pxHeights = fromRatios(container._ratios, 'px');
            // Enforce minHeight pass
            const deficit = (need, give) => {
                // Try to pull from give indices proportionally
                let totalGive = give.reduce((a, idx) => a + pxHeights[idx], 0) || 1;
                give.forEach(idx => {
                    const cut = (pxHeights[idx] / totalGive) * need;
                    pxHeights[idx] = Math.max(minHeight, pxHeights[idx] - cut);
                });
            };
            // First raise any below minHeight
            let needSum = 0;
            const tooSmall = [];
            const large = [];
            for (let i = 0; i < count; i++) {
                if (pxHeights[i] < minHeight) {
                    needSum += (minHeight - pxHeights[i]);
                    tooSmall.push(i);
                } else {
                    large.push(i);
                }
            }
            if (needSum > 0 && large.length) {
                deficit(needSum, large);
                // Recompute need after redistribution
                for (let i of tooSmall) pxHeights[i] = Math.max(minHeight, pxHeights[i]);
            }
            // Normalize back to avail
            const sumPx = pxHeights.reduce((a, b) => a + b, 0) || 1;
            const scale = avail / sumPx;
            pxHeights = pxHeights.map(v => v * scale);
            // Update ratios from px to keep consistency
            container._ratios = toRatios(pxHeights, 'px');

            // Position panes and sashes
            let y = 0;
            for (let i = 0; i < count; i++) {
                const h = Math.max(minHeight, Math.round(pxHeights[i]));
                const pane = panes[i].element;
                pane.style.top = y + 'px';
                pane.style.height = h + 'px';
                if (i < sashes.length) {
                    const sash = sashes[i].element;
                    // center sash on the boundary
                    sash.style.top = Math.round(y + h - sashSize / 2) + 'px';
                }
                y += h;
                if (i < sashes.length) y += sashSize;
            }
        };

        // Attach a resize observer to maintain layout
        const ro = new ResizeObserver(() => {
            if (cfg.preserveProportionsOnResize) {
                // ratios already preserve proportions; just re-layout
                layout();
            } else {
                // Keep px fixed as much as possible; convert to px and re-derive ratios
                const px = fromRatios(container._ratios, 'px');
                container._ratios = toRatios(px, 'px');
                layout();
            }
        });
        ro.observe(container.element);
        container._resizeObserver = ro;

        // Public API
        container.panes = panes;
        container.getPane = (i) => panes[i] || null;
        container.getSizes = (unit = 'ratio') => fromRatios(container._ratios, unit);
        container.setSizes = (values, unit = cfg.unit || 'ratio') => {
            container._ratios = toRatios(values, unit);
            saveRatios();
            layout();
        };
        container.destroy = () => {
            try { ro.disconnect(); } catch {}
            container.element.remove();
        };

        // Initial layout after mount
        // Defer to ensure container has computed size
        setTimeout(layout, 0);

        return container;
    }
    
    /**
     * Create a horizontal stack layout with N resizable panes (left to right).
     * Each pane is separated by a vertical sash that can be dragged to resize.
     *
     * Inputs:
     * - parentObj: target container (object with .element or an HTMLElement)
     * - options:
     *   - count: number of panes (default 2)
     *   - sizes: initial sizes. When unit='ratio', provide weights (e.g., [2,1,1]).
     *            When unit='percent', provide percentages (e.g., [50,30,20]).
     *            When unit='px', provide pixel widths (container-dependent).
     *   - unit: 'ratio' | 'percent' | 'px' (default 'ratio')
     *   - minWidth: min pane width in px (default from pageSettings.split.minWidth)
     *   - sashSize: sash thickness in px (default from pageSettings.splitSash.width)
     *   - preserveProportionsOnResize: if true, maintains ratios on container resize (default true)
     *   - saveKey: localStorage key to persist ratios between sessions (optional)
     *   - onResizeEnd: callback({ratios, px, percent}) after user finishes a drag
     *
     * Outputs:
     * - { element, panes[], getSizes(unit), setSizes(values, unit), getPane(i), destroy() }
     */
    createHStack(parentObj = null, options = {}) {
        const parentEl = parentObj?.element instanceof HTMLElement
            ? parentObj.element
            : (parentObj instanceof HTMLElement ? parentObj : this.page?.element);
        if (!parentEl) {
            console.error("createHStack: invalid parent");
            return null;
        }

        const cfg = Object.assign({
            count: 2,
            sizes: null,
            unit: 'ratio', // ratio | percent | px
            minWidth: this.pageSettings?.split?.minWidth ?? 100,
            sashSize: this.pageSettings?.splitSash?.width ?? 10,
            preserveProportionsOnResize: true,
            saveKey: null,
            onResizeEnd: null,
        }, options || {});

        const container = {};
        container.element = document.createElement('div');
        container.element.classList.add(this.CLASS_NAME_PREFIX + 'hstack-container');
        container.element.style.position = 'relative';
        container.element.style.width = '100%';
        container.element.style.height = '100%';
        parentEl.appendChild(container.element);

        // Internal state
        const count = Math.max(1, parseInt(cfg.count || 2));
        const sashSize = Math.max(0, parseInt(cfg.sashSize));
        const minWidth = Math.max(0, parseInt(cfg.minWidth));
        const sashes = [];
        const panes = [];

        // Helpers
        const totalAvailable = () => {
            const w = container.element.clientWidth;
            return Math.max(0, w - (count - 1) * sashSize);
        };
        const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

        const toRatios = (values, unit) => {
            let ratios = [];
            if (!values || values.length !== count) {
                ratios = new Array(count).fill(1 / count);
                return ratios;
            }
            unit = unit || cfg.unit || 'ratio';
            if (unit === 'ratio') {
                const sum = values.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
                ratios = values.map(v => (Number(v) || 0) / sum);
            } else if (unit === 'percent') {
                ratios = values.map(v => (Number(v) || 0) / 100);
                const sum = ratios.reduce((a, b) => a + b, 0) || 1;
                ratios = ratios.map(r => r / sum);
            } else if (unit === 'px') {
                const avail = totalAvailable() || 1;
                ratios = values.map(v => (Number(v) || 0) / avail);
                const sum = ratios.reduce((a, b) => a + b, 0) || 1;
                ratios = ratios.map(r => r / sum);
            } else {
                console.warn('Unknown unit for sizes:', unit);
                ratios = new Array(count).fill(1 / count);
            }
            return ratios;
        };

        const fromRatios = (ratios, unit) => {
            unit = unit || 'ratio';
            const avail = Math.max(1, totalAvailable());
            if (unit === 'ratio') return ratios.slice();
            if (unit === 'percent') return ratios.map(r => r * 100);
            if (unit === 'px') return ratios.map(r => Math.round(r * avail));
            return ratios.slice();
        };

        // Load/save ratios
        const saveRatios = () => {
            if (!cfg.saveKey) return;
            try { localStorage.setItem(cfg.saveKey, JSON.stringify(container._ratios)); } catch {}
        };
        const loadRatios = () => {
            if (!cfg.saveKey) return null;
            try {
                const raw = localStorage.getItem(cfg.saveKey);
                if (!raw) return null;
                const arr = JSON.parse(raw);
                if (Array.isArray(arr) && arr.length === count) return arr;
            } catch {}
            return null;
        };

        container._ratios = loadRatios() || toRatios(cfg.sizes, cfg.unit);

        // Build panes
        for (let i = 0; i < count; i++) {
            const pane = {};
            pane.element = document.createElement('div');
            pane.element.classList.add(this.CLASS_NAME_PREFIX + 'split-v');
            pane.element.classList.add(this.CLASS_NAME_PREFIX + 'hstack-pane');
            pane.element.style.position = 'absolute';
            pane.element.style.top = '0';
            pane.element.style.height = '100%';
            container.element.appendChild(pane.element);
            panes.push(pane);
        }

        // Build sashes (between panes)
        for (let i = 0; i < count - 1; i++) {
            const sash = {};
            sash.index = i; // between pane i and i+1
            sash.element = document.createElement('div');
            sash.element.classList.add(this.CLASS_NAME_PREFIX + 'sash-v');
            sash.element.style.width = sashSize + 'px';
            container.element.appendChild(sash.element);

            // Drag logic
            let startX = 0;
            let startWidths = null; // [leftPx, rightPx]
            const onMove = (e) => {
                const avail = totalAvailable();
                const dx = e.clientX - startX;
                let left = startWidths[0] + dx;
                let right = startWidths[1] - dx;
                // Enforce minimums
                const otherSum = fromRatios(container._ratios, 'px').reduce((a, b, idx) => {
                    if (idx === i || idx === i + 1) return a;
                    return a + b;
                }, 0);
                // Clamp within bounds
                left = clamp(left, minWidth, avail - otherSum - minWidth);
                right = clamp(right, minWidth, avail - otherSum - minWidth);
                const newLeftRatio = left / avail;
                const newRightRatio = right / avail;
                // Keep others as-is; re-normalize remaining space precisely across i and i+1
                const ratios = container._ratios.slice();
                ratios[i] = newLeftRatio;
                ratios[i + 1] = newRightRatio;
                const others = container._ratios.reduce((a, r, idx) => (idx === i || idx === i + 1 ? a : a + r), 0);
                const remain = 1 - others;
                const sumPair = newLeftRatio + newRightRatio || 1e-6;
                ratios[i] = remain * (newLeftRatio / sumPair);
                ratios[i + 1] = remain * (newRightRatio / sumPair);
                container._ratios = ratios;
                layout();
            };
            const onUp = (e) => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                document.body.style.userSelect = '';
                // Re-enable iframe pointer events
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = '';
                });
                saveRatios();
                if (typeof cfg.onResizeEnd === 'function') {
                    cfg.onResizeEnd({
                        ratios: container._ratios.slice(),
                        px: fromRatios(container._ratios, 'px'),
                        percent: fromRatios(container._ratios, 'percent')
                    });
                }
            };
            sash.element.addEventListener('mousedown', (e) => {
                document.body.style.userSelect = 'none';
                // Block all iframes from capturing mouse events
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    iframe.style.pointerEvents = 'none';
                });
                startX = e.clientX;
                const px = fromRatios(container._ratios, 'px');
                startWidths = [px[i], px[i + 1]];
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });

            sashes.push(sash);
        }

        // Layout computation
        const layout = () => {
            const avail = totalAvailable();
            if (avail <= 0) return;
            let pxWidths = fromRatios(container._ratios, 'px');
            // Enforce minWidth
            const deficit = (need, give) => {
                let totalGive = give.reduce((a, idx) => a + pxWidths[idx], 0) || 1;
                give.forEach(idx => {
                    const cut = (pxWidths[idx] / totalGive) * need;
                    pxWidths[idx] = Math.max(minWidth, pxWidths[idx] - cut);
                });
            };
            let needSum = 0;
            const tooSmall = [];
            const large = [];
            for (let i = 0; i < count; i++) {
                if (pxWidths[i] < minWidth) {
                    needSum += (minWidth - pxWidths[i]);
                    tooSmall.push(i);
                } else {
                    large.push(i);
                }
            }
            if (needSum > 0 && large.length) {
                deficit(needSum, large);
                for (let i of tooSmall) pxWidths[i] = Math.max(minWidth, pxWidths[i]);
            }
            const sumPx = pxWidths.reduce((a, b) => a + b, 0) || 1;
            const scale = avail / sumPx;
            pxWidths = pxWidths.map(v => v * scale);
            container._ratios = toRatios(pxWidths, 'px');

            let x = 0;
            for (let i = 0; i < count; i++) {
                const w = Math.max(minWidth, Math.round(pxWidths[i]));
                const pane = panes[i].element;
                pane.style.left = x + 'px';
                pane.style.width = w + 'px';
                if (i < sashes.length) {
                    const sash = sashes[i].element;
                    sash.style.left = Math.round(x + w - sashSize / 2) + 'px';
                }
                x += w;
                if (i < sashes.length) x += sashSize;
            }
        };

        // Resize observer
        const ro = new ResizeObserver(() => {
            if (cfg.preserveProportionsOnResize) {
                layout();
            } else {
                const px = fromRatios(container._ratios, 'px');
                container._ratios = toRatios(px, 'px');
                layout();
            }
        });
        ro.observe(container.element);
        container._resizeObserver = ro;

        // Public API
        container.panes = panes;
        container.getPane = (i) => panes[i] || null;
        container.getSizes = (unit = 'ratio') => fromRatios(container._ratios, unit);
        container.setSizes = (values, unit = cfg.unit || 'ratio') => {
            container._ratios = toRatios(values, unit);
            saveRatios();
            layout();
        };
        container.destroy = () => {
            try { ro.disconnect(); } catch {}
            container.element.remove();
        };

        setTimeout(layout, 0);
        return container;
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


    dictMenu(parentObj=null) {
        let dictMenu = {};
        dictMenu.element = document.createElement("div");
        dictMenu.element.classList.add(this.CLASS_NAME_PREFIX + "dict-menu");
        if(parentObj && parentObj.element) {
            parentObj.element.appendChild(dictMenu.element);
            parentObj.dictMenu = dictMenu;
        }
        dictMenu.items = [];
        dictMenu.itemElements = [];
        dictMenu.onChangeCallback = null; // 変更時のコールバック

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
            button.element.title = "項目を追加";
            button.element.addEventListener("click", (e) => {
                let item = {"":""};
                dictMenu.addItem(item);
                // 追加時もコールバックを実行
                if (dictMenu.onChangeCallback) {
                    dictMenu.onChangeCallback(dictMenu.getItemsAsObject());
                }
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
                    // 変更時コールバックを実行
                    if (dictMenu.onChangeCallback) {
                        dictMenu.onChangeCallback(dictMenu.getItemsAsObject());
                    }
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
                    // 変更時コールバックを実行
                    if (dictMenu.onChangeCallback) {
                        dictMenu.onChangeCallback(dictMenu.getItemsAsObject());
                    }
                })
                value.appendChild(valueInput);
                
                let separator = document.createElement("span");
                separator.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-separator");
                separator.innerHTML = " : ";

                let deleteButton = document.createElement("button");
                deleteButton.classList.add(this.CLASS_NAME_PREFIX + "dict-menu-item-delete-button");
                deleteButton.innerHTML = "×";
                deleteButton.title = "この項目を削除";
                deleteButton.addEventListener("click", (e) => {
                    dictMenu.items = dictMenu.items.filter((i) => i != dict);
                    itemElement.remove();
                    // 削除時もコールバックを実行
                    if (dictMenu.onChangeCallback) {
                        dictMenu.onChangeCallback(dictMenu.getItemsAsObject());
                    }
                });
                itemElement.appendChild(key);
                itemElement.appendChild(separator);
                itemElement.appendChild(value);
                itemElement.appendChild(deleteButton);
                dictMenu.content.element.appendChild(itemElement);
                dictMenu.itemElements.push(itemElement);
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

        dictMenu.setEnabled = (bool) => {
            dictMenu.element.querySelectorAll("input, button").forEach((el) => {
                el.disabled = !bool;
            });
        }

        dictMenu.onChange = (callback) => {
            dictMenu.onChangeCallback = callback;
        }

        return dictMenu;
    }

    createDictMenu(parentObj=null, opt={}) {
        let dictMenu = this.dictMenu(parentObj);
        dictMenu.items = [];
        dictMenu.options = opt;

        return dictMenu;
    }

    /**
     * JSON形式のテキストエディタを作成（Ace Editor使用）
     * @param {object} parentObj - 親オブジェクト
     * @param {object} opt - オプション設定
     * @returns {object} jsonEditorオブジェクト
     */
    jsonEditor(parentObj=null, opt={}) {
        let jsonEditor = {};
        jsonEditor.element = document.createElement("div");
        jsonEditor.element.classList.add(this.CLASS_NAME_PREFIX + "json-editor");
        
        if(parentObj && parentObj.element) {
            parentObj.element.appendChild(jsonEditor.element);
            parentObj.jsonEditor = jsonEditor;
        }
        
        jsonEditor.onChangeCallback = null;
        jsonEditor.isValid = true;
        jsonEditor.useAce = typeof ace !== 'undefined'; // Aceが利用可能かチェック
        
        // タイトル
        let title = {};
        title.element = document.createElement("div");
        title.element.classList.add(this.CLASS_NAME_PREFIX + "json-editor-title");
        title.element.innerHTML = "JSON";
        jsonEditor.element.appendChild(title.element);
        jsonEditor.title = title;
        
        // エディタコンテナ
        let editorContainer = {};
        editorContainer.element = document.createElement("div");
        editorContainer.element.classList.add(this.CLASS_NAME_PREFIX + "json-editor-container");
        jsonEditor.element.appendChild(editorContainer.element);
        jsonEditor.editorContainer = editorContainer;
        
        // エラーメッセージ表示エリア
        let errorMsg = {};
        errorMsg.element = document.createElement("div");
        errorMsg.element.classList.add(this.CLASS_NAME_PREFIX + "json-editor-error");
        errorMsg.element.style.display = "none";
        jsonEditor.element.appendChild(errorMsg.element);
        jsonEditor.errorMsg = errorMsg;
        
        if (jsonEditor.useAce) {
            // Ace Editorを使用（遅延初期化）
            let aceEditorId = this.CLASS_NAME_PREFIX + "json-ace-" + Math.random().toString(36).substr(2, 9);
            let aceEditorElement = document.createElement("div");
            aceEditorElement.id = aceEditorId;
            aceEditorElement.classList.add(this.CLASS_NAME_PREFIX + "json-editor-ace");
            editorContainer.element.appendChild(aceEditorElement);
            
            // DOMに追加されているかチェックする関数
            let isInDOM = () => {
                return document.body.contains(aceEditorElement);
            };
            
            // Ace Editorの初期化を遅延実行（DOMに追加された後）
            let aceEditor = null;
            let initAce = () => {
                if (aceEditor) return aceEditor; // 既に初期化済み
                
                // DOMに追加されていない場合は初期化しない
                if (!isInDOM()) {
                    console.warn('JSON Editor: Ace initialization skipped - element not in DOM yet');
                    return null;
                }
                
                aceEditor = ace.edit(aceEditorId);
                aceEditor.$blockScrolling = Infinity;
                
                // テーマ設定（親のテーマに合わせる）
                const theme = this.THEME === 'dark' ? 'ace/theme/monokai' : 'ace/theme/chrome';
                aceEditor.setTheme(theme);
                
                aceEditor.setFontSize(13);
                aceEditor.setShowPrintMargin(false);
                aceEditor.getSession().setMode("ace/mode/json");
                aceEditor.getSession().setUseWrapMode(true);
                aceEditor.getSession().setTabSize(2);
                aceEditor.getSession().setUseSoftTabs(true);
                aceEditor.renderer.setShowGutter(false);
                
                aceEditor.setOptions({
                    fontFamily: "monospace",
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: false,
                    enableSnippets: false,
                    scrollPastEnd: 0.2,
                });
                
                // プレースホルダー的な初期値
                aceEditor.setValue('{\n  "key": "value",\n  "nested": {\n    "key2": "value2"\n  },\n  "array": [1, 2, 3]\n}', -1);
                aceEditor.clearSelection();
                
                // 変更イベント（デバウンス付き）
                let validationTimeout = null;
                aceEditor.getSession().on("change", (e) => {
                    clearTimeout(validationTimeout);
                    validationTimeout = setTimeout(() => {
                        const isValid = jsonEditor.validate();
                        
                        if (isValid && jsonEditor.onChangeCallback) {
                            try {
                                const obj = jsonEditor.getValue();
                                jsonEditor.onChangeCallback(obj);
                            } catch (e) {
                                console.error("JSON parse error:", e);
                            }
                        }
                    }, 500);
                });
                
                return aceEditor;
            };
            
            jsonEditor.aceEditor = null;
            jsonEditor.initAce = initAce;
            
            // バリデーション関数（Ace用）
            jsonEditor.validate = () => {
                const ace = jsonEditor.aceEditor || initAce();
                if (!ace) return true; // DOMに追加されていない場合はスキップ
                
                const text = ace.getValue().trim();
                
                // 空の場合は有効
                if (text === '') {
                    jsonEditor.isValid = true;
                    errorMsg.element.style.display = "none";
                    // Aceのアノテーションをクリア
                    ace.getSession().clearAnnotations();
                    return true;
                }
                
                try {
                    JSON.parse(text);
                    jsonEditor.isValid = true;
                    errorMsg.element.style.display = "none";
                    // Aceのアノテーションをクリア
                    ace.getSession().clearAnnotations();
                    return true;
                } catch (e) {
                    jsonEditor.isValid = false;
                    errorMsg.element.textContent = "JSONエラー: " + e.message;
                    errorMsg.element.style.display = "block";
                    
                    // エラー位置を特定してAceにアノテーション追加
                    let row = 0;
                    const match = e.message.match(/position\s+(\d+)/i);
                    if (match) {
                        const position = parseInt(match[1]);
                        const lines = text.substring(0, position).split('\n');
                        row = lines.length - 1;
                    }
                    
                    ace.getSession().setAnnotations([{
                        row: row,
                        column: 0,
                        text: e.message,
                        type: "error"
                    }]);
                    
                    return false;
                }
            };
            
            // 値を取得（オブジェクトとして）
            jsonEditor.getValue = () => {
                const ace = jsonEditor.aceEditor || initAce();
                if (!ace) return {}; // DOMに追加されていない場合は空オブジェクト
                
                const text = ace.getValue().trim();
                if (text === '') {
                    return {};
                }
                return JSON.parse(text);
            };
            
            // 値を設定（オブジェクトまたはJSON文字列）
            jsonEditor.setValue = (value) => {
                const ace = jsonEditor.aceEditor || initAce();
                if (!ace) {
                    console.warn('JSON Editor: setValue skipped - Ace not initialized yet');
                    return;
                }
                
                if (typeof value === 'string') {
                    ace.setValue(value, -1);
                } else if (typeof value === 'object') {
                    ace.setValue(JSON.stringify(value, null, 2), -1);
                }
                ace.clearSelection();
                jsonEditor.validate();
            };
            
            // 有効/無効化
            jsonEditor.setEnabled = (bool) => {
                const ace = jsonEditor.aceEditor || initAce();
                if (!ace) {
                    console.warn('JSON Editor: setEnabled skipped - Ace not initialized yet');
                    return;
                }
                
                ace.setReadOnly(!bool);
                if (!bool) {
                    ace.setOptions({
                        highlightActiveLine: false,
                        highlightGutterLine: false
                    });
                } else {
                    ace.setOptions({
                        highlightActiveLine: true,
                        highlightGutterLine: true
                    });
                }
            };
            
            // テーマ変更メソッド
            jsonEditor.setTheme = (theme) => {
                const ace = jsonEditor.aceEditor || initAce();
                if (!ace) {
                    console.warn('JSON Editor: setTheme skipped - Ace not initialized yet');
                    return;
                }
                
                const aceTheme = theme === 'dark' ? 'ace/theme/monokai' : 'ace/theme/chrome';
                ace.setTheme(aceTheme);
            };
            
        } else {
            // フォールバック: 通常のテキストエリア
            let textarea = {};
            textarea.element = document.createElement("textarea");
            textarea.element.classList.add(this.CLASS_NAME_PREFIX + "json-editor-textarea");
            textarea.element.placeholder = '{\n  "key": "value",\n  "nested": {\n    "key2": "value2"\n  },\n  "array": [1, 2, 3]\n}';
            textarea.element.spellcheck = false;
            editorContainer.element.appendChild(textarea.element);
            jsonEditor.textarea = textarea;
            
            // バリデーション関数（テキストエリア用）
            jsonEditor.validate = () => {
                const text = textarea.element.value.trim();
                
                if (text === '') {
                    jsonEditor.isValid = true;
                    errorMsg.element.style.display = "none";
                    textarea.element.classList.remove(this.CLASS_NAME_PREFIX + "json-editor-textarea-error");
                    return true;
                }
                
                try {
                    JSON.parse(text);
                    jsonEditor.isValid = true;
                    errorMsg.element.style.display = "none";
                    textarea.element.classList.remove(this.CLASS_NAME_PREFIX + "json-editor-textarea-error");
                    return true;
                } catch (e) {
                    jsonEditor.isValid = false;
                    errorMsg.element.textContent = "JSONエラー: " + e.message;
                    errorMsg.element.style.display = "block";
                    textarea.element.classList.add(this.CLASS_NAME_PREFIX + "json-editor-textarea-error");
                    return false;
                }
            };
            
            // 入力イベント
            let validationTimeout = null;
            textarea.element.addEventListener("input", (e) => {
                clearTimeout(validationTimeout);
                validationTimeout = setTimeout(() => {
                    jsonEditor.validate();
                }, 500);
            });
            
            textarea.element.addEventListener("change", (e) => {
                clearTimeout(validationTimeout);
                const isValid = jsonEditor.validate();
                
                if (isValid && jsonEditor.onChangeCallback) {
                    try {
                        const obj = jsonEditor.getValue();
                        jsonEditor.onChangeCallback(obj);
                    } catch (e) {
                        console.error("JSON parse error:", e);
                    }
                }
            });
            
            // 値を取得
            jsonEditor.getValue = () => {
                const text = textarea.element.value.trim();
                if (text === '') {
                    return {};
                }
                return JSON.parse(text);
            };
            
            // 値を設定
            jsonEditor.setValue = (value) => {
                if (typeof value === 'string') {
                    textarea.element.value = value;
                } else if (typeof value === 'object') {
                    textarea.element.value = JSON.stringify(value, null, 2);
                }
                jsonEditor.validate();
            };
            
            // 有効/無効化
            jsonEditor.setEnabled = (bool) => {
                textarea.element.disabled = !bool;
            };
            
            // テーマ変更メソッド（テキストエリアでは何もしない）
            jsonEditor.setTheme = (theme) => {
                // No-op for textarea
            };
        }
        
        // タイトル設定
        jsonEditor.setTitle = (text) => {
            title.element.innerHTML = text;
        };
        
        // 変更時コールバック
        jsonEditor.onChange = (callback) => {
            jsonEditor.onChangeCallback = callback;
        };
        
        return jsonEditor;
    }

    createJsonEditor(parentObj=null, opt={}) {
        let jsonEditor = this.jsonEditor(parentObj, opt);
        return jsonEditor;
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

        chat.config = {};
        chat.config.customApiUrl = null;
        chat.config.customApiKey = null;
        chat.config.useCustomApi = false;


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
        chat.clearBtn.element.title = "チャット履歴をクリア";
        chat.clearBtn.element.className = this.CLASS_NAME_PREFIX + "chat-clear-btn";
        chat.clearBtn.element.style.marginLeft = "0.5em";
        chat.topMenu.element.appendChild(chat.clearBtn.element);

        // 履歴クリア処理
        chat.clearHistory = function() {
            // chat.messages（UI履歴）
            if (Array.isArray(chat.messages)) chat.messages.length = 0;
            // 画面上の履歴
            if (chat.content && chat.content.element) {
                let historyElements = chat.content.element.querySelectorAll('.' + this.CLASS_NAME_PREFIX + 'chat-message');
                historyElements.forEach(el => el.remove());
                chat.content.element.scrollTop = chat.content.element.scrollHeight;
            }
            // 外部変数の履歴もクリアしたい場合は外部で上書きすること
        };
        chat.clearBtn.element.addEventListener("click", () => chat.clearHistory());



        // chat config

        chat.onConfigSaved = (config) => {
            console.log("AI custom model: Config saved", config);
        }

        chat.setOnConfigSaved = (func) => {
            chat.onConfigSaved = func;
        }

        chat.configWindow = () => {
            console.log("config window");
            let window = this.popupWindow("Chat Settings", null, {width: '600px'});
            
            let content = document.createElement("div");
            content.classList.add(this.CLASS_NAME_PREFIX + "chat-config-container");

            // チェックボックス追加
            let checkboxContainer = document.createElement("div");
            checkboxContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-checkbox-container");
            checkboxContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-section");
            let label = document.createElement("label");
            label.textContent = "カスタムAI APIを使用する";
            label.for = "customApiCheckbox";
            checkboxContainer.appendChild(label);
            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";          
            checkbox.checked = chat.config.useCustomApi || false;
            checkbox.id = "customApiCheckbox";
            
            label.prepend(checkbox);
            content.appendChild(checkboxContainer);

            // ベースURL入力欄
            let baseUrlContainer = document.createElement("div");
            baseUrlContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-base-url-container");
            baseUrlContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-section");
            let baseUrlLabel = document.createElement("label");
            baseUrlLabel.classList.add(this.CLASS_NAME_PREFIX + "chat-config-base-url-label");
            baseUrlLabel.textContent = "ベースURL:";
            baseUrlLabel.for = "baseUrlInput";
            baseUrlContainer.appendChild(baseUrlLabel);
            let baseUrlInput = document.createElement("input");
            baseUrlInput.classList.add(this.CLASS_NAME_PREFIX + "chat-config-base-url-input");
            baseUrlInput.type = "text";
            baseUrlInput.id = "baseUrlInput";
            baseUrlInput.placeholder = "https://api.example.com/v1";
            baseUrlInput.value = chat.config.customApiUrl || "";
            baseUrlInput.autocomplete = "new-password";
            baseUrlInput.name = "baseurl";
            baseUrlInput.setAttribute("data-form-type", "other");
            baseUrlInput.setAttribute("data-lpignore", "true");
            baseUrlInput.setAttribute("data-1p-ignore", "true");
            baseUrlContainer.appendChild(baseUrlInput);
            content.appendChild(baseUrlContainer);

            // APIキー入力欄
            let apiKeyContainer = document.createElement("div");
            apiKeyContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-api-key-container");
            apiKeyContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-section");
            let apiKeyLabel = document.createElement("label");
            apiKeyLabel.classList.add(this.CLASS_NAME_PREFIX + "chat-config-api-key-label");
            apiKeyLabel.textContent = "APIキー:";
            apiKeyLabel.for = "apiKeyInput";
            apiKeyContainer.appendChild(apiKeyLabel);
            
            // 入力欄とトグルボタンのラッパー
            let apiKeyInputWrapper = document.createElement("div");
            apiKeyInputWrapper.style.position = "relative";
            apiKeyInputWrapper.style.display = "flex";
            apiKeyInputWrapper.style.alignItems = "center";
            
            let apiKeyInput = document.createElement("input");
            apiKeyInput.classList.add(this.CLASS_NAME_PREFIX + "chat-config-api-key-input");
            apiKeyInput.type = "password";
            apiKeyInput.id = "apiKeyInput";
            apiKeyInput.placeholder = "sk-xxxxxx";
            apiKeyInput.name = "apikey";
            apiKeyInput.value = chat.config.customApiKey || "";
            apiKeyInput.style.flex = "1";
            apiKeyInput.style.paddingRight = "40px"; // トグルボタン用のスペース
            // ブラウザのパスワードマネージャーによる誤認識を防ぐ
            apiKeyInput.autocomplete = "new-password";
            apiKeyInput.setAttribute("data-form-type", "other");
            apiKeyInput.setAttribute("data-lpignore", "true"); // LastPass対策
            apiKeyInput.setAttribute("data-1p-ignore", "true"); // 1Password対策
            
            // 表示/非表示トグルボタン
            let toggleButton = document.createElement("button");
            toggleButton.type = "button";
            toggleButton.classList.add(this.CLASS_NAME_PREFIX + "chat-config-api-key-toggle");
            
            // SVGアイコン: 目（表示用）
            const eyeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
            
            // SVGアイコン: 目に斜線（非表示用）
            const eyeOffIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>`;
            
            toggleButton.innerHTML = eyeIcon;
            toggleButton.style.position = "absolute";
            toggleButton.style.right = "8px";
            toggleButton.style.border = "none";
            toggleButton.style.background = "transparent";
            toggleButton.style.cursor = "pointer";
            toggleButton.style.padding = "4px 8px";
            toggleButton.style.opacity = "0.6";
            toggleButton.style.display = "flex";
            toggleButton.style.alignItems = "center";
            toggleButton.style.justifyContent = "center";
            toggleButton.title = "表示/非表示を切り替え";
            
            toggleButton.addEventListener("click", (e) => {
                e.preventDefault();
                if (apiKeyInput.type === "password") {
                    apiKeyInput.type = "text";
                    toggleButton.innerHTML = eyeOffIcon;
                    toggleButton.style.opacity = "1";
                } else {
                    apiKeyInput.type = "password";
                    toggleButton.innerHTML = eyeIcon;
                    toggleButton.style.opacity = "0.6";
                }
            });
            
            toggleButton.addEventListener("mouseenter", () => {
                toggleButton.style.opacity = "1";
            });
            
            toggleButton.addEventListener("mouseleave", () => {
                if (apiKeyInput.type === "password") {
                    toggleButton.style.opacity = "0.6";
                }
            });
            
            apiKeyInputWrapper.appendChild(apiKeyInput);
            apiKeyInputWrapper.appendChild(toggleButton);
            apiKeyContainer.appendChild(apiKeyInputWrapper);
            content.appendChild(apiKeyContainer);

            // 説明
            let description = document.createElement("div");
            description.classList.add(this.CLASS_NAME_PREFIX + "chat-config-description");
            description.classList.add(this.CLASS_NAME_PREFIX + "chat-config-section");
            description.innerHTML = `
                <p>OpenAI形式のAPIを提供するAIを使用することができます。<br>
                APIのURL及び有効なAPIキーを入力してください。</p>
            `;
            content.appendChild(description);

            // ボタン
            let buttonContainer = document.createElement("div");
            buttonContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-button-container");
            buttonContainer.classList.add(this.CLASS_NAME_PREFIX + "chat-config-section");
            let saveButton = document.createElement("button");
            saveButton.classList.add(this.CLASS_NAME_PREFIX + "chat-config-save-button");
            saveButton.textContent = "保存";
            saveButton.addEventListener("click", () => {
                // 保存処理
                chat.onConfigSaved({
                    useCustomApi: checkbox.checked,
                    baseUrl: baseUrlInput.value,
                    apiKey: apiKeyInput.value
                });
                console.log("AI custom model: Saved");
                window.remove();
            });
            buttonContainer.appendChild(saveButton);
            let cancelButton = document.createElement("button");
            cancelButton.classList.add(this.CLASS_NAME_PREFIX + "chat-config-cancel-button");
            cancelButton.textContent = "キャンセル";
            cancelButton.addEventListener("click", () => {
                window.remove();
            });
            buttonContainer.appendChild(cancelButton);
            content.appendChild(buttonContainer);

            checkbox.addEventListener("change", (e) => {
                if (e.target.checked) {
                    baseUrlInput.disabled = false;
                    apiKeyInput.disabled = false;
                } else {
                    baseUrlInput.disabled = true;
                    apiKeyInput.disabled = true;
                }
            });
            if (!chat.config.useCustomApi) {
                // 初期状態でオフなら入力欄を無効化
                // (changeイベントは発火しないためここで設定)
                baseUrlInput.disabled = true;
                apiKeyInput.disabled = true;
            }

            window.setContent(content);
        }

        chat.openConfigWindow = function() {
            console.log("Open config window");
            chat.configWindow();

        }

        chat.configButton = {};
        chat.configButton.element = document.createElement("button");
        chat.configButton.element.className = this.CLASS_NAME_PREFIX + "chat-config-button";
        chat.configButton.element.innerHTML = "⚙";
        chat.configButton.element.title = "設定";
        chat.topMenu.element.appendChild(chat.configButton.element);
        chat.configButton.element.addEventListener("click", () => chat.openConfigWindow());

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
                applyBtn.innerHTML = 'コードに適用(試験運用中)';
                
                
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


        // 背景メッセージ
        chat.backgroundMessage = document.createElement("div");
        chat.backgroundMessage.className = this.CLASS_NAME_PREFIX + "chat-background-message";
        chat.backgroundMessage.innerHTML = "ここにチャット履歴が表示されます。";
        chat.content.element.appendChild(chat.backgroundMessage);

        // メッセージがある場合は背景メッセージを非表示にする
        const observer = new MutationObserver(() => {
            if (chat.content.element.querySelectorAll('.' + this.CLASS_NAME_PREFIX + 'chat-message').length > 0) {
                chat.backgroundMessage.style.display = "none";
            } else {
                chat.backgroundMessage.style.display = "";
            }
        });
        observer.observe(chat.content.element, { childList: true });

        // バックグラウンドメッセージ変更メソッド
        chat.setBackgroundMessage = (msg) => {
            chat.backgroundMessage.innerHTML = msg;
        };
        chat.addBackgroundMessage = (msg) => {
            chat.backgroundMessage.innerHTML += msg;
        };




        chat.setTitle = (title) => {
            chat.topMenu.title.element.innerHTML = title;
        };

        /**
         * Show this chat component by opening its parent panel and tab
         * チャットが配置されているパネルとタブを自動的に開く
         */
        chat.show = () => {
            this.showComponent(chat);
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






    // Web previewer component
    webPreviewer(parentObj, url="about:blank", opt={}) {
        const previewer = {};
        previewer.element = document.createElement("div");
        previewer.element.classList.add(this.CLASS_NAME_PREFIX + "web-previewer");
        if (parentObj && parentObj.element) {
            parentObj.element.appendChild(previewer.element);
        }

        previewer.menu = {}
        previewer.menu.element = document.createElement("div");
        previewer.menu.element.classList.add(this.CLASS_NAME_PREFIX + "web-previewer-menu");
        previewer.element.appendChild(previewer.menu.element);

        previewer.title = {};
        previewer.title.element = document.createElement("div");
        previewer.title.element.classList.add(this.CLASS_NAME_PREFIX + "web-previewer-title");
        previewer.title.element.innerHTML = "Web Previewer";
        previewer.menu.element.appendChild(previewer.title.element);

        // リロードボタン
        previewer.reloadBtn = {};
        previewer.reloadBtn.element = document.createElement("button");
        previewer.reloadBtn.element.classList.add(this.CLASS_NAME_PREFIX + "web-previewer-reload-btn");
        previewer.reloadBtn.element.innerHTML = "表示中のファイルを再実行";
        previewer.reloadBtn.element.title = "このファイルを再度実行";
        previewer.reloadBtn.element.addEventListener("click", async () => {
            // onReloadコールバックが設定されている場合は実行
            if (previewer.onReload) {
                await previewer.onReload();
            } else {
                // デフォルトはiframeのリロードのみ
                previewer.reload();
            }
        });
        previewer.menu.element.appendChild(previewer.reloadBtn.element);

        previewer.iframe = document.createElement("iframe");
        previewer.iframe.classList.add(this.CLASS_NAME_PREFIX + "web-previewer-iframe");
        previewer.iframe.src = url;
        previewer.element.appendChild(previewer.iframe);

        // オプション処理

        // Methods
        previewer.setURL = (newUrl) => {
            previewer.iframe.src = newUrl;
        };
        previewer.getURL = () => {
            return previewer.iframe.src;
        };
        previewer.reload = () => {
            previewer.iframe.contentWindow.location.reload();
        };
        previewer.setTitle = (title) => {
            previewer.title.element.innerHTML = title;
        };
        previewer.show = () => {
            this.showComponent(previewer);
        }

        return previewer;
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
        contents=[{text: "Menu1", title: "desc", clickAction: (e) => {console.log("menu1");}}],
        opt={}
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
        if (opt.pos && Array.isArray(opt.pos) && opt.pos.length === 2) {
            //console.log("popup menu at specified position:", opt.pos);
            let posX = opt.pos[0];
            let posY = opt.pos[1];
            
            // 一旦位置を設定してメニューのサイズを取得
            menu.element.style.top = posY + "px";
            menu.element.style.left = posX + "px";
            
            // メニューのサイズを取得
            const menuRect = menu.element.getBoundingClientRect();
            const pageRect = this.page.element.getBoundingClientRect();
            
            // 右端からはみ出る場合は左にずらす
            if (menuRect.right > pageRect.right) {
                posX = pageRect.right - menuRect.width;
            }
            // 左端からはみ出る場合は右にずらす
            if (posX < pageRect.left) {
                posX = pageRect.left;
            }
            
            // 下端からはみ出る場合は上にずらす
            if (menuRect.bottom > pageRect.bottom) {
                posY = pageRect.bottom - menuRect.height;
            }
            // 上端からはみ出る場合は下にずらす
            if (posY < pageRect.top) {
                posY = pageRect.top;
            }
            
            // 調整後の位置を設定
            menu.element.style.top = posY + "px";
            menu.element.style.left = posX + "px";
        }
        else {
            if(parentObj.element.getBoundingClientRect().bottom + menu.element.clientHeight > this.page.element.getBoundingClientRect().bottom){
                menu.element.style.top = parentObj.element.getBoundingClientRect().bottom - menu.element.clientHeight + "px";
            }
            else{
                menu.element.style.top = parentObj.element.getBoundingClientRect().top + window.scrollY + "px";
            }
            menu.element.style.left = parentObj.element.getBoundingClientRect().right + window.scrollX + "px";
        }

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

    popupWindow(title="", contents=null, opt={}) {
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

        // set width
        if(opt.width){
            // opt.widthが数字の場合はpxとみなす
            if(typeof opt.width === "number"){
                pWindow.element.style.width = opt.width + "px";
            }
            // opt.widthが"100px"、"10em"、"50%"のような文字列の場合はそのまま適用する
            let reg = /^\d+(px|em|rem|%)$/;
            if(typeof opt.width === "string" && reg.test(opt.width)){
                pWindow.element.style.width = opt.width;
            }
        }
        // set height
        if(opt.height){
            // opt.heightが数字の場合はpxとみなす
            if(typeof opt.height === "number"){
                pWindow.element.style.height = opt.height + "px";
            }
            // opt.heightが"100px"、"10em"、"50%"のような文字列の場合はそのまま適用する
            let reg = /^\d+(px|em|rem|%)$/;
            if(typeof opt.height === "string" && reg.test(opt.height)){
                pWindow.element.style.height = opt.height;
            }
        }

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
        if(!contents){
            console.warn("popupWindow contents is null");
        }
        else if(Array.isArray(contents)){
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

        pWindow.setContent = (contents) => {
            pWindowContent.element.innerHTML = "";
            if(contents instanceof HTMLElement){
                pWindowContent.element.appendChild(contents);
            }
            else if(contents.element instanceof HTMLElement){
                pWindowContent.element.appendChild(contents.element);
            }
            else{
                console.error("contents must be an HTMLElement or an object with an 'element' property");
            }
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


    tab(parentObj=null, opt={}){
        let container = {};
        container.element = document.createElement("div");
        container.element.classList.add(this.CLASS_NAME_PREFIX + "tab-container");
        if(parentObj && parentObj.element){
            parentObj.element.appendChild(container.element);
            // Store reference to tab container on parent object
            parentObj.tabContainer = container;
        }

        let tabBar = {};
        tabBar.element = document.createElement("div");
        tabBar.element.classList.add(this.CLASS_NAME_PREFIX + "tab-bar");
        container.element.appendChild(tabBar.element);
        container.tabBar = tabBar;

        let tabContentArea = {};
        tabContentArea.element = document.createElement("div");
        tabContentArea.element.classList.add(this.CLASS_NAME_PREFIX + "tab-content-area");
        container.element.appendChild(tabContentArea.element);
        container.tabContentArea = tabContentArea;

        container.tabs = [];
        container.activeTab = null;

        container.createTab = (...args) => {
            let tab = this.tab(...args);
            this.addTab(tab);
            return tab;
        }
        container.addTab = (tab) => {
            if(!(tab && tab.element && tab.content && tab.content.element)){
                console.error("Invalid tab object");
                return;
            }
            // タブバーにタブを追加
            let tabButton = {};
            tabButton.id = tab.id;
            tabButton.element = document.createElement("button");
            tabButton.element.classList.add(this.CLASS_NAME_PREFIX + "tab-button");
            tabButton.element.id = this.CLASS_NAME_PREFIX + "tab-button-" + tab.id;
            tabButton.element.innerHTML = tab.title;
            tabButton.element.addEventListener("click", () => {
                container.activateTab(tab.id);
            });
            container.tabBar.element.appendChild(tabButton.element);
            // タブコンテンツエリアにコンテンツを追加
            container.tabContentArea.element.appendChild(tab.content.element);
            container.tabs.push(tab);
        }
        container.removeTab = (id) => {
            let tab = container.tabs.find(t => t.id === id);
            if(!tab){
                console.error("Tab not found: " + id);
                return;
            }
            // タブを削除
            container.tabs = container.tabs.filter(t => t.id !== id);
            container.tabBar.element.removeChild(tabButton.element);
            container.tabContentArea.element.removeChild(tab.content.element);
        }
        container.activateTab = (id) => {
            let tab = container.tabs.find(t => t.id === id);
            if(!tab){
                console.error("Tab not found: " + id);
                return;
            }
            // 既存のタブをすべて非表示に
            container.tabs.forEach(t => {
                if(t.content && t.content.element){
                    t.content.element.style.display = "none";
                }
            });
            // 新しいタブを表示
            tab.content.element.style.display = "block";
            container.activeTab = tab;
            // タブボタンのスタイル更新
            let buttons = container.tabBar.element.querySelectorAll("button");
            buttons.forEach(btn => {
                if(btn.id === this.CLASS_NAME_PREFIX + "tab-button-" + tab.id){
                    btn.classList.add(this.CLASS_NAME_PREFIX + "tab-button-active");
                }
                else{
                    btn.classList.remove(this.CLASS_NAME_PREFIX + "tab-button-active");
                }
            });
        }
        container.clearTabs = () => {
            container.tabs = [];
            container.tabBar.element.innerHTML = "";
            container.tabContentArea.element.innerHTML = "";
            container.activeTab = null;
        }

        container.hideTab = (id) => {
            let tab = container.tabs.find(t => t.id === id);
            if(!tab){
                console.error("Tab not found: " + id);
                return;
            }
            tab.hide();
            // タブボタンを非表示にする
            let tabButton = container.tabBar.element.querySelector("#" + this.CLASS_NAME_PREFIX + "tab-button-" + id);
            if(tabButton){
                tabButton.style.display = "none";
            }
            // もし非表示にしたタブがアクティブタブなら、他のタブをアクティブにする
            if(container.activeTab && container.activeTab.id === id){
                let otherTab = container.tabs.find(t => t.id !== id);
                if(otherTab){
                    container.activateTab(otherTab.id);
                }
                else{
                    container.activeTab = null;
                }
            }
        }

        container.showTab = (id) => {
            let tab = container.tabs.find(t => t.id === id);
            if(!tab){
                console.error("Tab not found: " + id);
                return;
            }
            // タブボタンを表示する
            let tabButton = container.tabBar.element.querySelector("#" + this.CLASS_NAME_PREFIX + "tab-button-" + id);
            if(tabButton){
                tabButton.style.display = "inline-block";
            }
            tab.show();
            container.activateTab(id);
        }

        // 最初のタブをアクティブにする
        if(container.tabs.length > 0){
            container.activateTab(container.tabs[0].id);
        }

        container.show = () => {
            this.showComponent(container);
        }


        // tab object
        container.createTab = (title="", opt={}) => {
            let tab = {};
            tab.element = document.createElement("div");
            tab.element.classList.add(this.CLASS_NAME_PREFIX + "tab");
            tab.title = title;

            let originalID = title.replace(/\s+/g, '-').toLowerCase();
            let n = 1;
            tab.id = originalID;
            while (true) {
                let exists = false;
                for (let i = 0; i < container.tabs.length; i++) {
                    if (container.tabs[i].id === tab.id) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    break;
                }
                tab.id = originalID + "-" + n;
                n++;
            }
            
            tab.content = {};
            tab.content.element = document.createElement("div");
            tab.content.element.classList.add(this.CLASS_NAME_PREFIX + "tab-content");
            tab.element.appendChild(tab.content.element);

            container.addTab(tab);
            
            // 最初は非表示
            tab.content.element.style.display = "none";

            // コンテンツ設定メソッド

            tab.setContent = (content) => {
                if(content instanceof HTMLElement){
                    tab.content.element.innerHTML = "";
                    tab.content.element.appendChild(content);
                }
                else if(typeof content === "string"){
                    tab.content.element.innerHTML = content;
                }
                // MEditorのUIコンポーネントオブジェクトの場合
                else if(content && content.element && content.element instanceof HTMLElement){
                    tab.content.element.innerHTML = "";
                    tab.content.element.appendChild(content.element);
                }
                else{
                    console.error("Invalid content type");
                }
            }

            tab.addContent = (content) => {
                if(content instanceof HTMLElement){
                    tab.content.element.appendChild(content);
                }
                else if(typeof content === "string"){
                    let div = document.createElement("div");
                    div.innerHTML = content;
                    tab.content.element.appendChild(div);
                }
                // MEditorのUIコンポーネントオブジェクトの場合
                else if(content && content.element && content.element instanceof HTMLElement){
                    tab.content.element.appendChild(content.element);
                }
                else{
                    console.error("Invalid content type");
                }
            }

            tab.hide = () => {
                tab.content.element.style.display = "none";
            }

            tab.show = () => {
                container.activateTab(tab.id);
            }

            tab.remove = () => {
                container.removeTab(tab.id);
            }


            return tab;
        }


        return container;
    }

}












