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
            description: "ファイルの内容を読み込みます。大きなファイル（100行超）の場合、パラメータなしでは構造要約（関数/クラス名一覧）のみを返します。特定の行範囲が必要な場合はstartLineとendLineを指定してください。効率的な使い方: 1) まず構造を取得 2) 必要な部分のみ行範囲指定で読み込み。",
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
            description: "プロジェクト内のファイルをキーワードで検索します。ファイル名検索と内容検索の両方に対応。効率的な使い方: 1) まずsearchFilesで該当ファイル/行を特定 2) readFileで必要な行範囲のみ取得。大量のファイルを読み込む前に、この検索機能で対象を絞り込むことを推奨します。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "検索キーワード（正規表現も使用可能）"
                    },
                    searchIn: {
                        type: "string",
                        description: "検索対象: 'filename' (ファイル名のみ), 'content' (ファイル内容のみ), 'both' (両方)",
                        enum: ["filename", "content", "both"],
                        default: "both"
                    },
                    regex: {
                        type: "boolean",
                        description: "queryを正規表現として扱うか（デフォルト: false、部分一致検索）",
                        default: false
                    },
                    caseSensitive: {
                        type: "boolean",
                        description: "大文字小文字を区別するか（デフォルト: false）",
                        default: false
                    },
                    filePattern: {
                        type: "string",
                        description: "検索対象ファイルのパターン（例: '*.php', '*.js'、省略時は全ファイル）"
                    },
                    maxResults: {
                        type: "integer",
                        description: "最大検索結果数（デフォルト: 50）",
                        minimum: 1,
                        maximum: 200,
                        default: 50
                    },
                    contextLines: {
                        type: "integer",
                        description: "マッチ箇所の前後に表示する行数（デフォルト: 2）",
                        minimum: 0,
                        maximum: 10,
                        default: 2
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
