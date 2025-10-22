/**
 * File Editor Tool for AI
 * 
 * AIがファイルを編集するためのツールモジュール
 * OpenAI Function Calling形式に対応
 */

import { api } from '../../utils/api.js';
import { loadExplorer } from '../../core/file-manager.js';
import { AceWrapper } from '../../../../MEditor/MEditor.js';
import { hideAllPreviewer } from '../../utils/helpers.js';

/**
 * 相対パスをベースディレクトリと結合して絶対パスにする
 * @param {string} filePath - ファイルパス（相対または絶対）
 * @param {string} baseDir - ベースディレクトリ
 * @returns {string} - 結合された絶対パス
 */
function resolveFilePath(filePath, baseDir) {
    // 既に絶対パスの場合はそのまま返す
    if (filePath.startsWith('/')) {
        return filePath;
    }
    
    // baseDirが設定されていない場合は相対パスをそのまま返す
    if (!baseDir) {
        return filePath;
    }
    
    // baseDirの末尾のスラッシュを削除
    const normalizedBase = baseDir.replace(/\/$/, '');
    
    // 相対パスの先頭のスラッシュを削除
    const normalizedFile = filePath.replace(/^\/+/, '');
    
    // 結合
    return `${normalizedBase}/${normalizedFile}`;
}

/**
 * ファイルパスが現在のベースディレクトリ配下にあるか検証
 * @param {string} filePath - 検証するファイルパス（絶対パス）
 * @param {string} baseDir - ベースディレクトリ
 * @returns {boolean} - 許可された範囲内であればtrue
 */
function validateFilePath(filePath, baseDir) {
    if (!baseDir) {
        console.warn('Base directory not provided, allowing all paths');
        return true; // ベースディレクトリが設定されていない場合は制限なし
    }
    
    // パスを正規化（../ などの相対パスを解決）
    const normalizePathForComparison = (path) => {
        // 先頭の / を削除して正規化
        const cleaned = path.replace(/^\/+/, '');
        // 連続する / を単一に
        const normalized = cleaned.replace(/\/+/g, '/');
        // 末尾の / を削除
        return normalized.replace(/\/$/, '');
    };
    
    const normalizedBase = normalizePathForComparison(baseDir);
    const normalizedFile = normalizePathForComparison(filePath);
    
    // ファイルパスがベースディレクトリで始まるかチェック
    if (!normalizedFile.startsWith(normalizedBase)) {
        console.error('Path validation failed:', {
            filePath: normalizedFile,
            baseDir: normalizedBase,
            reason: 'File path is outside base directory'
        });
        return false;
    }
    
    // パストラバーサル攻撃を防ぐ（../ を含むパスを拒否）
    if (filePath.includes('..')) {
        console.error('Path validation failed:', {
            filePath: filePath,
            reason: 'Path traversal attempt detected'
        });
        return false;
    }
    
    return true;
}

/**
 * ツール実行履歴をサーバーに記録
 */
async function logToolExecution(tool, parameters, status, result, approvalTime = null) {
    try {
        await api('/api/tool_history.php', {
            action: 'logToolExecution',
            tool: tool,
            parameters: parameters,
            status: status,
            result: result,
            approvalTime: approvalTime
        });
    } catch (error) {
        console.error('Failed to log tool execution:', error);
    }
}

/**
 * ユーザーにファイル編集の確認を求める
 * ファイルが開かれている場合はそのファイルオブジェクトを使用し、
 * 開かれていない場合は一時的なAceWrapperインスタンスを作成してdiffを表示
 * 
 * @param {Object} editor - MEditorインスタンス
 * @param {Object} file - 編集対象のファイルオブジェクト
 * @param {string} newContent - 新しいファイル内容
 * @param {number} startTime - 確認開始時刻（承認時間計測用）
 * @returns {Promise<Object>} - {approved: boolean, approvalTime: number|null}
 */
function showEditConfirmation(editor, file, newContent, startTime) {
    return new Promise((resolve) => {
        // 既存の全てのviewer（ace含む）を非表示にする
        hideAllPreviewer();
        
        // ファイルを使用する準備
        let fileForConfirmation = file;
        let tempAceWrapper = null;
        let tempAceDOM = null;
        const isTemporaryFile = !file || !file.aceObj || !file.aceObj.element;
        
        // ファイルが開かれていない場合は一時的なAceWrapperインスタンスを作成
        if (isTemporaryFile) {
            console.warn('ファイルがエディタで開かれていないため、一時的なAceエディタを作成します');
            
            // 既存のファイルから現在の内容を取得（APIから読み込む必要がある場合もある）
            const currentContent = (file && file.aceObj && file.aceObj.editor) 
                ? file.aceObj.editor.getValue() 
                : '';
            
            // 一時的なDOM要素を作成（エディタ領域に配置）
            tempAceDOM = document.createElement("div");
            tempAceDOM.id = "temp-ace-diff-" + Date.now();
            tempAceDOM.classList.add("viewer");
            tempAceDOM.style.width = "100%";
            tempAceDOM.style.height = "100%";
            
            // エディタ領域に追加
            if (editor.wp && editor.wp.content && editor.wp.content.element) {
                editor.wp.content.element.appendChild(tempAceDOM);
            } else {
                console.error('エディタ領域が見つかりません');
                document.body.appendChild(tempAceDOM);
            }
            
            // AceWrapperインスタンスを作成
            tempAceWrapper = new AceWrapper(tempAceDOM.id);
            
            // 初期設定を読み込み
            tempAceWrapper.loadMySettings();
            
            // テーマを適用
            if (editor.THEME === "dark") {
                tempAceWrapper.editor.setTheme("ace/theme/monokai");
            } else {
                tempAceWrapper.editor.setTheme("ace/theme/chrome");
            }
            
            tempAceWrapper.setValue(currentContent);
            tempAceWrapper.editor.setReadOnly(true);
            
            // aceを表示
            tempAceWrapper.show();
            
            fileForConfirmation = {
                path: file?.path || 'unnamed',
                name: file?.name || 'unnamed',
                aceObj: tempAceWrapper,
                isDiffView: false
            };
        } else {
            // ファイルが既に開かれている場合も表示
            if (fileForConfirmation.aceObj && fileForConfirmation.aceObj.show) {
                fileForConfirmation.aceObj.show();
            }
        }
        
        // Diff表示を開始（isDiffViewフラグが自動的に設定される）
        const clearDiff = editor.showDiff(fileForConfirmation, newContent);
        
        // ファイルオブジェクトにもdiff表示中フラグをコピー
        fileForConfirmation.isDiffView = true;
        
        // 確認ダイアログを表示
        const menuContainer = tempAceDOM || document.body;
        
        // クリーンアップ関数
        const cleanup = () => {
            if (tempAceDOM && tempAceDOM.parentNode) {
                tempAceDOM.parentNode.removeChild(tempAceDOM);
            }
            if (tempAceWrapper) {
                // AceWrapperのクリーンアップ（必要に応じて）
                tempAceWrapper.editor.destroy();
            }
        };
        
        editor.diffApplyMenu(
            menuContainer,
            fileForConfirmation,
            newContent,
            // 適用ボタン
            (file, proposed) => {
                const approvalTime = (Date.now() - startTime) / 1000; // 秒単位
                
                file.isDiffView = false;
                clearDiff();
                cleanup();
                resolve({ approved: true, approvalTime });
            },
            // 拒否ボタン
            (file) => {
                file.isDiffView = false;
                clearDiff();
                cleanup();
                resolve({ approved: false, approvalTime: null });
            }
        );
    });
}

/**
 * 新規ファイル作成時のユーザー確認
 * 空のファイルと提案内容をdiffで表示
 * 
 * @param {Object} editor - MEditorインスタンス
 * @param {string} filename - ファイル名
 * @param {string} proposedContent - 提案されるファイル内容
 * @param {number} startTime - 確認開始時刻（承認時間計測用）
 * @returns {Promise<Object>} - {approved: boolean, approvalTime: number|null}
 */
function showCreateFileConfirmation(editor, filename, proposedContent, startTime) {
    return new Promise((resolve) => {
        // 既存の全てのviewer（ace含む）を非表示にする
        hideAllPreviewer();
        
        // 一時的なDOM要素を作成（エディタ領域に配置）
        const tempAceDOM = document.createElement("div");
        tempAceDOM.id = "temp-ace-create-" + Date.now();
        tempAceDOM.classList.add("viewer");
        tempAceDOM.style.width = "100%";
        tempAceDOM.style.height = "100%";
        
        // エディタ領域に追加
        if (editor.wp && editor.wp.content && editor.wp.content.element) {
            editor.wp.content.element.appendChild(tempAceDOM);
        } else {
            console.error('エディタ領域が見つかりません');
            document.body.appendChild(tempAceDOM);
        }
        
        // AceWrapperインスタンスを作成（空のファイルとして）
        const tempAceWrapper = new AceWrapper(tempAceDOM.id);
        
        // 初期設定を読み込み
        tempAceWrapper.loadMySettings();
        
        // テーマを適用
        if (editor.THEME === "dark") {
            tempAceWrapper.editor.setTheme("ace/theme/monokai");
        } else {
            tempAceWrapper.editor.setTheme("ace/theme/chrome");
        }
        
        tempAceWrapper.setValue(''); // 空のファイル
        tempAceWrapper.editor.setReadOnly(true);
        
        // aceを表示
        tempAceWrapper.show();
        
        // 一時的なファイルオブジェクトを作成（diff表示用）
        const tempFile = {
            path: filename,
            name: filename,
            aceObj: tempAceWrapper,
            isDiffView: false
        };

        // 空のコンテンツでdiffを開始
        const clearDiff = editor.showDiff(tempFile, proposedContent);
        
        // ファイルオブジェクトにdiff表示中フラグをコピー
        tempFile.isDiffView = true;
        
        // 確認ダイアログを表示
        const menuContainer = tempAceDOM;
        
        // クリーンアップ関数
        const cleanup = () => {
            if (tempAceDOM && tempAceDOM.parentNode) {
                tempAceDOM.parentNode.removeChild(tempAceDOM);
            }
            if (tempAceWrapper) {
                tempAceWrapper.editor.destroy();
            }
        };
        
        editor.diffApplyMenu(
            menuContainer,
            tempFile,
            proposedContent,
            // 適用ボタン
            (file, proposed) => {
                const approvalTime = (Date.now() - startTime) / 1000; // 秒単位
                tempFile.isDiffView = false;
                clearDiff();
                cleanup();
                resolve({ approved: true, approvalTime });
            },
            // 拒否ボタン
            (file) => {
                tempFile.isDiffView = false;
                clearDiff();
                cleanup();
                resolve({ approved: false, approvalTime: null });
            }
        );
    });
}

/**
 * ファイルを作成
 * 
 * @param {string} filename - ファイル名
 * @param {string} content - ファイル内容
 * @param {Object} options - オプション
 * @param {boolean} options.skipConfirmation - ユーザー確認をスキップ
 * @param {Object} options.editor - MEditorインスタンス
 * @param {Object} options.mConsole - コンソールオブジェクト
 * @param {Object} options.currentFile - 現在開いているファイル
 * @returns {Promise<Object>} - {success: boolean, message: string, path: string}
 */
export async function createFile(filename, content, options = {}) {
    const startTime = Date.now();
    const { skipConfirmation = false, editor, mConsole, api: apiFunc, baseDir, appState } = options;
    
    // デバッグ: 渡されたオプションを確認
    console.log('createFile options:', { skipConfirmation, hasEditor: !!editor, hasMConsole: !!mConsole, hasApi: !!apiFunc, baseDir });
    
    try {
        // APIが渡されていない場合はエラー
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        // ファイルパスをベースディレクトリと結合
        const fullPath = resolveFilePath(filename, baseDir);
        
        // ファイルパスの検証
        if (!validateFilePath(fullPath, baseDir)) {
            const errorMsg = `アクセス拒否: ファイル "${filename}" は現在のディレクトリ配下にありません`;
            await logToolExecution('createFile', { filename, content }, 'rejected', { error: 'path_validation_failed' });
            if (mConsole) {
                mConsole.print(errorMsg, 'error');
            }
            return {
                success: false,
                error: 'path_validation_failed',
                message: errorMsg
            };
        }
        
        // ファイルが既に存在するかチェック
        // TODO: 既存ファイルチェックの実装
        
        let approved = true;
        let approvalTime = null;
        
        if (!skipConfirmation && editor) {
            // 新規ファイル作成時もdiff表示で確認
            // 空のファイルと提案内容を比較
            const emptyContent = '';
            const confirmation = await showCreateFileConfirmation(editor, filename, content, startTime);
            approved = confirmation.approved;
            approvalTime = confirmation.approvalTime;
        }
        
        if (!approved) {
            await logToolExecution('createFile', { filename, content }, 'rejected', null, approvalTime);
            return {
                success: false,
                message: 'ユーザーによってキャンセルされました'
            };
        }
        
        // ファイル作成API呼び出し（ベースディレクトリと結合したパスを使用）
        const result = await apiFunc('/api/file_manager.php', {
            action: 'create',
            path: fullPath,
            content: content
        });
        
        // デバッグ: APIレスポンスを確認
        console.log('createFile API response:', result);
        
        if (result.status === 'success') {
            // エクスプローラーをリロード
            if (editor && appState) {
                await loadExplorer(editor.BASE_DIR, apiFunc, appState, editor);
            }
            
            await logToolExecution('createFile', { filename, content }, 'approved', result, approvalTime);
            if (mConsole) {
                mConsole.print(`ファイル "${filename}" を作成しました`, 'success');
            }
            return {
                success: true,
                message: `${filename} を作成しました`,
                path: filename,
                // チャットに表示するカスタムメッセージ（オプション）
                messages: [
                    { text: `ファイル "${filename}" を作成しました`, type: 'success' }
                ]
            };
        } else {
            // エラーメッセージを詳細に記録
            const errorMsg = result.message || result.error || 'ファイル作成に失敗しました';
            console.error('createFile failed:', result);
            
            // ファイルが既に存在する場合は、AIに適切な情報を返す
            if (errorMsg.includes('既に存在') || errorMsg.includes('already exists')) {
                await logToolExecution('createFile', { filename, content }, 'error', { error: 'file_already_exists' }, approvalTime);
                if (mConsole) {
                    mConsole.print(`ファイル "${filename}" は既に存在します`, 'warning');
                }
                return {
                    success: false,
                    error: 'file_already_exists',
                    message: `ファイル "${filename}" は既に存在します。既存のファイルを編集するには、editFileByReplace または editFileByLines を使用してください。`,
                    suggestion: 'use_edit_tool',
                    filename: filename
                };
            }
            
            throw new Error(errorMsg);
        }
        
    } catch (error) {
        await logToolExecution('createFile', { filename, content }, 'error', { error: error.message });
        if (mConsole) {
            mConsole.print(`エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * ファイルを読み込み
 */
export async function readFile(filename, options = {}) {
    const { api: apiFunc, mConsole, baseDir } = options;
    
    try {
        // APIが渡されていない場合はエラー
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        // ファイルパスをベースディレクトリと結合
        const fullPath = resolveFilePath(filename, baseDir);
        
        // ファイルパスの検証
        if (!validateFilePath(fullPath, baseDir)) {
            const errorMsg = `アクセス拒否: ファイル "${filename}" は現在のディレクトリ配下にありません`;
            await logToolExecution('readFile', { filename }, 'rejected', { error: 'path_validation_failed' });
            if (mConsole) {
                mConsole.print(errorMsg, 'error');
            }
            return {
                success: false,
                error: 'path_validation_failed',
                message: errorMsg
            };
        }
        
        const result = await apiFunc('/api/file_manager.php', {
            action: 'read',
            path: fullPath
        });
        
        // デバッグ: APIレスポンスを確認
        console.log('readFile API response:', { status: result.status, contentLength: result.content?.length });
        
        await logToolExecution('readFile', { filename }, 'success', { length: result.content?.length });
        
        if (result.status === 'success') {
            return {
                success: true,
                content: result.content,
                path: filename,
                message: `ファイル "${filename}" を読み込みました`
            };
        } else {
            const errorMsg = result.message || result.error || 'ファイル読み込みに失敗しました';
            console.error('readFile failed:', result);
            throw new Error(errorMsg);
        }
    } catch (error) {
        await logToolExecution('readFile', { filename }, 'error', { error: error.message });
        if (mConsole) {
            mConsole.print(`エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * ファイルを検索置換で編集
 */
export async function editFileByReplace(filename, searchText, replaceText, editOptions = {}, toolOptions = {}) {
    const startTime = Date.now();
    const { 
        global = true, 
        regex = false, 
        caseSensitive = true 
    } = editOptions;
    
    const { 
        skipConfirmation = false, 
        editor, 
        mConsole, 
        currentFile,
        api: apiFunc,
        baseDir
    } = toolOptions;
    
    try {
        // APIが渡されていない場合はエラー
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        // ファイルパスをベースディレクトリと結合
        const fullPath = resolveFilePath(filename, baseDir);
        
        // ファイルパスの検証
        if (!validateFilePath(fullPath, baseDir)) {
            const errorMsg = `アクセス拒否: ファイル "${filename}" は現在のディレクトリ配下にありません`;
            await logToolExecution('editFileByReplace', { filename, searchText, replaceText }, 'rejected', { error: 'path_validation_failed' });
            if (mConsole) {
                mConsole.print(errorMsg, 'error');
            }
            return {
                success: false,
                error: 'path_validation_failed',
                message: errorMsg
            };
        }
        
        // ファイル内容を取得（既に結合されたパスを使用）
        const fileContent = await readFile(filename, { api: apiFunc, baseDir });
        if (!fileContent.success) {
            throw new Error(fileContent.message);
        }
        
        const currentContent = fileContent.content;
        
        // 検索置換を実行
        let newContent;
        if (regex) {
            const flags = (global ? 'g' : '') + (caseSensitive ? '' : 'i');
            const regexPattern = new RegExp(searchText, flags);
            newContent = currentContent.replace(regexPattern, replaceText);
        } else {
            if (global) {
                const searchRegex = new RegExp(
                    searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 
                    caseSensitive ? 'g' : 'gi'
                );
                newContent = currentContent.replace(searchRegex, replaceText);
            } else {
                const index = caseSensitive 
                    ? currentContent.indexOf(searchText)
                    : currentContent.toLowerCase().indexOf(searchText.toLowerCase());
                if (index !== -1) {
                    newContent = currentContent.substring(0, index) + 
                                replaceText + 
                                currentContent.substring(index + searchText.length);
                } else {
                    newContent = currentContent;
                }
            }
        }
        
        // 変更がない場合
        if (newContent === currentContent) {
            await logToolExecution('editFileByReplace', 
                { filename, searchText, replaceText, options: editOptions }, 
                'no_change', 
                null
            );
            if (mConsole) {
                mConsole.print(`"${searchText}" が見つかりませんでした`, 'warning');
            }
            return {
                success: false,
                message: '該当するテキストが見つかりませんでした'
            };
        }
        
        let approved = true;
        let approvalTime = null;
        
        // デフォルトはユーザー確認を表示
        // skipConfirmation=true の場合のみ確認をスキップ（アプリケーション設定で制御可能）
        if (!skipConfirmation) {
            if (editor) {
                // エディタが利用可能な場合
                // ファイルが開かれているかどうかに関わらず、showEditConfirmation を呼び出し
                // ファイルが開かれていない場合は簡易確認が表示される
                const fileForConfirmation = currentFile && currentFile.path === fullPath 
                    ? currentFile 
                    : { path: fullPath, aceObj: null };  // ファイルが開かれていない場合
                
                const confirmation = await showEditConfirmation(editor, fileForConfirmation, newContent, startTime);
                approved = confirmation.approved;
                approvalTime = confirmation.approvalTime;
            } else {
                // エディタがない場合は自動承認（アプリケーション側の判断）
                console.warn('エディタが利用不可、ユーザー確認をスキップします');
                approved = true;
            }
        }
        
        if (!approved) {
            await logToolExecution('editFileByReplace', 
                { filename, searchText, replaceText, options: editOptions }, 
                'rejected', 
                null, 
                approvalTime
            );
            return {
                success: false,
                message: 'ユーザーによってキャンセルされました'
            };
        }
        
        // ファイルを保存（ベースディレクトリと結合したパスを使用）
        const saveResult = await apiFunc('/api/file_manager.php', {
            action: 'save',
            path: fullPath,
            content: newContent
        });
        
        if (saveResult.status === 'success') {
            // 現在開いているファイルが編集対象の場合、エディタにも反映
            if (currentFile && currentFile.path === fullPath && currentFile.aceObj && currentFile.aceObj.editor) {
                const currentCursorPos = currentFile.aceObj.editor.getCursorPosition();
                currentFile.aceObj.editor.setValue(newContent);
                currentFile.aceObj.editor.clearSelection();
                // カーソル位置を復元（可能な範囲で）
                try {
                    currentFile.aceObj.editor.moveCursorToPosition(currentCursorPos);
                } catch (e) {
                    // カーソル位置が範囲外の場合は無視
                }
                currentFile.changed = false;
            }
            
            await logToolExecution('editFileByReplace', 
                { filename, searchText, replaceText, options: editOptions }, 
                'approved', 
                saveResult, 
                approvalTime
            );
            if (mConsole) {
                mConsole.print(`ファイル "${filename}" を更新しました`, 'success');
            }
            
            // チャットに表示するメッセージを準備
            const messages = [
                { text: `ファイル "${filename}" を更新しました`, type: 'success' }
            ];
            
            // エディタに反映された場合は追加メッセージ
            if (currentFile && currentFile.path === fullPath) {
                messages.push({ text: `エディタの内容も更新されました`, type: 'info' });
            }
            
            return {
                success: true,
                message: `${filename} を更新しました`,
                path: filename,
                messages: messages
            };
        } else {
            throw new Error(saveResult.message || 'ファイル保存に失敗しました');
        }
        
    } catch (error) {
        await logToolExecution('editFileByReplace', 
            { filename, searchText, replaceText, options: editOptions }, 
            'error', 
            { error: error.message }
        );
        if (mConsole) {
            mConsole.print(`エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * ファイルを行ベースで編集
 */
export async function editFileByLines(filename, lineStart, lineEnd, newContent, options = {}) {
    const startTime = Date.now();
    const { 
        skipConfirmation = false, 
        editor, 
        mConsole, 
        currentFile,
        api: apiFunc,
        baseDir
    } = options;
    
    try {
        // APIが渡されていない場合はエラー
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        // ファイルパスをベースディレクトリと結合
        const fullPath = resolveFilePath(filename, baseDir);
        
        // ファイルパスの検証
        if (!validateFilePath(fullPath, baseDir)) {
            const errorMsg = `アクセス拒否: ファイル "${filename}" は現在のディレクトリ配下にありません`;
            await logToolExecution('editFileByLines', { filename, lineStart, lineEnd }, 'rejected', { error: 'path_validation_failed' });
            if (mConsole) {
                mConsole.print(errorMsg, 'error');
            }
            return {
                success: false,
                error: 'path_validation_failed',
                message: errorMsg
            };
        }
        
        // ファイル内容を取得（既に結合されたパスを使用）
        const fileContent = await readFile(filename, { api: apiFunc, baseDir });
        if (!fileContent.success) {
            throw new Error(fileContent.message);
        }
        
        const currentContent = fileContent.content;
        const lines = currentContent.split('\n');
        
        // 行番号の検証
        if (lineStart < 1 || lineEnd < lineStart || lineEnd > lines.length) {
            throw new Error(`無効な行番号: ${lineStart}-${lineEnd} (ファイルは${lines.length}行)`);
        }
        
        // 新しい内容を生成
        const newLines = newContent.split('\n');
        const updatedLines = [
            ...lines.slice(0, lineStart - 1),
            ...newLines,
            ...lines.slice(lineEnd)
        ];
        const updatedContent = updatedLines.join('\n');
        
        let approved = true;
        let approvalTime = null;
        
        // デフォルトはユーザー確認を表示
        // skipConfirmation=true の場合のみ確認をスキップ（アプリケーション設定で制御可能）
        if (!skipConfirmation) {
            if (editor) {
                // エディタが利用可能な場合
                // ファイルが開かれているかどうかに関わらず、showEditConfirmation を呼び出し
                // ファイルが開かれていない場合は簡易確認が表示される
                const fileForConfirmation = currentFile && currentFile.path === fullPath 
                    ? currentFile 
                    : { path: fullPath, aceObj: null };  // ファイルが開かれていない場合
                
                const confirmation = await showEditConfirmation(editor, fileForConfirmation, updatedContent, startTime);
                approved = confirmation.approved;
                approvalTime = confirmation.approvalTime;
            } else {
                // エディタがない場合は自動承認（アプリケーション側の判断）
                console.warn('エディタが利用不可、ユーザー確認をスキップします');
                approved = true;
            }
        }
        
        if (!approved) {
            await logToolExecution('editFileByLines', 
                { filename, lineStart, lineEnd, newContent }, 
                'rejected', 
                null, 
                approvalTime
            );
            return {
                success: false,
                message: 'ユーザーによってキャンセルされました'
            };
        }
        
        // ファイルを保存（ベースディレクトリと結合したパスを使用）
        const saveResult = await apiFunc('/api/file_manager.php', {
            action: 'save',
            path: fullPath,
            content: updatedContent
        });
        
        if (saveResult.status === 'success') {
            // 現在開いているファイルが編集対象の場合、エディタにも反映
            if (currentFile && currentFile.path === fullPath && currentFile.aceObj && currentFile.aceObj.editor) {
                const currentCursorPos = currentFile.aceObj.editor.getCursorPosition();
                currentFile.aceObj.editor.setValue(updatedContent);
                currentFile.aceObj.editor.clearSelection();
                // カーソル位置を復元（可能な範囲で）
                try {
                    currentFile.aceObj.editor.moveCursorToPosition(currentCursorPos);
                } catch (e) {
                    // カーソル位置が範囲外の場合は無視
                }
                currentFile.changed = false;
            }
            
            await logToolExecution('editFileByLines', 
                { filename, lineStart, lineEnd, newContent }, 
                'approved', 
                saveResult, 
                approvalTime
            );
            if (mConsole) {
                mConsole.print(`ファイル "${filename}" の ${lineStart}-${lineEnd} 行目を更新しました`, 'success');
            }
            
            // チャットに表示するメッセージを準備
            const messages = [
                { text: `ファイル "${filename}" の ${lineStart}-${lineEnd} 行目を更新しました`, type: 'success' }
            ];
            
            // エディタに反映された場合は追加メッセージ
            if (currentFile && currentFile.path === fullPath) {
                messages.push({ text: `エディタの内容も更新されました`, type: 'info' });
            }
            
            return {
                success: true,
                message: `${filename} を更新しました`,
                path: filename,
                messages: messages
            };
        } else {
            throw new Error(saveResult.message || 'ファイル保存に失敗しました');
        }
        
    } catch (error) {
        await logToolExecution('editFileByLines', 
            { filename, lineStart, lineEnd, newContent }, 
            'error', 
            { error: error.message }
        );
        if (mConsole) {
            mConsole.print(`エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * ファイルを削除
 */
export async function deleteFile(filename, options = {}) {
    const startTime = Date.now();
    const { skipConfirmation = false, editor, mConsole, api: apiFunc, baseDir } = options;
    
    try {
        // APIが渡されていない場合はエラー
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        // ファイルパスをベースディレクトリと結合
        const fullPath = resolveFilePath(filename, baseDir);
        
        // ファイルパスの検証
        if (!validateFilePath(fullPath, baseDir)) {
            const errorMsg = `アクセス拒否: ファイル "${filename}" は現在のディレクトリ配下にありません`;
            await logToolExecution('deleteFile', { filename }, 'rejected', { error: 'path_validation_failed' });
            if (mConsole) {
                mConsole.print(errorMsg, 'error');
            }
            return {
                success: false,
                error: 'path_validation_failed',
                message: errorMsg
            };
        }
        
        let approved = true;
        let approvalTime = null;
        
        // デフォルトはユーザー確認を表示
        // skipConfirmation=true の場合のみ確認をスキップ（アプリケーション設定で制御可能）
        if (!skipConfirmation) {
            if (editor) {
                approved = confirm(`本当にファイル "${filename}" を削除しますか？この操作は取り消せません。`);
                approvalTime = (Date.now() - startTime) / 1000;
            } else {
                // エディタがない場合は自動承認（アプリケーション側の判断）
                console.warn('エディタが利用不可、ユーザー確認をスキップします');
                approved = true;
            }
        }
        
        if (!approved) {
            await logToolExecution('deleteFile', { filename }, 'rejected', null, approvalTime);
            return {
                success: false,
                message: 'ユーザーによってキャンセルされました'
            };
        }
        
        const result = await apiFunc('/api/file_manager.php', {
            action: 'delete',
            path: fullPath
        });
        
        if (result.status === 'success') {
            await logToolExecution('deleteFile', { filename }, 'approved', result, approvalTime);
            if (mConsole) {
                mConsole.print(`ファイル "${filename}" を削除しました`, 'success');
            }
            return {
                success: true,
                message: `${filename} を削除しました`
            };
        } else {
            throw new Error(result.message || 'ファイル削除に失敗しました');
        }
        
    } catch (error) {
        await logToolExecution('deleteFile', { filename }, 'error', { error: error.message });
        if (mConsole) {
            mConsole.print(`エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * ディレクトリ内のファイル一覧を取得
 * 
 * @param {string} directory - ディレクトリパス（省略時はベースディレクトリ）
 * @param {Object} options - オプション
 * @param {string} options.baseDir - ベースディレクトリ
 * @param {Function} options.api - API関数
 * @param {Object} options.mConsole - コンソールオブジェクト
 * @returns {Promise<Object>} - {success: boolean, files: Array, directories: Array, message: string}
 */
export async function ls(directory = "", options = {}) {
    const { api: apiFunc, mConsole, baseDir } = options;
    
    try {
        // APIが渡されていない場合はエラー
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        // ディレクトリパスを決定
        let targetDir = directory;
        if (!targetDir || targetDir === "" || targetDir === ".") {
            targetDir = baseDir || "/";
        }
        
        // ファイルパスをベースディレクトリと結合
        const fullPath = resolveFilePath(targetDir, baseDir);
        
        // ファイルパスの検証
        if (!validateFilePath(fullPath, baseDir)) {
            const errorMsg = `アクセス拒否: ディレクトリ "${directory}" は現在のディレクトリ配下にありません`;
            await logToolExecution('ls', { directory }, 'rejected', { error: 'path_validation_failed' });
            if (mConsole) {
                mConsole.print(errorMsg, 'error');
            }
            return {
                success: false,
                error: 'path_validation_failed',
                message: errorMsg,
                files: [],
                directories: []
            };
        }
        
        // ディレクトリ内容を取得
        const result = await apiFunc('/api/file_manager.php', {
            action: 'list-object',
            path: fullPath
        });
        
        // デバッグ: APIレスポンスを確認
        console.log('ls API response:', result);
        
        if (result.status === 'success') {
            // ファイルとディレクトリを分類
            const files = [];
			const directories = [];

			for (const item of result.files.files) {
				if (item.type === 'dir') {
					directories.push(item.name);
				} else {
					files.push(item.name);
				}
			}

            await logToolExecution('ls', { directory }, 'success', {
                fileCount: files.length,
                dirCount: directories.length
            });
            
            // ファイル一覧をコンソールに表示
            if (mConsole && (files.length > 0 || directories.length > 0)) {
                if (directories.length > 0) {
                    mConsole.print(`[ディレクトリ]: ${directories.join(', ')}`, 'info');
                }
                if (files.length > 0) {
                    mConsole.print(`[ファイル]: ${files.join(', ')}`, 'info');
                }
            }
            
            return {
                success: true,
                files: files,
                directories: directories,
                message: `ディレクトリ "${fullPath}" 内のファイル一覧を取得しました`,
                path: fullPath
            };
        } else {
            const errorMsg = result.message || result.error || 'ディレクトリリスト取得に失敗しました';
            console.error('ls failed:', result);
            
            throw new Error(errorMsg);
        }
    } catch (error) {
        await logToolExecution('ls', { directory }, 'error', { error: error.message });
        if (mConsole) {
            mConsole.print(`エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message,
            files: [],
            directories: []
        };
    }
}