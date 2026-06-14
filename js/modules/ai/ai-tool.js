
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


// BASE_DIR 相対パスを git repo ルート相対パスに変換する
function resolveGitPath(filePath, baseDir) {
    if (!filePath) return filePath;
    const base = (baseDir || '').replace(/\/$/, '');
    const rel  = filePath.replace(/^\.?\/+/, '');
    return base ? `${base}/${rel}` : rel;
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
            } else if (toolName === 'listHistory') {
                const { api: apiFunc, baseDir } = context;
                const data = await apiFunc('/api/git_manager.php', {
                    action: 'history',
                    file: args.file ? resolveGitPath(args.file, baseDir) : (baseDir ?? null),
                    limit: args.limit ?? 20
                });
                const commits = (data.commits ?? []).map(c =>
                    `${c.hash} | ${c.timestamp} | ${c.message}`
                ).join('\n');
                return { success: true, llmContent: commits || '(履歴なし)' };
            } else if (toolName === 'showFileAtCommit') {
                const { api: apiFunc, baseDir } = context;
                const data = await apiFunc('/api/git_manager.php', {
                    action: 'show',
                    hash: args.hash,
                    file: resolveGitPath(args.file, baseDir)
                });
                if (data.status !== 'success') {
                    const reason = data.error ? ` (${data.error})` : '';
                    return {
                        success: false,
                        llmContent: `このコミット時点ではファイルが存在しませんでした: ${args.file}${reason}`
                    };
                }
                return { success: true, llmContent: data.content ?? '' };
            } else if (toolName === 'restoreSnapshot') {
                const { api: apiFunc } = context;
                const filesData = await apiFunc('/api/git_manager.php', {
                    action: 'commit_files',
                    hash: args.hash
                });
                const fileList = (filesData.files ?? []).join('\n');
                const confirmed = window.confirm(
                    `以下のファイルをコミット時点の状態に復元します:\n\n${fileList}\n\n続行しますか？`
                );
                if (!confirmed) {
                    return { success: false, llmContent: 'ユーザーがキャンセルしました' };
                }
                const data = await apiFunc('/api/git_manager.php', {
                    action: 'restore',
                    hash: args.hash
                });
                return {
                    success: data.success ?? false,
                    llmContent: data.success ? `復元しました (新コミット: ${data.hash})` : (data.error ?? '復元失敗')
                };
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
