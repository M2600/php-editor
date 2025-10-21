/**
 * File Editor Tool for AI
 * 
 * AIがファイルを編集するためのツールモジュール
 * OpenAI Function Calling形式に対応
 */

import { api } from '../../utils/api.js';
import { loadExplorer } from '../../core/file-manager.js';

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
 * 既存のshowDiff()とdiffApplyMenu()を使用
 * 
 * @param {Object} editor - MEditorインスタンス
 * @param {Object} file - 編集対象のファイルオブジェクト
 * @param {string} newContent - 新しいファイル内容
 * @param {number} startTime - 確認開始時刻（承認時間計測用）
 * @returns {Promise<boolean>} - 承認されたらtrue、拒否されたらfalse
 */
function showEditConfirmation(editor, file, newContent, startTime) {
    return new Promise((resolve) => {
        // fileオブジェクトが無効な場合は簡易確認
        if (!file || !file.aceObj || !file.aceObj.element) {
            console.warn('fileオブジェクトが無効なため、簡易確認を使用します');
            const approved = confirm('この変更を適用しますか？');
            const approvalTime = (Date.now() - startTime) / 1000;
            resolve({ approved, approvalTime: approved ? approvalTime : null });
            return;
        }
        
        // Diff表示
        const clearDiff = editor.showDiff(file, newContent);
        
        // 確認ダイアログを表示（エディタ右下）
        const menuContainer = file.aceObj.element.parentElement || document.body;
        
        editor.diffApplyMenu(
            menuContainer,
            file,
            newContent,
            // 適用ボタン
            (file, proposed) => {
                const approvalTime = (Date.now() - startTime) / 1000; // 秒単位
                file.aceObj.editor.setValue(proposed);
                file.changed = true;
                clearDiff();
                resolve({ approved: true, approvalTime });
            },
            // 拒否ボタン
            (file) => {
                clearDiff();
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
            // TODO: 新規ファイル作成の確認UI実装
            // 現時点では簡易的な確認
            approved = confirm(`ファイル "${filename}" を作成しますか？`);
            approvalTime = (Date.now() - startTime) / 1000;
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
                path: filename
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
        
        if (!skipConfirmation && editor && currentFile && currentFile.path === fullPath) {
            // ユーザーに確認
            const confirmation = await showEditConfirmation(editor, currentFile, newContent, startTime);
            approved = confirmation.approved;
            approvalTime = confirmation.approvalTime;
        } else if (!skipConfirmation) {
            // ファイルが開いていない場合は簡易確認
            approved = confirm(`ファイル "${filename}" を編集しますか？`);
            approvalTime = (Date.now() - startTime) / 1000;
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
        
        if (!skipConfirmation && editor && currentFile && currentFile.path === fullPath) {
            // ユーザーに確認
            const confirmation = await showEditConfirmation(editor, currentFile, updatedContent, startTime);
            approved = confirmation.approved;
            approvalTime = confirmation.approvalTime;
        } else if (!skipConfirmation) {
            approved = confirm(`ファイル "${filename}" の ${lineStart}-${lineEnd} 行目を編集しますか？`);
            approvalTime = (Date.now() - startTime) / 1000;
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
        
        if (!skipConfirmation) {
            approved = confirm(`本当にファイル "${filename}" を削除しますか？この操作は取り消せません。`);
            approvalTime = (Date.now() - startTime) / 1000;
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