
// ai-tool.js
// ai用のツールモジュール
import { createFile, editFileByReplace, editFileByLines, readFile, deleteFile, ls, searchFiles } from './ai_tools/fileEditor.js';
import { getAllTools, getToolByName } from './toolDefinitions.js';


export class AITool {
    constructor() {
    }

    /**
     * ツール名と引数からfileEditor.jsの関数を呼び出す
     * @param {string} toolName - 実行するツール名
     * @param {object} args - ツールに渡す引数
     * @param {object} context - 実行コンテキスト（editor, mConsole, currentFile, apiなど）
     * @returns {any} - ツール関数の戻り値
     */
    async callTool(toolName, args, context = {}) {
        try {
            // AIが skipConfirmation を設定できないようにする
            // アプリケーション側の context.skipConfirmation のみを使用
            const skipConfirmation = context.skipConfirmation ?? false;
            
            if (toolName === 'createFile') {
                return await createFile(args.filename, args.content, {
                    skipConfirmation: skipConfirmation,
                    ...context
                });
            } else if (toolName === 'readFile') {
                return await readFile(args.filename, {
                    ...context,
                    startLine: args.startLine,
                    endLine: args.endLine,
                    maxLines: args.maxLines
                });
            } else if (toolName === 'editFileByReplace') {
                return await editFileByReplace(
                    args.filename, 
                    args.searchText, 
                    args.replaceText, 
                    args.options || {},
                    {
                        skipConfirmation: skipConfirmation,
                        ...context
                    }
                );
            } else if (toolName === 'editFileByLines') {
                return await editFileByLines(
                    args.filename, 
                    args.lineStart, 
                    args.lineEnd, 
                    args.newContent,
                    {
                        skipConfirmation: skipConfirmation,
                        ...context
                    }
                );
            } else if (toolName === 'deleteFile') {
                return await deleteFile(args.filename, {
                    skipConfirmation: skipConfirmation,
                    ...context
                });
            } else if (toolName === 'ls'){
                return await ls(args.directory, {
                    ...context
                })
            } else if (toolName === 'searchFiles') {
                return await searchFiles(args.query, {
                    ...context,
                    searchIn: args.searchIn,
                    regex: args.regex,
                    caseSensitive: args.caseSensitive,
                    filePattern: args.filePattern,
                    maxResults: args.maxResults,
                    contextLines: args.contextLines
                });
            } else {
                throw new Error('未対応のツール: ' + toolName);
            }
        } catch (e) {
            console.error('ファイルツール実行エラー:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * すべての利用可能なツール定義を取得（OpenAI形式）
     */
    getAvailableTools() {
        return getAllTools();
    }

    /**
     * ツール名からツール定義を取得
     */
    getToolDefinition(toolName) {
        return getToolByName(toolName);
    }
}