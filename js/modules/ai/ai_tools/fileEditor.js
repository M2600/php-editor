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
import { CONFIG } from '../../core/config.js';

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
async function showEditConfirmation(editor, file, newContent, startTime) {
    // 確認ダイアログ表示フラグを設定
    const { APP_STATE } = await import('../../core/config.js');
    APP_STATE.IS_SHOWING_EDIT_CONFIRMATION = true;
    
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
        
        const menu = editor.diffApplyMenu(
            menuContainer,
            fileForConfirmation,
            newContent,
            // 適用ボタン
            (file, proposed) => {
                const approvalTime = (Date.now() - startTime) / 1000; // 秒単位
                
                file.isDiffView = false;
                clearDiff();
                cleanup();
                APP_STATE.IS_SHOWING_EDIT_CONFIRMATION = false; // フラグをクリア
                resolve({ approved: true, approvalTime });
            },
            // 拒否ボタン
            (file) => {
                file.isDiffView = false;
                clearDiff();
                cleanup();
                APP_STATE.IS_SHOWING_EDIT_CONFIRMATION = false; // フラグをクリア
                resolve({ approved: false, approvalTime: null });
            }
        );
        
        // メッセージ要素を取得してファイル名を含むメッセージに書き換え
        if (menu && menu.element) {
            const msgElement = menu.element.querySelector('.' + editor.CLASS_NAME_PREFIX + 'diff-apply-menu-msg');
            if (msgElement) {
                const fileName = file?.name || file?.path || 'unnamed';
                msgElement.textContent = `"${fileName}" への変更を適用しますか？`;
            }
        }
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
async function showCreateFileConfirmation(editor, filename, proposedContent, startTime) {
    // 確認ダイアログ表示フラグを設定
    const { APP_STATE } = await import('../../core/config.js');
    APP_STATE.IS_SHOWING_EDIT_CONFIRMATION = true;
    
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
        
        const menu = editor.diffApplyMenu(
            menuContainer,
            tempFile,
            proposedContent,
            // 適用ボタン
            (file, proposed) => {
                const approvalTime = (Date.now() - startTime) / 1000; // 秒単位
                tempFile.isDiffView = false;
                clearDiff();
                cleanup();
                APP_STATE.IS_SHOWING_EDIT_CONFIRMATION = false; // フラグをクリア
                resolve({ approved: true, approvalTime });
            },
            // 拒否ボタン
            (file) => {
                tempFile.isDiffView = false;
                clearDiff();
                cleanup();
                APP_STATE.IS_SHOWING_EDIT_CONFIRMATION = false; // フラグをクリア
                resolve({ approved: false, approvalTime: null });
            }
        );
        
        // メッセージ要素を取得してファイル名を含むメッセージに書き換え
        if (menu && menu.element) {
            const msgElement = menu.element.querySelector('.' + editor.CLASS_NAME_PREFIX + 'diff-apply-menu-msg');
            if (msgElement) {
                msgElement.textContent = `"${filename}" を作成しますか？`;
            }
        }
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
        
        if (result.status === 'success') {
            // エクスプローラーをリロード
            if (editor && appState) {
                await loadExplorer(editor.BASE_DIR, apiFunc, appState, editor);
                
                // 少し待ってからファイルを開く（リロード完了を待つ）
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // ファイルリストから作成したファイルを検索して開く
                // FILE_LIST.files は配列なので、pathで検索
                const createdFile = appState.FILE_LIST?.files?.find(f => f.path === fullPath);
                
                if (createdFile && createdFile.type === 'text') {
                    // すべてのviewerを非表示にしてからファイルを開く
                    hideAllPreviewer();
                    
                    // openFile関数をインポートして実行
                    const { openFile } = await import('../../editor/ace-editor.js');
                    const openedFile = await openFile(
                        createdFile,
                        appState.ACE_LIST,
                        editor,
                        editor.mConsole || mConsole,
                        CONFIG.EXT_LANG,
                        false, // DEBUG
                        (aceEditor) => {}, // aceKeybinds
                        apiFunc
                    );
                    
                    // CURRENT_FILEを更新
                    appState.CURRENT_FILE = openedFile || createdFile;
                    
                    // エディタ要素の表示状態を確認・修正
                    if (openedFile && openedFile.aceObj) {
                        const aceElement = openedFile.aceObj.element;
                        
                        // 明示的に表示
                        if (aceElement) {
                            aceElement.style.display = '';
                            openedFile.aceObj.show();
                            openedFile.aceObj.focus();
                        }
                    }
                    
                    // エクスプローラーのハイライトを更新
                    if (editor.explorer && typeof editor.explorer.highlightFile === 'function') {
                        console.log('[createFile] Highlighting file:', fullPath, 'Element exists:', !!document.getElementById(fullPath));
                        editor.explorer.highlightFile(fullPath);
                    }
                }
            }
            
            await logToolExecution('createFile', { filename, content }, 'approved', result, approvalTime);
            if (mConsole) {
                const lines = content.split('\n').length;
                mConsole.print(`✅ createFile: "${filename}" を作成 (${lines}行, ${content.length}文字)`, 'success');
            }
            const lines = content.split('\n').length;
            return {
                success: true,
                message: `✅ ${filename}(${lines}行)`,
                path: filename
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
                    message: `ファイル "${filename}" は既に存在します。`,
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
 * ファイルを読み込み（行範囲制限対応）
 */
export async function readFile(filename, options = {}) {
    const { 
        api: apiFunc, 
        mConsole, 
        baseDir,
        startLine = null,
        endLine = null,
        maxLines = 100
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
        
        // ファイル全体を読み込み
        const result = await apiFunc('/api/file_manager.php', {
            action: 'read',
            path: fullPath
        });
        
        if (result.status !== 'success') {
            const errorMsg = result.message || result.error || 'ファイル読み込みに失敗しました';
            console.error('readFile failed:', result);
            throw new Error(errorMsg);
        }
        
        const fullContent = result.content;
        const lines = fullContent.split('\n');
        const totalLines = lines.length;
        
        // 行範囲が指定されている場合
        if (startLine !== null || endLine !== null) {
            const start = Math.max(1, startLine || 1);
            const end = Math.min(totalLines, endLine || totalLines);
            
            if (start > totalLines) {
                return {
                    success: false,
                    message: `指定された開始行 ${start} がファイルの総行数 ${totalLines} を超えています`
                };
            }
            
            // 指定範囲を抽出（1-indexed → 0-indexed）
            const selectedLines = lines.slice(start - 1, end);
            const content = selectedLines.join('\n');
            
            await logToolExecution('readFile', { filename, startLine: start, endLine: end }, 'success', { 
                length: content.length,
                linesRead: selectedLines.length 
            });
            
            if (mConsole) {
                mConsole.print(`✅ readFile: "${filename}" (${start}〜${end} / ${totalLines})`, 'info');
            }
            
            return {
                success: true,
                content: content,
                path: filename,
                lineRange: { start, end, total: totalLines },
                message: `✅ ${filename} (${start}〜${end} / ${totalLines})`
            };
        }
        
        // 行範囲が指定されていない場合: maxLines制限をチェック
        if (totalLines > maxLines) {
            // ファイルが大きい場合は構造要約を返す
            const structure = extractCodeStructure(fullContent, filename);
            
            await logToolExecution('readFile', { filename }, 'success', { 
                totalLines,
                compressed: true,
                structureOnly: true
            });
            
            if (mConsole) {
                mConsole.print(`✅ readFile: "${filename}" (${totalLines}) → 構造要約のみ (${structure.summary})`, 'info');
            }
            
            return {
                success: true,
                compressed: true,
                structureOnly: true,
                structure: structure,
                totalLines: totalLines,
                path: filename,
                message: `✅ ${filename} (${totalLines})`,
                hint: `特定の部分を読むには: readFile(filename="${filename}", startLine=1, endLine=100)`
            };
        }
        
        // ファイルが小さい場合は全体を返す
        await logToolExecution('readFile', { filename }, 'success', { length: fullContent.length });
        
        if (mConsole) {
            mConsole.print(`✅ readFile: "${filename}" (${totalLines}`, 'info');
        }
        
        return {
            success: true,
            content: fullContent,
            path: filename,
            totalLines: totalLines,
            message: `✅ ${filename} (${totalLines})`
        };
        
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
        baseDir,
        appState
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
                
                // ファイルを表示
                hideAllPreviewer();
                if (currentFile.aceObj && currentFile.aceObj.show) {
                    currentFile.aceObj.show();
                    currentFile.aceObj.focus();
                }
                
                // エクスプローラーのハイライトを更新
                if (editor && editor.explorer && typeof editor.explorer.highlightFile === 'function') {
                    console.log('[editFileByReplace] Highlighting file:', currentFile.path, 'Element exists:', !!document.getElementById(currentFile.path));
                    editor.explorer.highlightFile(currentFile.path);
                }
            } else if (editor && appState) {
                // ファイルが開かれていない場合は開く
                // FILE_LIST.files は配列なので、pathで検索
                const editedFile = appState.FILE_LIST?.files?.find(f => f.path === fullPath);
                if (editedFile && editedFile.type === 'text') {
                    // すべてのviewerを非表示にしてからファイルを開く
                    hideAllPreviewer();
                    
                    const { openFile } = await import('../../editor/ace-editor.js');
                    const openedFile = await openFile(
                        editedFile,
                        appState.ACE_LIST,
                        editor,
                        editor.mConsole || mConsole,
                        CONFIG.EXT_LANG,
                        false, // DEBUG
                        (aceEditor) => {}, // aceKeybinds
                        apiFunc
                    );
                    
                    // CURRENT_FILEを更新
                    appState.CURRENT_FILE = openedFile || editedFile;
                    
                    // エディタ要素の表示状態を確認・修正
                    if (openedFile && openedFile.aceObj) {
                        const aceElement = openedFile.aceObj.element;
                        
                        // 明示的に表示
                        if (aceElement) {
                            aceElement.style.display = '';
                            openedFile.aceObj.show();
                            openedFile.aceObj.focus();
                        }
                    }
                    
                    // エクスプローラーのハイライトを更新
                    if (editor.explorer && typeof editor.explorer.highlightFile === 'function') {
                        console.log('[editFileByReplace] Highlighting newly opened file:', fullPath, 'Element exists:', !!document.getElementById(fullPath));
                        editor.explorer.highlightFile(fullPath);
                    }
                }
            }
            
            await logToolExecution('editFileByReplace', 
                { filename, searchText, replaceText, options: editOptions }, 
                'approved', 
                saveResult, 
                approvalTime
            );
            if (mConsole) {
                const replacements = (newContent.match(new RegExp(replaceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                mConsole.print(`✅ editFileByReplace: "${filename}" を更新 (${replacements}箇所置換)`, 'success');
            }
            
            // 置換箇所数をカウント
            const oldMatches = (currentContent.match(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            const replacements = oldMatches;
            
            return {
                success: true,
                message: `✅ ${filename}:${replacements}`,
                path: filename
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
        baseDir,
        appState
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
                
                // ファイルを表示
                hideAllPreviewer();
                if (currentFile.aceObj && currentFile.aceObj.show) {
                    currentFile.aceObj.show();
                    currentFile.aceObj.focus();
                }
                
                // エクスプローラーのハイライトを更新
                if (editor && editor.explorer && typeof editor.explorer.highlightFile === 'function') {
                    console.log('[editFileByLines] Highlighting file:', currentFile.path, 'Element exists:', !!document.getElementById(currentFile.path));
                    editor.explorer.highlightFile(currentFile.path);
                }
            } else if (editor && appState) {
                // ファイルが開かれていない場合は開く
                // エクスプローラーをリロードしてFILE_LISTを更新
                await loadExplorer(editor.BASE_DIR, apiFunc, appState, editor);
                
                // 少し待ってからファイルを開く（リロード完了を待つ）
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // FILE_LIST.files は配列なので、pathで検索
                const editedFile = appState.FILE_LIST?.files?.find(f => f.path === fullPath);
                if (editedFile && editedFile.type === 'text') {
                    // すべてのviewerを非表示にしてからファイルを開く
                    hideAllPreviewer();
                    
                    const { openFile } = await import('../../editor/ace-editor.js');
                    const openedFile = await openFile(
                        editedFile,
                        appState.ACE_LIST,
                        editor,
                        editor.mConsole || mConsole,
                        CONFIG.EXT_LANG,
                        false, // DEBUG
                        (aceEditor) => {}, // aceKeybinds
                        apiFunc
                    );
                    
                    // CURRENT_FILEを更新
                    appState.CURRENT_FILE = openedFile || editedFile;
                    
                    // エディタ要素の表示状態を確認・修正
                    if (openedFile && openedFile.aceObj) {
                        const aceElement = openedFile.aceObj.element;
                        
                        // 明示的に表示
                        if (aceElement) {
                            aceElement.style.display = '';
                            openedFile.aceObj.show();
                            openedFile.aceObj.focus();
                        }
                    }
                    
                    // エクスプローラーのハイライトを更新
                    if (editor.explorer && typeof editor.explorer.highlightFile === 'function') {
                        console.log('[editFileByLines] Highlighting newly opened file:', fullPath, 'Element exists:', !!document.getElementById(fullPath));
                        editor.explorer.highlightFile(fullPath);
                    }
                }
            }
            
            await logToolExecution('editFileByLines', 
                { filename, lineStart, lineEnd, newContent }, 
                'approved', 
                saveResult, 
                approvalTime
            );
            if (mConsole) {
                const oldLineCount = lineEnd - lineStart + 1;
                const newLineCount = newContent.split('\n').length;
                mConsole.print(`✅ editFileByLines: "${filename}" (${lineStart}〜${lineEnd}行目) ${oldLineCount}行 → ${newLineCount}行`, 'success');
            }
            
            const oldLineCount = lineEnd - lineStart + 1;
            const newLineCount = newContent.split('\n').length;
            
            return {
                success: true,
                message: `✅ ${filename} (${lineStart}〜${lineEnd})`,
                path: filename
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
            // エクスプローラーをリロード
            if (editor && options.appState) {
                await loadExplorer(editor.BASE_DIR, apiFunc, options.appState, editor);
            }
            
            await logToolExecution('deleteFile', { filename }, 'approved', result, approvalTime);
            if (mConsole) {
                mConsole.print(`🗑️ deleteFile: "${filename}" を削除`, 'success');
            }
            return {
                success: true,
                message: `🗑️ **${filename}** を削除しました`
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
            if (mConsole) {
                mConsole.print(`✅ ls: "${fullPath}" (${directories.length}個のディレクトリ, ${files.length}個のファイル)`, 'info');
                if (directories.length > 0 && directories.length <= 10) {
                    mConsole.print(`  [ディレクトリ]: ${directories.join(', ')}`, 'info');
                } else if (directories.length > 10) {
                    mConsole.print(`  [ディレクトリ]: ${directories.slice(0, 10).join(', ')} ... 他${directories.length - 10}個`, 'info');
                }
                if (files.length > 0 && files.length <= 10) {
                    mConsole.print(`  [ファイル]: ${files.join(', ')}`, 'info');
                } else if (files.length > 10) {
                    mConsole.print(`  [ファイル]: ${files.slice(0, 10).join(', ')} ... 他${files.length - 10}個`, 'info');
                }
            }
            
            // チャット表示用のメッセージを作成
            let displayMessage = `✅ ${fullPath}`;
            
            if (directories.length > 0 && directories.length <= 5) {
                displayMessage += `\n\nディレクトリ: ${directories.join(', ')}`;
            } else if (directories.length > 5) {
                displayMessage += `\n\nディレクトリ: ${directories.slice(0, 5).join(', ')} ... 他${directories.length - 5}個`;
            }
            
            if (files.length > 0 && files.length <= 10) {
                displayMessage += `\nファイル: ${files.join(', ')}`;
            } else if (files.length > 10) {
                displayMessage += `\nファイル: ${files.slice(0, 10).join(', ')} ... 他${files.length - 10}個`;
            }
            
            return {
                success: true,
                files: files,
                directories: directories,
                message: displayMessage,
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

/**
 * コード構造を抽出（クライアント側で軽量に処理）
 * PHP, JavaScript, HTMLなどの言語に対応
 * 
 * @param {string} content - ファイル内容
 * @param {string} filename - ファイル名（拡張子から言語を判定）
 * @returns {Object} - 構造情報（関数、クラス、メソッドなど）
 */
function extractCodeStructure(content, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const structure = {
        language: ext,
        classes: [],
        functions: [],
        methods: [],
        summary: ''
    };
    
    const lines = content.split('\n');
    
    // PHP構造抽出
    if (ext === 'php') {
        // クラス定義を抽出
        const classRegex = /^\s*(abstract\s+|final\s+)?\s*class\s+(\w+)(\s+extends\s+\w+)?(\s+implements\s+[\w\s,]+)?/gm;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            structure.classes.push({
                name: match[2],
                line: lineNum,
                modifiers: match[1] ? match[1].trim() : null
            });
        }
        
        // 関数定義を抽出（クラス外の関数）
        const functionRegex = /^\s*function\s+(\w+)\s*\(/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            structure.functions.push({
                name: match[1],
                line: lineNum
            });
        }
        
        // メソッド定義を抽出
        const methodRegex = /^\s*(public|protected|private)?\s*(static\s+)?function\s+(\w+)\s*\(/gm;
        while ((match = methodRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            structure.methods.push({
                name: match[3],
                line: lineNum,
                visibility: match[1] || 'public',
                static: !!match[2]
            });
        }
    }
    
    // JavaScript構造抽出
    else if (ext === 'js' || ext === 'mjs') {
        // クラス定義
        const classRegex = /^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)/gm;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            structure.classes.push({
                name: match[1],
                line: lineNum
            });
        }
        
        // 関数定義（function宣言）
        const functionRegex = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            structure.functions.push({
                name: match[1],
                line: lineNum
            });
        }
        
        // アロー関数（const/let/var）
        const arrowFunctionRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm;
        while ((match = arrowFunctionRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            structure.functions.push({
                name: match[1],
                line: lineNum,
                type: 'arrow'
            });
        }
        
        // メソッド定義（クラス内）
        const methodRegex = /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm;
        while ((match = methodRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            // constructorやgetterなども含む
            if (match[1] !== 'if' && match[1] !== 'for' && match[1] !== 'while') {
                structure.methods.push({
                    name: match[1],
                    line: lineNum
                });
            }
        }
    }
    
    // HTML構造抽出
    else if (ext === 'html' || ext === 'htm') {
        const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) {
            structure.title = titleMatch[1];
        }
        
        // 主要なタグを抽出
        const scriptTags = (content.match(/<script[^>]*>/gi) || []).length;
        const styleTags = (content.match(/<style[^>]*>/gi) || []).length;
        const linkTags = (content.match(/<link[^>]*>/gi) || []).length;
        
        structure.summary = `HTML: ${scriptTags} scripts, ${styleTags} styles, ${linkTags} links`;
    }
    
    // CSS構造抽出
    else if (ext === 'css') {
        const selectorRegex = /^\s*([.#]?[\w-]+(?:\s*[>+~]\s*[\w-]+)*)\s*\{/gm;
        let match;
        const selectors = [];
        while ((match = selectorRegex.exec(content)) !== null && selectors.length < 20) {
            selectors.push(match[1].trim());
        }
        structure.selectors = selectors;
        structure.summary = `CSS: ${selectors.length}+ selectors`;
    }
    
    // 要約を生成
    if (!structure.summary) {
        const parts = [];
        if (structure.classes.length > 0) {
            parts.push(`${structure.classes.length} classes`);
        }
        if (structure.functions.length > 0) {
            parts.push(`${structure.functions.length} functions`);
        }
        if (structure.methods.length > 0) {
            parts.push(`${structure.methods.length} methods`);
        }
        structure.summary = parts.length > 0 ? parts.join(', ') : 'No structure detected';
    }
    
    return structure;
}

/**
 * ファイルを検索（キーワード検索、正規表現対応）
 * クライアント側でファイルリストを取得し、検索処理を実行
 * 
 * @param {string} query - 検索キーワード
 * @param {Object} options - 検索オプション
 * @returns {Promise<Object>} - 検索結果
 */
export async function searchFiles(query, options = {}) {
    const {
        api: apiFunc,
        mConsole,
        baseDir,
        searchIn = 'both', // 'filename', 'content', 'both'
        regex = false,
        caseSensitive = false,
        filePattern = null,
        maxResults = 50,
        contextLines = 2
    } = options;
    
    try {
        if (!apiFunc) {
            throw new Error('API関数が渡されていません');
        }
        
        if (!query) {
            throw new Error('検索キーワードが指定されていません');
        }
        
        // 検索用の正規表現を作成
        let searchRegex;
        if (regex) {
            try {
                searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');
            } catch (e) {
                throw new Error(`無効な正規表現: ${e.message}`);
            }
        } else {
            // 通常検索の場合は特殊文字をエスケープ
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            searchRegex = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
        }
        
        // ファイルパターンの正規表現を作成
        let filePatternRegex = null;
        if (filePattern) {
            const pattern = filePattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            filePatternRegex = new RegExp(pattern, 'i');
        }
        
        // ベースディレクトリのファイル一覧を再帰的に取得
        const allFiles = await getFileListRecursive(baseDir, apiFunc, filePatternRegex);
        
        const results = [];
        let filesSearched = 0;
        
        for (const file of allFiles) {
            if (results.length >= maxResults) break;
            
            filesSearched++;
            
            // ファイル名検索
            if (searchIn === 'filename' || searchIn === 'both') {
                if (searchRegex.test(file.name)) {
                    results.push({
                        file: file.path,
                        matchType: 'filename',
                        matches: [{
                            line: 0,
                            content: file.name
                        }]
                    });
                    continue;
                }
            }
            
            // 内容検索
            if (searchIn === 'content' || searchIn === 'both') {
                try {
                    // ファイル内容を読み込み（キャッシュ不要、直接読み込み）
                    const readResult = await apiFunc('/api/file_manager.php', {
                        action: 'read',
                        path: file.path
                    });
                    
                    if (readResult.status === 'success') {
                        const content = readResult.content;
                        const lines = content.split('\n');
                        const fileMatches = [];
                        
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            if (searchRegex.test(line)) {
                                // コンテキスト行を含めて抽出
                                const contextStart = Math.max(0, i - contextLines);
                                const contextEnd = Math.min(lines.length - 1, i + contextLines);
                                
                                const contextSnippet = [];
                                for (let j = contextStart; j <= contextEnd; j++) {
                                    contextSnippet.push({
                                        lineNum: j + 1,
                                        content: lines[j],
                                        isMatch: j === i
                                    });
                                }
                                
                                fileMatches.push({
                                    line: i + 1,
                                    content: line,
                                    context: contextSnippet
                                });
                                
                                // 同一ファイル内で多すぎる結果は制限
                                if (fileMatches.length >= 10) break;
                            }
                            // 正規表現のlastIndexをリセット
                            searchRegex.lastIndex = 0;
                        }
                        
                        if (fileMatches.length > 0) {
                            results.push({
                                file: file.path,
                                matchType: 'content',
                                matchCount: fileMatches.length,
                                matches: fileMatches
                            });
                        }
                    }
                } catch (error) {
                    // ファイル読み込みエラーは無視して次へ
                    console.warn(`Failed to read ${file.path}:`, error.message);
                }
            }
        }
        
        await logToolExecution('searchFiles', { 
            query, 
            searchIn, 
            regex, 
            filePattern 
        }, 'success', {
            filesSearched,
            resultsFound: results.length
        });
        
        if (mConsole) {
            const searchType = searchIn === 'both' ? 'ファイル名+内容' : searchIn === 'filename' ? 'ファイル名' : '内容';
            const patternInfo = filePattern ? ` (パターン: ${filePattern})` : '';
            const regexInfo = regex ? ' [正規表現]' : '';
            mConsole.print(`✅ searchFiles: "${query}"${regexInfo} を${searchType}で検索${patternInfo} → ${results.length}件ヒット (${filesSearched}ファイル検索)`, 'success');
        }
        
        // チャット表示用のメッセージを作成
        const searchType = searchIn === 'both' ? 'ファイル名+内容' : searchIn === 'filename' ? 'ファイル名' : '内容';
        const regexInfo = regex ? ' [正規表現]' : '';
        const patternInfo = filePattern ? ` (パターン: ${filePattern})` : '';
        
        let displayMessage = `✅ "${query}"${regexInfo} を検索${patternInfo}\n${results.length}件ヒット (${filesSearched}ファイル検索, ${searchType})`;
        
        // 最初の3件の結果を表示
        if (results.length > 0) {
            displayMessage += '\n\n検索結果:';
            for (let i = 0; i < Math.min(3, results.length); i++) {
                const result = results[i];
                if (result.matchType === 'filename') {
                    displayMessage += `\n- ${result.file} (ファイル名一致)`;
                } else {
                    displayMessage += `\n- ${result.file} (${result.matchCount}箇所)`;
                }
            }
            if (results.length > 3) {
                displayMessage += `\n... 他${results.length - 3}件`;
            }
        }
        
        return {
            success: true,
            query: query,
            filesSearched: filesSearched,
            resultsCount: results.length,
            results: results,
            message: displayMessage
        };
        
    } catch (error) {
        await logToolExecution('searchFiles', { query }, 'error', { error: error.message });
        if (mConsole) {
            mConsole.print(`検索エラー: ${error.message}`, 'error');
        }
        return {
            success: false,
            message: error.message,
            results: []
        };
    }
}

/**
 * ディレクトリ配下のファイル一覧を再帰的に取得（ヘルパー関数）
 * 
 * @param {string} dirPath - ディレクトリパス
 * @param {Function} apiFunc - API関数
 * @param {RegExp} filePatternRegex - ファイルパターンの正規表現（nullの場合は全ファイル）
 * @param {number} maxDepth - 最大再帰深度
 * @param {number} currentDepth - 現在の深度
 * @returns {Promise<Array>} - ファイル情報の配列
 */
async function getFileListRecursive(dirPath, apiFunc, filePatternRegex = null, maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
        return [];
    }
    
    try {
        const result = await apiFunc('/api/file_manager.php', {
            action: 'list-object',
            path: dirPath
        });
        
        if (result.status !== 'success' || !result.files || !result.files.files) {
            return [];
        }
        
        const files = [];
        
        for (const item of result.files.files) {
            const itemPath = `${dirPath}/${item.name}`.replace(/\/+/g, '/');
            
            if (item.type === 'dir') {
                // ディレクトリの場合は再帰的に取得
                const subFiles = await getFileListRecursive(itemPath, apiFunc, filePatternRegex, maxDepth, currentDepth + 1);
                files.push(...subFiles);
            } else {
                // ファイルパターンマッチング
                if (!filePatternRegex || filePatternRegex.test(item.name)) {
                    files.push({
                        name: item.name,
                        path: itemPath,
                        size: item.size || 0
                    });
                }
            }
        }
        
        return files;
    } catch (error) {
        console.error(`Failed to list directory ${dirPath}:`, error);
        return [];
    }
}