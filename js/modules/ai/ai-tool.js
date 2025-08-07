
// ai-tool.js
// ai用のツールモジュール
import { createFile, editFile } from './ai_tools/fileEditor.js';


export class AITool {
    constructor() {
    }

    /**
     * ツール名と引数からfileEditor.jsの関数を呼び出す
     * @param {string} toolName - 実行するツール名（createFile, editFile）
     * @param {object} args - ツールに渡す引数
     * @returns {any} - ツール関数の戻り値
     */
    async callTool(toolName, args) {
        try {
            if (toolName === 'createFile') {
                return await createFile(args.filename, args.content);
            } else if (toolName === 'editFile') {
                return await editFile(args.filename, args.needle, args.replacement);
            } else {
                throw new Error('未対応のツール: ' + toolName);
            }
        } catch (e) {
            console.error('ファイルツール実行エラー:', e);
            return { error: e.message };
        }
    }


    _parseResponse(text) {
        // レスポンステキストをパースしてツール情報を抽出
        const pattern = /```tool\s*([\s\S]*?)```/;
        const matches = [...text.match(pattern)];
        if (matches) {
            let toolData = [];
            matches.forEach(match => {
                try {
                    const data = JSON.parse(match[1]);
                    if (data && data.tool && data.args) {
                        toolData.push({
                            tool: data.tool,
                            args: data.args
                        });
                    }
                } catch (e) {
                    console.error("ツールデータのパースに失敗:", e);
                }
            });
            return toolData;

        }
        return null;
    }

    

    parseAIResponseText(responseText) {
        // レスポンステキストをパースしてツール情報を抽出
        return this._parseResponse(responseText);
    }

    _availableTools() {
        // 利用可能なツールのリストを返す
        return [
            {name: "createFile", description: "Create new file and put content", args: {
                name: "filename", content: "content of the file"
            }},
            {name: "editFile", description: "Edit existing file", args: {
                name: "filename", needle: "needle", replacement: "replacement text"
            }},
        ];
    }

    toolPrompt() {
        // ツールのプロンプトを生成
        let prompt = "AIツールを使用する場合は、以下のようにJSON形式で入力してください:\n";
        prompt += "```tool\n";
        prompt += "{\n";
        prompt += '  "tool": "ツール名",\n';
        prompt += '  "args": {\n';
        prompt += '    "key1": "value1",\n';
        prompt += '    "key2": "value2"\n';
        prompt += '  }\n';
        prompt += "}\n";
        prompt += "```\n";
        prompt += "例:\n";
        prompt += "```tool\n";
        prompt += '{\n';
        prompt += '  "tool": "createFile",\n';
        prompt += '  "args": {\n';
        prompt += '    "filename": "test.php",\n';
        prompt += '    "content": "<?php echo \'Hello\'; ?>"\n';
        prompt += '  }\n';
        prompt += "}\n";
        prompt += "```\n";
        prompt += "mcpコマンド実行例:\n";
        prompt += "```tool\n";
        prompt += '{\n';
        prompt += '  "tool": "mcp",\n';
        prompt += '  "args": {\n';
        prompt += '    "command": "make build"\n';
        prompt += '  }\n';
        prompt += "}\n";
        prompt += "```\n";
        return prompt;
    }
}