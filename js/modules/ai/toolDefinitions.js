/**
 * AI Tool Definitions (OpenAI Function Calling形式)
 * 
 * AIが使用できるツールの定義を提供します。
 * OpenAI、Claude、Gemini等の互換性を持つ標準形式を採用。
 */

/**
 * ファイル編集ツールの定義
 */
export const FILE_EDITOR_TOOLS = [
    {
        type: "function",
        function: {
            name: "createFile",
            description: "新しいファイルを作成して内容を書き込みます。重要: ファイルが既に存在する場合はエラーを返すので、その場合は readFile で内容を確認してから editFileByReplace または editFileByLines を使用してください。",
            parameters: {
                type: "object",
                properties: {
                    filename: {
                        type: "string",
                        description: "作成するファイル名（相対パスまたは絶対パス）。例: 'test.php', 'src/utils.js'"
                    },
                    content: {
                        type: "string",
                        description: "ファイルの内容"
                    }
                },
                required: ["filename", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "readFile",
            description: "ファイルの内容を読み込みます。",
            parameters: {
                type: "object",
                properties: {
                    filename: {
                        type: "string",
                        description: "読み込むファイル名"
                    }
                },
                required: ["filename"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "editFileByReplace",
            description: "ファイル内のテキストを検索して置換します。正規表現も使用可能です。",
            parameters: {
                type: "object",
                properties: {
                    filename: {
                        type: "string",
                        description: "編集するファイル名"
                    },
                    searchText: {
                        type: "string",
                        description: "検索する文字列または正規表現パターン"
                    },
                    replaceText: {
                        type: "string",
                        description: "置換後の文字列"
                    },
                    options: {
                        type: "object",
                        description: "置換オプション",
                        properties: {
                            global: {
                                type: "boolean",
                                description: "すべての一致箇所を置換するか（デフォルト: true）",
                                default: true
                            },
                            regex: {
                                type: "boolean",
                                description: "searchTextを正規表現として扱うか（デフォルト: false）",
                                default: false
                            },
                            caseSensitive: {
                                type: "boolean",
                                description: "大文字小文字を区別するか（デフォルト: true）",
                                default: true
                            }
                        }
                    }
                },
                required: ["filename", "searchText", "replaceText"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "editFileByLines",
            description: "ファイルの指定した行範囲を新しい内容に置き換えます。正確な範囲指定が必要な場合に使用します。",
            parameters: {
                type: "object",
                properties: {
                    filename: {
                        type: "string",
                        description: "編集するファイル名"
                    },
                    lineStart: {
                        type: "integer",
                        description: "開始行番号（1から始まる）",
                        minimum: 1
                    },
                    lineEnd: {
                        type: "integer",
                        description: "終了行番号（1から始まる、この行を含む）",
                        minimum: 1
                    },
                    newContent: {
                        type: "string",
                        description: "置き換える新しい内容"
                    }
                },
                required: ["filename", "lineStart", "lineEnd", "newContent"]
            }
        }
    },
    // {
    //     type: "function",
    //     function: {
    //         name: "deleteFile",
    //         description: "ファイルを削除します。この操作は取り消せません。",
    //         parameters: {
    //             type: "object",
    //             properties: {
    //                 filename: {
    //                     type: "string",
    //                     description: "削除するファイル名"
    //                 }
    //             },
    //             required: ["filename"]
    //         }
    //     }
    // },
    {
        type: "function",
        function: {
            name: "ls",
            description: "指定したディレクトリ内のファイルとサブディレクトリの一覧を取得します。",
            parameters: {
                type: "object",
                properties: {
                    directory: {
                        type: "string",
                        description: "一覧を取得するディレクトリのパス"
                    }
                },
                required: ["directory"]
            }
        }
    }
];

/**
 * すべてのツール定義を取得
 */
export function getAllTools() {
    return FILE_EDITOR_TOOLS;
}

/**
 * ツール名からツール定義を取得
 */
export function getToolByName(toolName) {
    const tool = FILE_EDITOR_TOOLS.find(t => t.function.name === toolName);
    if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
    }
    return tool;
}

/**
 * ツール定義をOpenAI APIリクエスト形式に変換
 */
export function formatToolsForAPI(tools = FILE_EDITOR_TOOLS) {
    return tools;
}
