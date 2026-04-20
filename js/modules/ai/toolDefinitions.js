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
            description: "新しいファイルを作成して内容を書き込みます。既存ファイルには使わず、必要なら先に readFile で確認してください。",
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
            description: "ファイルの内容を読み込みます。大きいファイルは構造要約のみ返るので、必要な箇所は startLine と endLine で指定してください。",
            parameters: {
                type: "object",
                properties: {
                    filename: {
                        type: "string",
                        description: "読み込むファイル名"
                    },
                    startLine: {
                        type: "integer",
                        description: "読み込み開始行（1から始まる、省略時は1）",
                        minimum: 1
                    },
                    endLine: {
                        type: "integer",
                        description: "読み込み終了行（1から始まる、省略時はファイル末尾またはmaxLines制限まで）",
                        minimum: 1
                    },
                    maxLines: {
                        type: "integer",
                        description: "最大読み込み行数（デフォルト: 100行、省略時は100行まで読み込み、超過時は構造要約を返す）",
                        minimum: 1,
                        maximum: 1000
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
            description: "ファイル内の文字列を置換します。基本は完全一致です。まず readFile で前後を確認してから使ってください。",
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
                        description: "置換オプション。必要なときだけ指定してください。",
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
            description: "指定した行範囲を新しい内容に置き換えます。行番号が確実な場合だけ使ってください。",
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
            description: "指定したディレクトリ内のファイルとサブディレクトリの一覧を取得します。ファイル名、タイプ（file/dir）、サイズ、更新日時を返します。",
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
    },
    {
        type: "function",
        function: {
            name: "searchFiles",
            description: "プロジェクト内のファイルをキーワードで検索します。まず候補を絞り、次に readFile で必要な部分だけ読みます。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "検索キーワード"
                    },
                    searchIn: {
                        type: "string",
                        description: "検索対象: 'filename' (ファイル名のみ), 'content' (ファイル内容のみ), 'both' (両方)",
                        enum: ["filename", "content", "both"],
                        default: "both"
                    },
                    regex: {
                        type: "boolean",
                        description: "正規表現として扱うか",
                        default: false
                    },
                    caseSensitive: {
                        type: "boolean",
                        description: "大文字小文字を区別するか",
                        default: false
                    },
                    filePattern: {
                        type: "string",
                        description: "検索対象ファイルのパターン（例: '*.php', '*.js'、省略時は全ファイル）"
                    },
                    maxResults: {
                        type: "integer",
                        description: "最大検索結果数",
                        minimum: 1,
                        maximum: 200,
                        default: 50
                    },
                    contextLines: {
                        type: "integer",
                        description: "マッチ箇所の前後に表示する行数",
                        minimum: 0,
                        maximum: 10,
                        default: 0
                    }
                },
                required: ["query"]
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
