
// ai-tool.js
// ai用のツールモジュール
import { createFile, editFileByReplace, editFileByLines, readFile, deleteFile } from './ai_tools/fileEditor.js';
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
            if (toolName === 'createFile') {
                return await createFile(args.filename, args.content, {
                    skipConfirmation: args.skipConfirmation || false,
                    ...context
                });
            } else if (toolName === 'readFile') {
                return await readFile(args.filename, context);
            } else if (toolName === 'editFileByReplace') {
                return await editFileByReplace(
                    args.filename, 
                    args.searchText, 
                    args.replaceText, 
                    args.options || {},
                    {
                        skipConfirmation: args.skipConfirmation || false,
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
                        skipConfirmation: args.skipConfirmation || false,
                        ...context
                    }
                );
            } else if (toolName === 'deleteFile') {
                return await deleteFile(args.filename, {
                    skipConfirmation: args.skipConfirmation || false,
                    ...context
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