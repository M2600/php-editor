/**
 * AI チャット機能
 */

import { CONFIG } from '../core/config.js';
import { AI_CONFIG } from '../core/config.js';
import { loadSelectedModel, saveSelectedModel } from '../utils/cookie.js';

// AIToolクラスをインポート
import { AITool } from './ai-tool.js';
export { AITool };

// Markedのセキュリティ設定（一度だけ実行）
if (typeof marked !== 'undefined' && !marked._securityConfigured) {
    marked.setOptions({
        // インラインHTMLを無効化（セキュリティ強化）
        sanitize: false, // 後でsanitizeAIResponseで処理するため
        // コードブロック内のHTMLエスケープを有効化（デフォルトで有効だが明示）
        gfm: true,
        breaks: true,
        // XSS対策
        headerIds: false, // IDによるXSSを防ぐ
        mangle: false // メールアドレスの難読化を無効化（不要）
    });
    marked._securityConfigured = true;
}

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

// HTMLエスケープ用のヘルパー関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// <think>ブロックを抽出・処理する関数（ストリーム対応）
export function processThinkingBlocks(text) {
    const thinkingBlocks = [];
    let processedText = text;
    
    // Step 1: 完全な<think>...</think>ブロックを抽出
    processedText = processedText.replace(/<think[^>]*>([\s\S]*?)<\/think>/gi, (match, content, offset) => {
        const blockId = `[[[THINKING_${thinkingBlocks.length}]]]`;
        thinkingBlocks.push({
            id: blockId,
            content: content.trim(),
            fullMatch: match,
            isComplete: true
        });
        return blockId;
    });
    
    // Step 2: 未完了の<think>タグをチェック（ストリーム中）
    const incompleteThinkMatch = processedText.match(/<think[^>]*>([\s\S]*)$/);
    if (incompleteThinkMatch) {
        const blockId = `[[[THINKING_${thinkingBlocks.length}]]]`;
        const content = incompleteThinkMatch[1];
        
        thinkingBlocks.push({
            id: blockId,
            content: content,
            fullMatch: incompleteThinkMatch[0],
            isComplete: false
        });
        
        // 未完了thinkタグとその内容を置換
        processedText = processedText.replace(/<think[^>]*>([\s\S]*)$/, blockId);
    }
    
    return {
        processedText,
        thinkingBlocks
    };
}

// Thinkingブロックを適切なHTMLに変換（ストリーム対応）
export function renderThinkingBlocks(thinkingBlocks) {
    return thinkingBlocks.map(block => {
        // thinking内容はHTMLエスケープしてプレーンテキストとして表示
        // 改行は<br>に変換
        const escapedContent = escapeHtml(block.content)
            .replace(/\n/g, '<br>');
        
        // 未完了の場合は特別なクラスを追加
        const thinkClass = block.isComplete ? 'ai-think' : 'ai-think ai-think-streaming';
        
        return {
            ...block,
            html: `<div class="${thinkClass}">${escapedContent}</div>`
        };
    });
}

// DOM操作を使った安全なthinking処理（ストリーム対応）
export function processAIResponseWithDOM(text) {
    if (!text || typeof text !== 'string') return '';
    
    //console.log("Processing AI response with DOM:", text.substring(0, 200) + "...");
    
    // Step 1: Thinkingブロックを抽出（完了・未完了両方）
    const { processedText, thinkingBlocks } = processThinkingBlocks(text);
    //console.log("Extracted thinking blocks:", thinkingBlocks.length);
    // console.log("Thinking blocks:", thinkingBlocks.map(b => ({
    //     content: b.content.substring(0, 50) + "...",
    //     isComplete: b.isComplete
    // })));
    
    if (thinkingBlocks.length === 0) {
        return sanitizeAIResponse(marked.parse(text));
    }
    
    // Step 2: 通常のMarkdownレンダリング
    let renderedHtml = marked.parse(processedText);
    //console.log("Rendered HTML before replacement:", renderedHtml);
    
    // Step 3: Thinkingブロックをレンダリング
    const renderedThinking = renderThinkingBlocks(thinkingBlocks);
    
    // Step 4: プレースホルダーを置換
    renderedThinking.forEach((block, index) => {
        const placeholder = `[[[THINKING_${index}]]]`;
        
        //console.log(`Replacing ${placeholder} with thinking content (complete: ${block.isComplete}):`, block.content.substring(0, 100));
        //console.log("Thinking HTML:", block.html);
        //console.log("HTML contains placeholder?", renderedHtml.includes(placeholder));
        
        // プレースホルダーを置換（段落で囲まれている場合も考慮）
        const beforeReplace = renderedHtml;
        renderedHtml = renderedHtml.replace(new RegExp(`<p>\\[\\[\\[THINKING_${index}\\]\\]\\]</p>`, 'g'), block.html);
        renderedHtml = renderedHtml.replace(new RegExp(`\\[\\[\\[THINKING_${index}\\]\\]\\]`, 'g'), block.html);
        
        if (beforeReplace !== renderedHtml) {
            //console.log("Successfully replaced placeholder");
        } else {
            console.log("Failed to replace placeholder");
        }
    });
    
    const result = renderedHtml;
    //console.log("Final result:", result.substring(0, 300) + "...");
    
    return sanitizeAIResponse(result);
}

// HTMLエスケープ処理（既にレンダリング済みHTMLの基本サニタイズ）
export function sanitizeAIResponse(html) {
    if (!html || typeof html !== 'string') return '';
    
    // 危険なスクリプト系要素を除去
    let sanitized = html
        // 危険なHTMLタグを完全除去
        .replace(/<(script|style|iframe|object|embed|form)[^>]*>.*?<\/\1>/gis, '')
        .replace(/<(script|style|iframe|object|embed|form|input|textarea|select|button)[^>]*\/?>/gi, '')
        
        // on* イベントハンドラーを除去
        .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\s+on\w+\s*=\s*[^"'\s>]+/gi, '')
        
        // javascript: プロトコルを除去
        .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
        .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src="#"')
        
        // data: プロトコル（Base64エンコードされたスクリプト）を除去
        .replace(/href\s*=\s*["']data:text\/html[^"']*["']/gi, 'href="#"')
        .replace(/src\s*=\s*["']data:text\/html[^"']*["']/gi, 'src="#"');
    
    return sanitized;
}

// チャット内リンクを必ず新規タブで開く
export function ensureLinksOpenInNewTab(container) {
    try {
        if (!container) return;
        const anchors = container.querySelectorAll('a[href]');
        anchors.forEach(a => {
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
        });
    } catch (e) {
        console.error('リンク属性設定エラー:', e);
    }
}


// 入力欄で上/下矢印によりユーザー送信履歴を遡れるようにする
export function setupInputHistoryHotkeys(chat, historyManager) {
    const ta = chat?.inputArea?.textarea;
    if (!ta || ta._historyBound) return;
    ta._historyBound = true;
    // -1: draft（履歴外）/ 0..n: 最新=0 の逆順インデックス
    ta._historyCursor = -1;
    ta._historyDraft = '';

    const getUserMsgs = () => historyManager
        .getHistory()
        .filter(m => m.role === 'user')
        .map(m => m.content);

    const setValueAndMoveEnd = (v) => {
        ta.value = v ?? '';
        // 入力イベントを発火（オートリサイズ等のUI連動用）
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        // キャレットを末尾へ
        try {
            ta.selectionStart = ta.selectionEnd = ta.value.length;
        } catch(_) {}
    };

    ta.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            // テキスト先頭でのみ履歴ナビ発動（通常のキャレット移動を阻害しない）
            const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
            if (!atStart) return;
            const msgs = getUserMsgs();
            if (!msgs.length) return;
            e.preventDefault();
            if (ta._historyCursor === -1) {
                ta._historyDraft = ta.value;
                ta._historyCursor = 0;
            } else if (ta._historyCursor < msgs.length - 1) {
                ta._historyCursor += 1;
            }
            setValueAndMoveEnd(msgs[msgs.length - 1 - ta._historyCursor]);
        } else if (e.key === 'ArrowDown') {
            // テキスト末尾でのみ履歴ナビ（通常のキャレット移動を阻害しない）
            const atEnd = ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
            if (!atEnd) return;
            if (ta._historyCursor === -1) return; // 履歴ナビ未開始
            const msgs = getUserMsgs();
            e.preventDefault();
            if (ta._historyCursor > 0) {
                ta._historyCursor -= 1;
                setValueAndMoveEnd(msgs[msgs.length - 1 - ta._historyCursor]);
            } else {
                // draftへ復帰
                ta._historyCursor = -1;
                setValueAndMoveEnd(ta._historyDraft);
            }
        }
    });
}

export async function AIMerge(baseCode, aiCode, modelSelect, fetchAIChat, editor, currentFile, mConsole, editorEditor, customUrl = null, customApiKey = null) {
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
            customUrl: customUrl,
            customApiKey: customApiKey,
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
                console.warn("AI応答エラー:", errMsg);
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
        // contentがオブジェクトの場合（tool messageやtool_calls付きメッセージ）
        if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
            // contentがメッセージ全体の場合（role, content, tool_callsなどを含む）
            this.chatHistory.push(content);
        } else {
            // 通常のメッセージ
            this.chatHistory.push({role, content});
        }
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
            // contentが文字列の場合のみ処理（ツール呼び出しメッセージはスキップ）
            if (msg.content && typeof msg.content === 'string') {
                // 履歴復元時も新しい処理を適用
                const processedContent = processAIResponseWithDOM(msg.content);
                //console.log("Restoring AI message:", processedContent);
                chat.addMessage(processedContent, "ai", true);
            }
            // tool_callsがある場合は、ツール呼び出しを示すメッセージを表示
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                msg.tool_calls.forEach(toolCall => {
                    chat.addMessage(`🔧 ツール呼び出し: ${toolCall.function.name}`, "system");
                });
            }
        } else if (msg.role === "tool") {
            // ツール実行結果を表示
            chat.addMessage(`📋 ツール結果: ${msg.name}`, "system");
        }
    });
    
    // 自動スクロール状態を有効にリセット
    if (chat) {
        chat.autoScroll = true;
    }
    
    // スクロールを最下部に（DOM レンダリングを待つため setTimeout を使用）
    setTimeout(() => {
        if (chat.messages && chat.messages.container) {
            chat.messages.container.scrollTop = chat.messages.container.scrollHeight;
        } else if (chat.content && chat.content.element) {
            chat.content.element.scrollTop = chat.content.element.scrollHeight;
        }
    }, 0);
    
    // 復元後にリンク属性を調整
    ensureLinksOpenInNewTab(chat.content.element);
}

export async function loadModelList(chat, customApiConfig = null) {
    try {
        let res;
        
        // カスタムAPI設定がある場合は新しいエンドポイントを使用
        if (customApiConfig && customApiConfig.baseUrl && customApiConfig.apiKey) {
            console.log("Loading models from custom API:", customApiConfig.baseUrl);
            res = await fetch("/api/ai_custom_models.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    baseUrl: customApiConfig.baseUrl,
                    apiKey: customApiConfig.apiKey
                })
            });
        } else {
            // デフォルトのエンドポイントを使用
            res = await fetch("/api/ai_models.php");
        }
        
        if (!res.ok) throw new Error("モデル一覧取得失敗: " + res.status);
        const data = await res.json();
        if (!data.data || !Array.isArray(data.data)) throw new Error("モデルデータ不正");
        // nameを表示名に使う
        const models = data.data.map(m => ({ id: m.id, name: m.name }));
        
        // 保存されたモデルがあり、かつモデルリストに存在するかチェック
        const savedModel = loadSelectedModel();
        let defaultValue = undefined;
        
        if (savedModel && models.find(m => m.id === savedModel)) {
            // 保存されたモデルが有効な場合はそれを使用
            defaultValue = savedModel;
            console.log("Restored saved model:", savedModel);
        } else {
            // 保存されたモデルがない、または無効な場合はデフォルトモデルを探す
            let defaultModel = models.find(m => m.name && m.name.startsWith("Default("))
                || models.find(m => m.name && m.name.toLowerCase().includes("default"));
            defaultValue = defaultModel ? defaultModel.id : undefined;
        }
        
        const modelSelector = chat.createModelSelector({
            models: models,
            className: "meditor-chat-model-selector",
            style: { marginRight: "0.5em" },
            defaultValue: defaultValue,
            onChange: (selectedModelId) => {
                // モデルが変更されたら保存
                saveSelectedModel(selectedModelId);
                console.log("Model selection saved:", selectedModelId);
            }
        });
        
        return modelSelector;
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
            // MEditorのCLASS_NAME_PREFIX定数値を直接使用
            const classNamePrefix = 'meditor-';
            let historyElements = chat.content.element.querySelectorAll('.' + classNamePrefix + 'chat-message');
            for(let i=0; i<historyElements.length; i++) {
                historyElements[i].remove();
            }

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
    requestAIMergeAndPreview,
    customUrl = null,
    customApiKey = null,
    editor = null,
    mConsole = null,
    api = null,
    appState = null,  // APP_STATEを追加
    enableTools = true  // ツール機能を有効にするかどうか
}) {
    try {
        if(historyManager.getStreaming()) return;
        // 入力履歴ナビを初期化（初回のみバインド）
        setupInputHistoryHotkeys(chat, historyManager);
        const userMsg = chat.inputArea.textarea.value.trim();
        if(!userMsg) return;
        chat.inputArea.textarea.value = "";
        chat.inputArea.textarea.style.height = '';
        // 履歴カーソルをリセット
        chat.inputArea.textarea._historyCursor = -1;
        chat.inputArea.textarea._historyDraft = '';

        historyManager.addMessage("user", userMsg);
        historyManager.setStreaming(true);

        // ローディング表示
        if (typeof chat.showLoading === 'function') chat.showLoading();

        // AIツールの準備
        const aiTool = enableTools ? new AITool() : null;
        const tools = enableTools ? aiTool.getAvailableTools() : null;

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
        // AbortControllerをchatオブジェクトに保存してグローバルスコープで利用可能にする
        const controller = new AbortController();
        chat._abortController = controller;  // 生成停止用に保存
        const selectedModel = modelSelect.getValue() || undefined;
        aiMsgBuffer = "";
        
        // ツール呼び出しバッファ（ストリーム対応）
        let toolCallsBuffer = {};
        
        if (typeof fetchAIChat === 'function') {
            fetchAIChat({
                messages: historyManager.getHistory(),
                model: selectedModel,
                fileContext: fileContext ?? null,
                dirContext: dirContext ?? null,
                tools: tools,  // ツール定義を追加
                signal: controller.signal,
                smoothOutput: true, // スムーズ出力を有効化
                customUrl: customUrl,
                customApiKey: customApiKey,
                onDelta: async (delta, chunk, isSmooth, tool_calls) => {
                    // ツール呼び出しの処理
                    if (tool_calls && aiTool) {
                        // ツール呼び出し情報をバッファに追加（ストリームで少しずつ来る）
                        for (const toolCall of tool_calls) {
                            const index = toolCall.index ?? 0;  // indexがない場合は0をデフォルトに
                            if (!toolCallsBuffer[index]) {
                                toolCallsBuffer[index] = {
                                    id: toolCall.id || '',
                                    type: toolCall.type || 'function',
                                    function: {
                                        name: toolCall.function?.name || '',
                                        arguments: toolCall.function?.arguments || ''
                                    }
                                };
                            } else {
                                // 既存のバッファに追加
                                if (toolCall.id) toolCallsBuffer[index].id = toolCall.id;
                                if (toolCall.function?.name) {
                                    toolCallsBuffer[index].function.name += toolCall.function.name;
                                }
                                if (toolCall.function?.arguments) {
                                    toolCallsBuffer[index].function.arguments += toolCall.function.arguments;
                                }
                            }
                        }
                        return; // ツール呼び出し中はテキスト出力しない
                    }
                    
                    if (isSmooth) {
                        // スムーズ出力の場合はdeltaが完全なテキスト
                        aiMsgBuffer = delta;
                        const processedHtml = processAIResponseWithDOM(aiMsgBuffer);
                        chat.updateLastAIMessage(processedHtml, true);
                        ensureLinksOpenInNewTab(chat?.content?.element);
                    } else {
                        // 通常の場合は差分テキスト
                        aiMsgBuffer += delta;
                        const processedHtml = processAIResponseWithDOM(aiMsgBuffer);
                        chat.updateLastAIMessage(processedHtml, true);
                        ensureLinksOpenInNewTab(chat?.content?.element);
                    }
                },
                onError: (errMsg) => {
                    // AbortError の場合はユーザーが停止したと判定（通常エラー扱いしない）
                    if (errMsg === 'The operation was aborted.') {
                        console.log("AI生成がユーザーによって停止されました");
                        chat.updateLastAIMessage('<span style="color:#888">生成が停止されました</span>', true);
                    } else {
                        if (typeof errMsg === 'string') {
                            chat.updateLastAIMessage('<span style="color:red">AI応答エラー: '+errMsg+'</span>', true);
                            console.warn("AI応答エラー:", errMsg);
                        } else if (errMsg && errMsg.message) {
                            chat.updateLastAIMessage('<span style="color:red">AI応答エラー: '+errMsg.message+'</span>', true);
                            console.warn("AI応答エラー:", errMsg.message);
                        } else {
                            chat.updateLastAIMessage('<span style="color:red">不明なAI応答エラーが発生しました</span>', true);
                            console.warn("不明なAI応答エラー:", errMsg);
                        }
                    }
                    historyManager.setStreaming(false);
                    if (typeof chat.hideLoading === 'function') chat.hideLoading();

                }
            }).then(async () => {
                // ツール呼び出しを処理する関数（再帰的に呼び出し可能）
                const processToolCalls = async (depth = 0) => {
                    // 1度の呼び出しでの最大深度を制限
                    if (depth >= AI_CONFIG.TOOLS_MAX_COUNT) {
                        console.warn("Maximum tool call depth reached");
                        chat.addMessage(`⚠️ 最大ツール実行回数（${AI_CONFIG.TOOLS_MAX_COUNT}回）に到達しました`, "system");
                        
                        // 最大深度到達時も、現在のメッセージを履歴に追加
                        if (aiMsgBuffer) {
                            console.log("Final AI message (max depth reached):", aiMsgBuffer);
                            historyManager.addMessage("assistant", aiMsgBuffer);
                        }
                        
                        // 終了処理を実行
                        historyManager.setStreaming(false);
                        if (typeof chat.hideLoading === 'function') chat.hideLoading();
                        return;
                    }
                    
                    if (Object.keys(toolCallsBuffer).length === 0 || !aiTool) {
                        return;
                    }
                    
                    console.log(`Tool calls detected (depth ${depth}):`, toolCallsBuffer);
                    
                    // ツール呼び出し結果を格納
                    const toolResults = [];
                    
                    // 各ツールを順次実行
                    for (const index in toolCallsBuffer) {
                        const toolCall = toolCallsBuffer[index];
                        const toolName = toolCall.function.name;
                        let args;
                        
                        try {
                            args = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error("Failed to parse tool arguments:", e);
                            toolResults.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                name: toolName,
                                content: JSON.stringify({ success: false, error: "引数のパースに失敗しました" })
                            });
                            continue;
                        }
                        
                        // ツール実行コンテキストを準備
                        const toolContext = {
                            editor: editor,
                            mConsole: mConsole,
                            currentFile: currentFile,
                            api: api,
                            baseDir: baseDir,  // ベースディレクトリを追加
                            appState: appState  // APP_STATEを追加
                        };
                        
                        // チャットにツール実行通知を表示
                        chat.addMessage(`🔧 ツール実行中: ${toolName}`, "system");
                        // スクロール位置を更新
                        if (chat.content && chat.content.element) {
                            chat.content.element.scrollTop = chat.content.element.scrollHeight;
                        }
                        
                        // ツールを実行
                        const result = await aiTool.callTool(toolName, args, toolContext);
                        
                        // ツール側からのメッセージがある場合は表示
                        if (result.messages && Array.isArray(result.messages)) {
                            for (const msg of result.messages) {
                                if (typeof msg === 'string') {
                                    chat.addMessage(msg, "system");
                                } else if (msg.text && msg.type) {
                                    // {text: "メッセージ", type: "info"|"success"|"warning"|"error"}形式
                                    const icon = {
                                        info: 'ℹ️',
                                        success: '✅',
                                        warning: '⚠️',
                                        error: '❌'
                                    }[msg.type] || '';
                                    chat.addMessage(`${icon} ${msg.text}`, "system");
                                } else if (msg.text) {
                                    chat.addMessage(msg.text, "system");
                                }
                            }
                            // スクロール位置を更新
                            if (chat.content && chat.content.element) {
                                chat.content.element.scrollTop = chat.content.element.scrollHeight;
                            }
                        }
                        
                        // 結果をチャットに表示（デフォルトメッセージ）
                        if (result.success) {
                            // カスタムメッセージがない場合のみデフォルトメッセージを表示
                            if (!result.messages || result.messages.length === 0) {
                                chat.addMessage(`✅ ツール実行完了: ${toolName}`, "system");
                            }
                        } else {
                            chat.addMessage(`❌ ツール実行失敗: ${toolName} - ${result.error || '不明なエラー'}`, "system");
                        }
                        // スクロール位置を更新
                        if (chat.content && chat.content.element) {
                            chat.content.element.scrollTop = chat.content.element.scrollHeight;
                        }
                        
                        // ツール実行結果を履歴に追加
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: toolName,
                            content: JSON.stringify(result)
                        });
                    }
                    
                    // ツール実行結果を履歴に追加して、AIに再度問い合わせ
                    if (toolResults.length > 0) {
                        // AIのツール呼び出しメッセージを履歴に追加
                        const toolCallMessage = {
                            role: "assistant",
                            content: aiMsgBuffer || null,
                            tool_calls: Object.values(toolCallsBuffer)
                        };
                        // メッセージ全体をそのまま追加（第2引数にオブジェクトを渡す）
                        historyManager.addMessage("assistant", toolCallMessage);
                        
                        // ツール実行結果を履歴に追加
                        for (const toolResult of toolResults) {
                            // ツールメッセージ全体をそのまま追加
                            historyManager.addMessage("tool", toolResult);
                        }
                        
                        // AIに再度問い合わせ（ツール実行結果を含む）
                        historyManager.setStreaming(true);
                        aiMsgBuffer = "";
                        toolCallsBuffer = {};
                        
                        chat.addMessage("", "ai", true);
                        
                        await fetchAIChat({
                            messages: historyManager.getHistory(),
                            model: selectedModel,
                            fileContext: fileContext ?? null,
                            dirContext: dirContext ?? null,
                            tools: tools,
                            signal: controller.signal,
                            smoothOutput: true,
                            customUrl: customUrl,
                            customApiKey: customApiKey,
                            onDelta: (delta, chunk, isSmooth, tool_calls) => {
                                // 2回目以降のツール呼び出しにも対応
                                if (tool_calls && aiTool) {
                                    for (const toolCall of tool_calls) {
                                        const index = toolCall.index ?? 0;
                                        if (!toolCallsBuffer[index]) {
                                            toolCallsBuffer[index] = {
                                                id: toolCall.id || '',
                                                type: toolCall.type || 'function',
                                                function: {
                                                    name: toolCall.function?.name || '',
                                                    arguments: toolCall.function?.arguments || ''
                                                }
                                            };
                                        } else {
                                            if (toolCall.id) toolCallsBuffer[index].id = toolCall.id;
                                            if (toolCall.function?.name) {
                                                toolCallsBuffer[index].function.name += toolCall.function.name;
                                            }
                                            if (toolCall.function?.arguments) {
                                                toolCallsBuffer[index].function.arguments += toolCall.function.arguments;
                                            }
                                        }
                                    }
                                    return; // ツール呼び出し中はテキスト出力しない
                                }
                                
                                if (isSmooth) {
                                    aiMsgBuffer = delta;
                                    const processedHtml = processAIResponseWithDOM(aiMsgBuffer);
                                    chat.updateLastAIMessage(processedHtml, true);
                                    ensureLinksOpenInNewTab(chat?.content?.element);
                                } else {
                                    aiMsgBuffer += delta;
                                    const processedHtml = processAIResponseWithDOM(aiMsgBuffer);
                                    chat.updateLastAIMessage(processedHtml, true);
                                    ensureLinksOpenInNewTab(chat?.content?.element);
                                }
                            },
                            onError: (errMsg) => {
                                // AbortError の場合はユーザーが停止したと判定（通常エラー扱いしない）
                                if (errMsg === 'The operation was aborted.') {
                                    console.log("AI生成がユーザーによって停止されました");
                                    chat.updateLastAIMessage('<span style="color:#888">生成が停止されました</span>', true);
                                } else {
                                    chat.updateLastAIMessage('<span style="color:red">AI応答エラー: '+errMsg+'</span>', true);
                                    console.error("AI応答エラー:", errMsg);
                                }
                                historyManager.setStreaming(false);
                                if (typeof chat.hideLoading === 'function') chat.hideLoading();
                            }
                        }).then(async () => {
                            // 2回目以降のツール呼び出しを処理
                            await processToolCalls(depth + 1);
                            
                            // すべてのツール実行が完了したら終了処理
                            if (Object.keys(toolCallsBuffer).length === 0) {
                                console.log("Final AI message:", aiMsgBuffer);
                                historyManager.addMessage("assistant", aiMsgBuffer);
                                historyManager.setStreaming(false);
                                if (typeof chat.hideLoading === 'function') chat.hideLoading();
                                ensureLinksOpenInNewTab(chat?.content?.element);
                            }
                        });
                    }
                };
                
                // 最初のツール呼び出しを処理
                await processToolCalls(0);
                
                // ツール呼び出しがない場合は通常の終了処理
                if (Object.keys(toolCallsBuffer).length === 0) {
                    console.log("Final AI message:", aiMsgBuffer);
                    historyManager.addMessage("assistant", aiMsgBuffer);
                    historyManager.setStreaming(false);
                    if (typeof chat.hideLoading === 'function') chat.hideLoading();
                    ensureLinksOpenInNewTab(chat?.content?.element);
                }
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
