
// ai-tool.js
// ai用のツールモジュール
import { createFile, editFileByReplace, editFileByLines, readFile, deleteFile, ls, searchFiles } from './ai_tools/fileEditor.js';
import { getAllTools, getToolByName } from './toolDefinitions.js';
import { loadSelectedModel } from '../utils/cookie.js';

async function logToolInvocationError(toolName, parameters, errorCode, message) {
    try {
        const model = loadSelectedModel() || 'unknown';
        await api('/api/tool_history.php', {
            action: 'logToolExecution',
            tool: toolName,
            parameters: parameters,
            status: 'error',
            result: {
                error: errorCode,
                message: message,
                phase: 'invocation'
            },
            approvalTime: null,
            model: model
        });
    } catch (error) {
        console.error('ツール呼び出しエラーログ送信に失敗:', error);
    }
}


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
                const replaceArgs = args || {};
                const normalizedFilename =
                    (typeof replaceArgs.filename === 'string' && replaceArgs.filename.trim() !== '')
                        ? replaceArgs.filename
                        : (typeof replaceArgs.filePath === 'string' && replaceArgs.filePath.trim() !== '')
                            ? replaceArgs.filePath
                            : (typeof replaceArgs.path === 'string' && replaceArgs.path.trim() !== '')
                                ? replaceArgs.path
                                : null;

                if (!normalizedFilename) {
                    await logToolInvocationError(
                        'editFileByReplace',
                        replaceArgs,
                        'invalid_arguments',
                        'editFileByReplace の引数が不正です。filename（または filePath/path）を指定してください'
                    );
                    return {
                        success: false,
                        error: 'invalid_arguments',
                        message: 'editFileByReplace の引数が不正です。filename（または filePath/path）を指定してください'
                    };
                }

                return await editFileByReplace(
                    normalizedFilename,
                    replaceArgs.searchText, 
                    replaceArgs.replaceText, 
                    replaceArgs.options || {},
                    {
                        skipConfirmation: skipConfirmation,
                        ...context
                    }
                );
            } else if (toolName === 'editFileByLines') {
                const lineArgs = args || {};
                const normalizedFilename =
                    (typeof lineArgs.filename === 'string' && lineArgs.filename.trim() !== '')
                        ? lineArgs.filename
                        : (typeof lineArgs.filePath === 'string' && lineArgs.filePath.trim() !== '')
                            ? lineArgs.filePath
                            : (typeof lineArgs.path === 'string' && lineArgs.path.trim() !== '')
                                ? lineArgs.path
                                : null;

                if (!normalizedFilename) {
                    await logToolInvocationError(
                        'editFileByLines',
                        lineArgs,
                        'invalid_arguments',
                        'editFileByLines の引数が不正です。filename（または filePath/path）を指定してください'
                    );
                    return {
                        success: false,
                        error: 'invalid_arguments',
                        message: 'editFileByLines の引数が不正です。filename（または filePath/path）を指定してください'
                    };
                }
                if (lineArgs.lineStart === undefined || lineArgs.lineStart === null) {
                    await logToolInvocationError(
                        'editFileByLines',
                        lineArgs,
                        'invalid_arguments',
                        'editFileByLines の引数が不正です。lineStart を指定してください'
                    );
                    return {
                        success: false,
                        error: 'invalid_arguments',
                        message: 'editFileByLines の引数が不正です。lineStart を指定してください'
                    };
                }
                if (lineArgs.lineEnd === undefined || lineArgs.lineEnd === null) {
                    await logToolInvocationError(
                        'editFileByLines',
                        lineArgs,
                        'invalid_arguments',
                        'editFileByLines の引数が不正です。lineEnd を指定してください'
                    );
                    return {
                        success: false,
                        error: 'invalid_arguments',
                        message: 'editFileByLines の引数が不正です。lineEnd を指定してください'
                    };
                }
                if (typeof lineArgs.newContent !== 'string') {
                    await logToolInvocationError(
                        'editFileByLines',
                        lineArgs,
                        'invalid_arguments',
                        'editFileByLines の引数が不正です。newContent は文字列で指定してください'
                    );
                    return {
                        success: false,
                        error: 'invalid_arguments',
                        message: 'editFileByLines の引数が不正です。newContent は文字列で指定してください'
                    };
                }

                return await editFileByLines(
                    normalizedFilename,
                    lineArgs.lineStart,
                    lineArgs.lineEnd,
                    lineArgs.newContent,
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
                await logToolInvocationError(
                    toolName,
                    args,
                    'unsupported_tool',
                    '未対応のツール: ' + toolName
                );
                return { success: false, error: 'unsupported_tool', message: '未対応のツールです: ' + toolName };
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
