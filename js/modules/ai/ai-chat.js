/**
 * AI チャット機能
 */

import { CONFIG } from '../core/config.js';

// AIToolクラスをインポート
export { AITool } from './ai-tool.js';

// AI関連のユーティリティ関数
export function extractMarkdownCodeBlocks(text) {
    const codeBlockRegex = /```\S*\s(.*?)```/gs;
    let matches;
    const codeBlocks = [];
    while ((matches = codeBlockRegex.exec(text)) !== null) {
        codeBlocks.push(matches[1].trim());
    }
    return codeBlocks;
}

export async function AIMerge(baseCode, aiCode, modelSelect, fetchAIChat, editor, currentFile, mConsole, editorEditor) {
    const prompt = `Merge the following code snippets:

Base Code:
${baseCode}

AI Suggested Code:
${aiCode}

Merged Code:
Please provide the merged code only, without any additional text or explanations.`;
    
    const controller = new AbortController();
    const selectedModel = modelSelect.getValue() || undefined;
    let buffer = "";
    let hasValidStream = false;
    
    if(typeof fetchAIChat === 'function'){
        await fetchAIChat({
            messages: [{ role: "user", content: prompt }],
            model: selectedModel,
            signal: controller.signal,
            smoothOutput: true, // スムーズ出力を有効化
            onDelta: (delta, chunk, isSmooth) => {
                // ストリーム更新処理
                if (isSmooth) {
                    // スムーズ出力の場合はdeltaが完全なテキスト
                    buffer = delta;
                } else {
                    // 通常の場合は差分テキスト
                    buffer += delta;
                }
                hasValidStream = true;
            },
            onError: (errMsg) => {
                console.error("AI応答エラー:", errMsg);
            }
        }).then(() => {
            if (hasValidStream) {
                let codeBlocks = extractMarkdownCodeBlocks(buffer);
                if (codeBlocks.length === 0) {
                    mConsole.print("AIからの応答にコードブロックが含まれていません", "error");
                    return;
                }
                if (codeBlocks.length > 1) {
                    mConsole.print("AIからの応答に複数のコードブロックが含まれています。最初のコードブロックを適用します", "warning");
                }
                let code = codeBlocks[0];
                let clearDiff = editor.showDiff(currentFile, code);

                const applyCode = async (file, code) => {
                    if (file && file.aceObj && file.aceObj.editor) {
                        clearDiff();
                        file.aceObj.editor.setValue(code, -1);
                        file.changed = true;
                        editor.setFileIcon(file.path, "*");
                        mConsole.print("コードを適用しました", "success");
                    }
                };
                let applyMenu = editor.diffApplyMenu(editorEditor.element, currentFile, code, applyCode, clearDiff);
            }
        })
    }
}

export class ChatHistoryManager {
    constructor(storageKey = CONFIG.CHAT_STORAGE_KEY, DEBUG = false) {
        this.storageKey = storageKey;
        this.DEBUG = DEBUG;
        this.chatHistory = [];
        this.isStreaming = false;
    }

    saveChatHistory() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.chatHistory));
            this.DEBUG && console.log("Chat history saved to localStorage");
        } catch(e) {
            console.error("Failed to save chat history:", e);
        }
    }

    clearChatHistory(){
        try{
            localStorage.removeItem(this.storageKey);
            this.DEBUG && console.log("Chat history cleared");
        } catch(e) {
            console.error("Failed to clear chat history:", e);
        }
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.chatHistory = JSON.parse(saved);
                this.DEBUG && console.log("Chat history loaded from localStorage");
                return this.chatHistory;
            }
        } catch(e) {
            console.error("Failed to load chat history:", e);
            this.chatHistory = [];
        }
        return this.chatHistory;
    }

    addMessage(role, content) {
        this.chatHistory.push({role, content});
        this.saveChatHistory();
    }

    limitHistory(maxHistory) {
        if (maxHistory > 0) {
            this.chatHistory = this.chatHistory.slice(-maxHistory);
        } else {
            this.chatHistory = this.chatHistory.slice(-1000); // 1000件以上は保存しない
        }
    }

    getHistory() {
        return this.chatHistory;
    }

    clear() {
        this.chatHistory = [];
        this.clearChatHistory();
    }

    setStreaming(status) {
        this.isStreaming = status;
    }

    getStreaming() {
        return this.isStreaming;
    }
}

export function restoreChatHistoryToUI(chatHistory, chat) {
    if (!chat.content || !chat.content.element) return;
    
    chatHistory.forEach(msg => {
        if (msg.role === "user") {
            chat.addMessage(msg.content, "user");
        } else if (msg.role === "assistant") {
            chat.addMessage(msg.content, "ai", true);
        }
    });
    // スクロールを最下部に
    if (chat.content.element.scrollHeight > chat.content.element.clientHeight) {
        chat.content.element.scrollTop = chat.content.element.scrollHeight;
    }
}

export async function loadModelList(chat) {
    try {
        const res = await fetch("/api/ai_models.php");
        if (!res.ok) throw new Error("モデル一覧取得失敗: " + res.status);
        const data = await res.json();
        if (!data.data || !Array.isArray(data.data)) throw new Error("モデルデータ不正");
        // nameを表示名に使う
        const models = data.data.map(m => ({ id: m.id, name: m.name }));
        // デフォルトモデル（nameが"Default("で始まるもの）を探す
        let defaultModel = models.find(m => m.name && m.name.startsWith("Default("));
        let defaultValue = defaultModel ? defaultModel.id : undefined;
        return chat.createModelSelector({
            models: models,
            className: "meditor-chat-model-selector",
            style: { marginRight: "0.5em" },
            defaultValue: defaultValue
        });
    } catch(e) {
        const modelSelect = chat.createModelSelector({
            models: ['モデル取得エラー'],
            className: "meditor-chat-model-selector",
            style: { marginRight: "0.5em" },
            placeholder: "モデル取得エラー"
        });
        console.error("モデル一覧取得エラー:", e);
        return modelSelect;
    }
}

export function setupChatClearHistory(chat, historyManager) {
    chat.clearHistory = function() {
        historyManager.clear();
        if (chat.content && chat.content.element) {
            chat.content.element.innerHTML = "";
        }
        if (Array.isArray(chat.messages)) {
            chat.messages.length = 0;
        }
    };
}

export function generateDirectoryContext(fileList, baseDir) {
    if (!fileList || !fileList.files) return null;

    const subFiles = (files, maxDepth = 2, currentDepth = 0) => {
        if (currentDepth >= maxDepth) return [];
        return files.map(file => {
            if (file.type === "dir") {
                return subFiles(file.files || [], maxDepth, currentDepth + 1);
            } else {
                return `${file.path}`;
            }
        });
    };

    const dirContext = {
        currentDir: baseDir || "/",
        structure: subFiles(fileList.files, 5),
    };
    
    return dirContext;
}

export async function sendAIMessage({
    chat,
    historyManager,
    modelSelect,
    fetchAIChat,
    currentFile,
    fileList,
    baseDir,
    requestAIMergeAndPreview
}) {
    try {
        if(historyManager.getStreaming()) return;
        const userMsg = chat.inputArea.textarea.value.trim();
        if(!userMsg) return;
        chat.inputArea.textarea.value = "";
        chat.inputArea.textarea.style.height = '';
        
        historyManager.addMessage("user", userMsg);
        historyManager.setStreaming(true);

        // ローディング表示
        if (typeof chat.showLoading === 'function') chat.showLoading();

        // AIメッセージ表示用
        let aiMsgBuffer = "";
        // まず空のAIメッセージを追加
        chat.addMessage("", "ai", true);
        setTimeout(() => {
            chat.addApplyToCodeButtonsToChat(async (aiCode) => {
                await requestAIMergeAndPreview(aiCode);
            });
        }, 0);

        // 送信履歴を制限
        historyManager.limitHistory(CONFIG.MAX_CHAT_HISTORY);

        // ファイル内容を送信するか判定
        let fileContext = null;
        if (currentFile && currentFile.aceObj && typeof currentFile.aceObj.editor.getValue === 'function') {
            const fileContent = currentFile.aceObj.editor.getValue();
            if (fileContent && fileContent.length > 0) {
                console.log("Sending file context:", currentFile.path);
                fileContext = {
                    name: currentFile.path || 'ファイル',
                    content: fileContent
                };
                if (typeof chat.setFileContextInfo === 'function') {
                    chat.setFileContextInfo({ name: fileContext.name });
                }
            } else {
                if (typeof chat.setFileContextInfo === 'function') {
                    chat.setFileContextInfo(null);
                }
            }
        } else {
            if (typeof chat.setFileContextInfo === 'function') {
                chat.setFileContextInfo(null);
            }
        }

        // ディレクトリコンテキストを生成
        const dirContext = generateDirectoryContext(fileList, baseDir);
        if (dirContext) {
            console.log("Sending directory context:", dirContext);
        }

        // ストリーム受信（ai_api.js利用）
        const controller = new AbortController();
        const selectedModel = modelSelect.getValue() || undefined;
        aiMsgBuffer = "";
        
        if (typeof fetchAIChat === 'function') {
            fetchAIChat({
                messages: historyManager.getHistory(),
                model: selectedModel,
                fileContext: fileContext ?? null,
                dirContext: dirContext ?? null,
                signal: controller.signal,
                smoothOutput: true, // スムーズ出力を有効化
                onDelta: (delta, chunk, isSmooth) => {
                    if (isSmooth) {
                        // スムーズ出力の場合はdeltaが完全なテキスト
                        aiMsgBuffer = delta;
                        chat.updateLastAIMessage(delta, true);
                    } else {
                        // 通常の場合は差分テキスト
                        aiMsgBuffer += delta;
                        chat.updateLastAIMessage(aiMsgBuffer, true);
                    }
                },
                onError: (errMsg) => {
                    chat.updateLastAIMessage('<span style="color:red">AI応答エラー: '+errMsg+'</span>', true);
                    historyManager.setStreaming(false);
                    if (typeof chat.hideLoading === 'function') chat.hideLoading();
                    console.error("AI応答エラー:", errMsg);
                }
            }).then(() => {
                // 最終的なテキストを履歴に保存
                historyManager.addMessage("assistant", aiMsgBuffer);
                historyManager.setStreaming(false);
                if (typeof chat.hideLoading === 'function') chat.hideLoading();
            });
        } else {
            chat.updateLastAIMessage('<span style="color:red">AI APIモジュールが利用できません</span>', true);
            historyManager.setStreaming(false);
            if (typeof chat.hideLoading === 'function') chat.hideLoading();
        }
    } catch(e) {
        console.error("AI送信処理エラー:", e);
        chat.addMessage('<span style="color:red">AI送信処理エラー: '+e.message+'</span>', "system");
        historyManager.setStreaming(false);
        if (typeof chat.hideLoading === 'function') chat.hideLoading();
    }
}
