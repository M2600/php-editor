/**
 * AI チャット機能
 */

import { CONFIG } from '../core/config.js';
import { AI_CONFIG } from '../core/config.js';
import { loadSelectedModel, saveSelectedModel } from '../utils/cookie.js';

// AIToolクラスをインポート
import { AITool } from './ai-tool.js';
export { AITool };

/**
 * モデルの機能を判別するヘルパー関数
 */
export const ModelCapabilities = {
    /**
     * モデルがVision（画像入力）に対応しているか判別
     * @param {string} modelId - モデルID
     * @returns {boolean}
     */
    supportsVision(modelId) {
        if (!modelId) return false;
        const id = modelId.toLowerCase();
        
        // OpenAI Vision対応モデル
        if (id.includes('gpt-4o') || id.includes('gpt-4-turbo') || id.includes('gpt-4-vision')) {
            return true;
        }
        
        // Claude Vision対応モデル
        if (id.includes('claude-3')) {
            return true;
        }
        
        // Gemini Vision対応モデル
        if (id.includes('gemini') && id.includes('vision')) {
            return true;
        }
        
        return false;
    },
    
    /**
     * モデルがFunction Calling（ツール）に対応しているか判別
     * @param {string} modelId - モデルID
     * @returns {boolean}
     */
    supportsTools(modelId) {
        if (!modelId) return false;
        const id = modelId.toLowerCase();
        
        // OpenAI Function Calling対応モデル
        if (id.includes('gpt-4') || id.includes('gpt-3.5-turbo')) {
            return true;
        }
        
        // Claude Tool Use対応モデル
        if (id.includes('claude-3')) {
            return true;
        }
        
        // Gemini Function Calling対応モデル
        if (id.includes('gemini-1.5') || id.includes('gemini-pro')) {
            return true;
        }
        
        return false;
    },
    
    /**
     * モデルの機能情報を取得
     * @param {string} modelId - モデルID
     * @returns {Object} {vision: boolean, tools: boolean}
     */
    getCapabilities(modelId) {
        return {
            vision: this.supportsVision(modelId),
            tools: this.supportsTools(modelId)
        };
    },
    
    /**
     * モデルの機能を文字列で取得（UI表示用）
     * @param {string} modelId - モデルID
     * @returns {string}
     */
    getCapabilitiesString(modelId) {
        const caps = this.getCapabilities(modelId);
        const features = [];
        if (caps.vision) features.push('📷 Vision');
        if (caps.tools) features.push('🔧 Tools');
        return features.length > 0 ? ` (${features.join(', ')})` : '';
    }
};

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

/**
 * ツール実行結果を圧縮（大きな結果を要約）
 * @param {Object} toolResult - ツール実行結果（tool messageオブジェクト）
 * @returns {Object} - 圧縮されたツール結果
 */
function compressToolResult(toolResult) {
    const MAX_CONTENT_LENGTH = 2000; // 2000文字以上は圧縮対象
    
    // contentをパース
    let parsedContent;
    try {
        parsedContent = typeof toolResult.content === 'string' 
            ? JSON.parse(toolResult.content) 
            : toolResult.content;
    } catch (e) {
        // パースできない場合はそのまま返す
        return toolResult;
    }
    
    const contentStr = JSON.stringify(parsedContent);

    // searchFilesは結果自体が大きくなりやすいため、常に短い要約へ変換する
    if (toolResult.name === 'searchFiles' && parsedContent.results) {
        const summaryLines = [];
        const query = parsedContent.query || '';
        const resultsCount = parsedContent.resultsCount ?? (Array.isArray(parsedContent.results) ? parsedContent.results.length : 0);
        const filesSearched = parsedContent.filesSearched ?? '-';

        if (parsedContent.message && typeof parsedContent.message === 'string') {
            summaryLines.push(parsedContent.message.trim());
        } else if (query) {
            summaryLines.push(`✅ searchFiles: "${query}"`);
        } else {
            summaryLines.push('✅ searchFiles: 検索結果');
        }

        summaryLines.push(`ヒット: ${resultsCount}件 / 検索ファイル数: ${filesSearched}件`);

        const sampleResults = parsedContent.results.slice(0, 3);
        if (sampleResults.length > 0) {
            summaryLines.push('主な対象:');
            for (const result of sampleResults) {
                if (result.matchType === 'filename') {
                    summaryLines.push(`- ${result.file} (ファイル名一致)`);
                } else {
                    const matchCount = result.matchCount ?? (Array.isArray(result.matches) ? result.matches.length : 0);
                    summaryLines.push(`- ${result.file} (${matchCount}箇所)`);
                }
            }
            if (parsedContent.results.length > sampleResults.length) {
                summaryLines.push(`... 他${parsedContent.results.length - sampleResults.length}件`);
            }
        }

        return {
            ...toolResult,
            content: summaryLines.join('\n'),
            compressed: true,
            summaryType: 'searchFiles',
            originalResultsCount: resultsCount,
            originalFilesSearched: filesSearched
        };
    }
    
    // 小さい結果はそのまま返す
    if (contentStr.length <= MAX_CONTENT_LENGTH) {
        return toolResult;
    }
    
    // 圧縮処理
    const compressed = { ...parsedContent };
    let compressionApplied = false;
    
    // readFileの結果圧縮
    if (toolResult.name === 'readFile' && parsedContent.content) {
        const contentLength = parsedContent.content.length;
        if (contentLength > MAX_CONTENT_LENGTH) {
            // 構造情報がある場合はそれを優先
            if (parsedContent.structure) {
                compressed.content = `[圧縮済み: ${contentLength}文字]\n\n構造情報:\n${JSON.stringify(parsedContent.structure, null, 2)}`;
                compressed.compressed = true;
                compressed.originalLength = contentLength;
                compressionApplied = true;
            } else {
                // 構造情報がない場合は冒頭と末尾のみ保持
                const head = parsedContent.content.substring(0, 500);
                const tail = parsedContent.content.substring(contentLength - 500);
                compressed.content = `[圧縮済み: ${contentLength}文字]\n\n=== 冒頭500文字 ===\n${head}\n\n=== 末尾500文字 ===\n${tail}`;
                compressed.compressed = true;
                compressed.originalLength = contentLength;
                compressed.hint = "完全な内容が必要な場合は、startLineとendLineを指定して再度readFileを実行してください";
                compressionApplied = true;
            }
        }
    }
    
    // searchFilesの結果圧縮
    else if (toolResult.name === 'searchFiles' && parsedContent.results) {
        const resultsCount = parsedContent.results.length;
        if (resultsCount > 20) {
            // 結果が多すぎる場合は最初の20件のみ保持
            compressed.results = parsedContent.results.slice(0, 20);
            compressed.compressed = true;
            compressed.truncated = true;
            compressed.originalResultsCount = resultsCount;
            compressed.hint = `${resultsCount}件中20件のみ表示。より絞り込んだ検索をお勧めします`;
            compressionApplied = true;
        } else if (parsedContent.results.some(r => r.matches && r.matches.length > 5)) {
            // 各ファイルのマッチ数を制限
            compressed.results = parsedContent.results.map(result => {
                if (result.matches && result.matches.length > 5) {
                    return {
                        ...result,
                        matches: result.matches.slice(0, 5),
                        truncatedMatches: result.matches.length - 5
                    };
                }
                return result;
            });
            compressed.compressed = true;
            compressionApplied = true;
        }
    }
    
    // lsの結果圧縮
    else if (toolResult.name === 'ls' && parsedContent.files) {
        const totalItems = (parsedContent.files?.length || 0) + (parsedContent.directories?.length || 0);
        if (totalItems > 100) {
            // ファイル数が多すぎる場合
            compressed.files = parsedContent.files?.slice(0, 50) || [];
            compressed.directories = parsedContent.directories?.slice(0, 50) || [];
            compressed.compressed = true;
            compressed.truncated = true;
            compressed.originalFileCount = parsedContent.files?.length || 0;
            compressed.originalDirCount = parsedContent.directories?.length || 0;
            compressed.hint = `ファイル数が多いため最初の50件のみ表示`;
            compressionApplied = true;
        }
    }
    
    // 圧縮が適用された場合
    if (compressionApplied) {
        console.log(`Tool result compressed: ${toolResult.name}`, {
            original: contentStr.length,
            compressed: JSON.stringify(compressed).length,
            reduction: `${Math.round((1 - JSON.stringify(compressed).length / contentStr.length) * 100)}%`
        });
        
        return {
            ...toolResult,
            content: JSON.stringify(compressed),
            _compressionApplied: true,
            _originalLength: contentStr.length
        };
    }
    
    // 圧縮不要の場合はそのまま返す
    return toolResult;
}

/**
 * ツール履歴メタ情報を安全なサイズに整形
 * ローカル表示向けのため、文字列長と配列長を制限する
 */
function sanitizeToolHistoryMeta(historyMeta, toolName) {
    if (!historyMeta || typeof historyMeta !== 'object' || Array.isArray(historyMeta)) {
        return null;
    }

    const MAX_STRING_LENGTH = 200;
    const MAX_ARRAY_ITEMS = 20;
    const MAX_DEPTH = 3;

    const compactValue = (value, depth = 0) => {
        if (depth > MAX_DEPTH) {
            return '[truncated]';
        }
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof value === 'string') {
            return value.length > MAX_STRING_LENGTH
                ? `${value.substring(0, MAX_STRING_LENGTH)}...`
                : value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.slice(0, MAX_ARRAY_ITEMS).map(item => compactValue(item, depth + 1));
        }
        if (typeof value === 'object') {
            const compacted = {};
            Object.entries(value).forEach(([key, val]) => {
                compacted[key] = compactValue(val, depth + 1);
            });
            return compacted;
        }
        return String(value);
    };

    const compactedMeta = compactValue(historyMeta);
    return {
        version: 1,
        tool: toolName,
        ...compactedMeta
    };
}

/**
 * ツール履歴メタ情報をチャット表示向けの短文に変換
 */
function formatToolHistoryMetaSummary(toolName, historyMeta) {
    if (!historyMeta || typeof historyMeta !== 'object') {
        return '';
    }

    if ((toolName === 'ls' || historyMeta.operation === 'list') && historyMeta.directoryPath) {
        const fileCount = historyMeta.fileCount ?? 0;
        const directoryCount = historyMeta.directoryCount ?? 0;
        const totalCount = historyMeta.totalCount ?? (fileCount + directoryCount);
        return `${historyMeta.directoryPath} / ${totalCount}件 (dir:${directoryCount}, file:${fileCount})`;
    }

    if (historyMeta.targetPath) {
        const base = [historyMeta.targetPath];
        if (typeof historyMeta.addedLines === 'number' || typeof historyMeta.deletedLines === 'number') {
            base.push(`+${historyMeta.addedLines ?? 0}/-${historyMeta.deletedLines ?? 0}`);
        } else if (typeof historyMeta.linesRead === 'number') {
            base.push(`read:${historyMeta.linesRead}行`);
        }
        return base.join(' / ');
    }

    return '';
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

// 数式ブロックを抽出・保護する関数
export function protectMathBlocks(text) {
    const mathBlocks = [];
    let processedText = text;
    
    // LaTeX形式のブロック数式 \[...\] を抽出（複数行対応）
    processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
        const index = mathBlocks.length;
        const blockId = `[[[MATH_${index}]]]`;
        mathBlocks.push({
            id: blockId,
            content: match,  // \[...\]を含めて保存
            type: 'block',
            index: index
        });
        return blockId;
    });
    
    // LaTeX形式のインライン数式 \(...\) を抽出 - より貪欲でないマッチング
    processedText = processedText.replace(/\\\([^)]*?\\\)/g, (match) => {
        const index = mathBlocks.length;
        const blockId = `[[[MATH_${index}]]]`;
        mathBlocks.push({
            id: blockId,
            content: match,  // \(...\)を含めて保存
            type: 'inline',
            index: index
        });
        return blockId;
    });
    
    // $$...$$形式のブロック数式を抽出（複数行対応）
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
        const index = mathBlocks.length;
        const blockId = `[[[MATH_${index}]]]`;
        mathBlocks.push({
            id: blockId,
            content: match,  // $$を含めて保存
            type: 'block',
            index: index
        });
        return blockId;
    });
    
    // $...$形式のインライン数式を抽出
    processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, content) => {
        const index = mathBlocks.length;
        const blockId = `[[[MATH_${index}]]]`;
        mathBlocks.push({
            id: blockId,
            content: match,  // $を含めて保存
            type: 'inline',
            index: index
        });
        return blockId;
    });
    return {
        processedText,
        mathBlocks
    };
}

// 数式ブロックを復元する関数
export function restoreMathBlocks(html, mathBlocks) {
    let restoredHtml = html;
    
    mathBlocks.forEach((block) => {
        const placeholder = `[[[MATH_${block.index}]]]`;
        
        // エスケープされた特殊文字に対応
        const escapedPlaceholder = placeholder.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        
        // プレースホルダーを数式に戻す（段落タグで囲まれている場合も考慮）
        restoredHtml = restoredHtml.replace(
            new RegExp(`<p>${escapedPlaceholder}</p>`, 'g'), 
            block.content
        );
        restoredHtml = restoredHtml.replace(
            new RegExp(escapedPlaceholder, 'g'), 
            block.content
        );
    });
    
    return restoredHtml;
}

// DOM操作を使った安全なthinking処理（ストリーム対応）
export function processAIResponseWithDOM(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Step 0: 数式ブロックを保護
    const { processedText: mathProtectedText, mathBlocks } = protectMathBlocks(text);
    
    // Step 1: Thinkingブロックを抽出（完了・未完了両方）
    const { processedText, thinkingBlocks } = processThinkingBlocks(mathProtectedText);
    //console.log("Extracted thinking blocks:", thinkingBlocks.length);
    // console.log("Thinking blocks:", thinkingBlocks.map(b => ({
    //     content: b.content.substring(0, 50) + "...",
    //     isComplete: b.isComplete
    // })));
    
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
    
    // Step 5: 数式ブロックを復元
    renderedHtml = restoreMathBlocks(renderedHtml, mathBlocks);
    
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

// 数式をレンダリングする関数（KaTeX使用）
export function renderMathInElement(element) {
    if (!element) return;
    
    // KaTeX の auto-render が読み込まれているか確認
    if (typeof window.renderMathInElement === 'undefined') {
        console.warn('KaTeX auto-render が読み込まれていません');
        return;
    }
    
    try {
        // KaTeX の自動レンダリング機能を使用
        window.renderMathInElement(element, {
            delimiters: [
                {left: '$$', right: '$$', display: true},   // ブロック数式
                {left: '$', right: '$', display: false},    // インライン数式
                {left: '\\(', right: '\\)', display: false}, // LaTeX形式インライン
                {left: '\\[', right: '\\]', display: true}   // LaTeX形式ブロック
            ],
            throwOnError: false,  // エラー時も処理を継続
            errorColor: '#cc0000', // エラー時の色
            strict: false  // 厳密なLaTeX構文チェックを無効化
        });
    } catch (e) {
        console.error('数式レンダリングエラー:', e);
    }
}

// チャット内リンクを必ず新規タブで開く + 数式レンダリング
export function ensureLinksOpenInNewTab(container) {
    try {
        if (!container) return;
        const anchors = container.querySelectorAll('a[href]');
        anchors.forEach(a => {
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
        });
        
        // 数式レンダリングを実行
        renderMathInElement(container);
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

export async function AIMerge(baseCode, aiCode, modelSelect, fetchAIChat, editor, currentFile, mConsole, editorEditor, customUrl = null, customApiKey = null, customPrompt = null) {
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
            customPrompt: customPrompt, // ベースプロンプトを渡す
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
            // 画像を除外した履歴を作成（localStorage容量節約）
            const storageHistory = this.chatHistory.map(msg => {
                if (msg.role === 'user' && Array.isArray(msg.content)) {
                    // content配列から画像を除外し、テキストのみ保存
                    // これによりリロード後もAPI互換性を保つ
                    const textParts = [];
                    msg.content.forEach(item => {
                        if (item.type === 'text') {
                            textParts.push(item.text);
                        } else if (item.type === 'image_url') {
                            // 画像はファイル名として記録
                            const filename = item.image_url?.filename || '画像ファイル';
                            textParts.push(`[画像: ${filename}]`);
                        }
                    });
                    // content配列を単一の文字列に変換（API互換）
                    return {...msg, content: textParts.join('\n\n')};
                }
                return msg;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(storageHistory));
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
            // 通常のメッセージ（画像を含むcontent配列もそのまま保存）
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

    getHistoryForAPI() {
        // history_metaはローカル表示用のため、API送信時には除外する
        return this.chatHistory.map(msg => {
            if (!msg || typeof msg !== 'object') {
                return msg;
            }
            if (Object.prototype.hasOwnProperty.call(msg, 'history_meta')) {
                const { history_meta, ...rest } = msg;
                return rest;
            }
            return msg;
        });
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
            // content配列形式（Vision API）またはテキスト形式に対応
            if (Array.isArray(msg.content)) {
                // content配列の場合、テキストと画像ファイル名を抽出して表示
                const textParts = [];
                const attachments = [];
                
                msg.content.forEach(item => {
                    if (item.type === 'text') {
                        textParts.push(item.text);
                    } else if (item.type === 'image_url') {
                        const filename = item.image_url?.filename || '画像ファイル';
                        attachments.push(`📎 ${filename}`);
                    }
                });
                
                // テキストと添付ファイル情報を結合
                const displayParts = [];
                if (textParts.length > 0) {
                    displayParts.push(textParts.join('\n'));
                }
                if (attachments.length > 0) {
                    displayParts.push(attachments.join('\n'));
                }
                
                const displayText = displayParts.length > 0 ? displayParts.join('\n\n') : '(メッセージ)';
                chat.addMessage(displayText, "user");
            } else {
                // 通常のテキスト形式
                chat.addMessage(msg.content, "user");
            }
        } else if (msg.role === "assistant") {
            // contentが文字列の場合のみ処理（ツール呼び出しメッセージはスキップ）
            if (msg.content && typeof msg.content === 'string') {
                // JSON破損による不正なエスケープシーケンスを修復
                let sanitizedContent = msg.content;
                // 単独の\[や\]が含まれる場合は\\[や\\]に修正（JSONパース後の状態を想定）
                // ただし、既に正しくエスケープされている場合は変更しない
                if (sanitizedContent.includes('\\[') || sanitizedContent.includes('\\]') || 
                    sanitizedContent.includes('\\(') || sanitizedContent.includes('\\)')) {
                    // バックスラッシュが既に含まれている場合は、そのまま使用
                    // （正常にパースされた状態）
                } else if (sanitizedContent.includes('[') || sanitizedContent.includes(']')) {
                    // [や]が含まれているが\が無い場合は、通常のテキストとして扱う
                    // （数式ではない）
                }
                
                // 履歴復元時も新しい処理を適用
                const processedContent = processAIResponseWithDOM(sanitizedContent);
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
            const summary = formatToolHistoryMetaSummary(msg.name, msg.history_meta);
            if (summary) {
                chat.addMessage(`📋 ツール結果: ${msg.name} (${summary})`, "system");
            } else {
                chat.addMessage(`📋 ツール結果: ${msg.name}`, "system");
            }
        }
    });
    
    // 全メッセージ追加後、stats情報を一括で追加
    setTimeout(() => {
        let aiMsgs;
        if (chat.messages && chat.messages.container) {
            aiMsgs = chat.messages.container.querySelectorAll('.meditor-chat-message-ai');
        } else if (chat.content && chat.content.element) {
            aiMsgs = chat.content.element.querySelectorAll('.meditor-chat-message-ai');
        }
        
        if (aiMsgs) {
            // assistant メッセージのみを抽出（tool_callsがないもの）
            const assistantMessages = chatHistory.filter(msg => 
                msg.role === 'assistant' && msg.content && typeof msg.content === 'string'
            );
            
            console.log('AIメッセージ数:', aiMsgs.length, 'assistant履歴数:', assistantMessages.length);
            console.log('全履歴:', chatHistory.map((m, i) => ({
                index: i,
                role: m.role,
                hasContent: !!m.content,
                hasStats: !!m._stats,
                stats: m._stats
            })));
            
            // 各AIメッセージに対応するstatsを追加
            aiMsgs.forEach((aiMsg, index) => {
                if (index < assistantMessages.length) {
                    let stats = assistantMessages[index]._stats;
                    
                    // stats情報がない場合のフォールバック（古い履歴用）
                    if (!stats) {
                        // 現在選択されているモデルを使用
                        const modelSelect = document.querySelector('.meditor-chat-model-selector');
                        if (modelSelect && modelSelect.value) {
                            stats = { model: modelSelect.value };
                        }
                    }
                    
                    console.log(`メッセージ${index}:`, stats);
                    if (stats && stats.model) {
                        // 既にstatsが表示されていないかチェック
                        if (!aiMsg.querySelector('.meditor-chat-stats')) {
                            const statsDiv = document.createElement('div');
                            statsDiv.className = 'meditor-chat-stats';
                            const modelSpan = document.createElement('span');
                            modelSpan.className = 'meditor-chat-stats-model';
                            modelSpan.textContent = '🤖 ' + stats.model;
                            statsDiv.appendChild(modelSpan);
                            aiMsg.appendChild(statsDiv);
                        }
                    }
                }
            });
        }
    }, 100);
    
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
        
        // DOM更新後にリンク属性と数式レンダリングを実行
        ensureLinksOpenInNewTab(chat.content.element);
    }, 100);  // タイミングを少し遅らせる
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
        
        // モデルIDと名前、機能情報を含むオブジェクトを作成
        const models = data.data.map(m => {
            const capabilities = ModelCapabilities.getCapabilitiesString(m.id);
            return {
                id: m.id,
                name: m.name + capabilities,
                rawName: m.name,
                supportsVision: ModelCapabilities.supportsVision(m.id),
                supportsTools: ModelCapabilities.supportsTools(m.id)
            };
        });
        
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
        
        // モデルの機能情報を取得するメソッドを追加
        modelSelector.getModelCapabilities = (modelId) => {
            if (!modelId) {
                modelId = modelSelector.getValue();
            }
            return ModelCapabilities.getCapabilities(modelId);
        };
        
        // 現在選択中のモデルが指定の機能をサポートしているか確認
        modelSelector.supportsVision = () => {
            const modelId = modelSelector.getValue();
            return ModelCapabilities.supportsVision(modelId);
        };
        
        modelSelector.supportsTools = () => {
            const modelId = modelSelector.getValue();
            return ModelCapabilities.supportsTools(modelId);
        };
        
        // モデル情報を保存
        modelSelector._modelsData = models;
        
        // デバッグ情報：選択されたモデルの機能を表示
        const currentModel = modelSelector.getValue();
        if (currentModel) {
            const caps = ModelCapabilities.getCapabilities(currentModel);
            console.log(`Selected model: ${currentModel}`);
            console.log(`  - Vision support: ${caps.vision ? '✓' : '✗'}`);
            console.log(`  - Tools support: ${caps.tools ? '✓' : '✗'}`);
        }
        
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
    customPrompt = null,  // ベースプロンプトを追加
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
        
        // メッセージも添付ファイルもない場合のみreturn
        if(!userMsg && (!chat.attachedFiles || chat.attachedFiles.length === 0)) return;
        
        // ユーザーメッセージを構築（添付ファイルがある場合はcontent配列形式）
        let userMessage;
        if (chat.attachedFiles && chat.attachedFiles.length > 0) {
            // Vision API形式: content配列
            const contentArray = [];
            
            // テキストメッセージを追加
            if (userMsg) {
                contentArray.push({
                    type: 'text',
                    text: userMsg
                });
            }
            
            // 添付ファイルを追加
            chat.attachedFiles.forEach(file => {
                if (file.fileType === 'image') {
                    // 画像ファイル: Vision API形式
                    contentArray.push({
                        type: 'image_url',
                        image_url: {
                            url: file.content,  // data:image/...;base64,...
                            filename: file.name  // ファイル名を記録
                        }
                    });
                } else {
                    // テキストファイル: コードブロックとして追加
                    const fileContent = `[添付ファイル: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\``;
                    contentArray.push({
                        type: 'text',
                        text: fileContent
                    });
                }
            });
            
            // content配列形式の場合は配列をそのまま履歴に保存
            userMessage = contentArray;
            console.log("Sending message with attachments:", chat.attachedFiles.length, "files");
        } else {
            // 通常のテキストメッセージ
            userMessage = userMsg;
        }
        
        chat.inputArea.textarea.value = "";
        chat.inputArea.textarea.style.height = '';
        // 履歴カーソルをリセット
        chat.inputArea.textarea._historyCursor = -1;
        chat.inputArea.textarea._historyDraft = '';

        // 添付ファイルをクリア
        if (chat.attachedFiles && chat.attachedFiles.length > 0) {
            chat.clearAttachedFiles();
        }

        historyManager.addMessage("user", userMessage);
        
        // ユーザーメッセージをUIに表示
        if (Array.isArray(userMessage)) {
            // content配列形式の場合
            const textParts = [];
            const attachments = [];
            
            userMessage.forEach(item => {
                if (item.type === 'text') {
                    textParts.push(item.text);
                } else if (item.type === 'image_url') {
                    const filename = item.image_url?.filename || '画像ファイル';
                    attachments.push(`📎 ${filename}`);
                }
            });
            
            const displayParts = [];
            if (textParts.length > 0) {
                displayParts.push(textParts.join('\n'));
            }
            if (attachments.length > 0) {
                displayParts.push(attachments.join('\n'));
            }
            
            chat.addMessage(displayParts.join('\n\n'), "user");
        } else {
            // 通常のテキストメッセージ
            chat.addMessage(userMessage, "user");
        }
        
        historyManager.setStreaming(true);

        // ローディング表示
        if (typeof chat.showLoading === 'function') chat.showLoading();

        // AIツールの準備
        const aiTool = enableTools ? new AITool() : null;
        const tools = enableTools ? aiTool.getAvailableTools() : null;

        // AIメッセージ表示用
        let aiMsgBuffer = "";
        let hasFinalAssistantMessageSaved = false;
        const finalizeAssistantResponse = () => {
            if (hasFinalAssistantMessageSaved) {
                return;
            }
            hasFinalAssistantMessageSaved = true;
            console.log("Final AI message:", aiMsgBuffer);
            historyManager.addMessage("assistant", aiMsgBuffer);
            historyManager.setStreaming(false);
            if (typeof chat.hideLoading === 'function') chat.hideLoading();
            ensureLinksOpenInNewTab(chat?.content?.element);
        };
        // まず空のAIメッセージを追加
        chat.addMessage("", "ai", true);
        setTimeout(() => {
            chat.addApplyToCodeButtonsToChat(async (aiCode) => {
                await requestAIMergeAndPreview(aiCode);
            });
        }, 0);

        // 送信履歴を制限
        historyManager.limitHistory(CONFIG.MAX_CHAT_HISTORY);

        // ファイル内容を送信するか判定（ツール無効時のみ）
        let fileContext = null;
        if (!enableTools) {
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
        } else {
            // ツール有効時はファイルコンテキストを送信しない
            if (typeof chat.setFileContextInfo === 'function') {
                chat.setFileContextInfo(null);
            }
            console.log("Tools enabled: File context disabled");
        }

        // ディレクトリコンテキストを生成（ツール無効時のみ）
        let dirContext = null;
        if (!enableTools) {
            dirContext = generateDirectoryContext(fileList, baseDir);
            if (dirContext) {
                console.log("Sending directory context:", dirContext);
            }
        } else {
            console.log("Tools enabled: Directory context disabled");
        }

        // ストリーム受信（ai_api.js利用）
        // AbortControllerをchatオブジェクトに保存してグローバルスコープで利用可能にする
        const controller = new AbortController();
        chat._abortController = controller;  // 生成停止用に保存
        const selectedModel = modelSelect.getValue() || undefined;
        const logToolInvocationError = async ({ toolName, parameters, errorCode, message, toolCallId = null }) => {
            try {
                await api('/api/tool_history.php', {
                    action: 'logToolExecution',
                    tool: toolName || 'unknown',
                    parameters: parameters || {},
                    status: 'error',
                    result: {
                        error: errorCode,
                        message,
                        phase: 'invocation',
                        toolCallId
                    },
                    approvalTime: null,
                    model: selectedModel || 'unknown'
                });
            } catch (error) {
                console.error('呼び出し時エラーログ送信に失敗:', error);
            }
        };
        aiMsgBuffer = "";
        
        // ツール呼び出しバッファ（ストリーム対応）
        let toolCallsBuffer = {};
        let initialRequestStats = null;
        
        if (typeof fetchAIChat === 'function') {
            fetchAIChat({
                messages: historyManager.getHistoryForAPI(),
                model: selectedModel,
                fileContext: fileContext ?? null,
                dirContext: dirContext ?? null,
                tools: tools,  // ツール定義を追加
                signal: controller.signal,
                smoothOutput: true, // スムーズ出力を有効化
                customUrl: customUrl,
                customApiKey: customApiKey,
                customPrompt: customPrompt,  // ベースプロンプトを渡す
                onComplete: (stats) => {
                    initialRequestStats = stats;
                    // MEditorの統計情報表示メソッドを呼び出し
                    if (chat.addStatsToLastAIMessage) {
                        chat.addStatsToLastAIMessage(stats);
                    }
                    // HistoryManagerの最後のassistantメッセージにstatsを追加
                    // （tool_callsがないメッセージのみ）
                    const history = historyManager.getHistory();
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (history[i].role === 'assistant') {
                            // tool_callsがあるメッセージはスキップ
                            if (history[i].tool_calls && history[i].tool_calls.length > 0) {
                                continue;
                            }
                            // contentがあるメッセージにのみstatsを保存
                            if (history[i].content) {
                                history[i]._stats = stats;
                                historyManager.saveChatHistory();
                                break;
                            }
                        }
                    }
                },
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
                if (initialRequestStats && initialRequestStats.wasEmptyResponse) {
                    chat.updateLastAIMessage('<span style="color:red">AI応答が空でした。再試行しても応答が得られませんでした。</span>', true);
                    historyManager.setStreaming(false);
                    if (typeof chat.hideLoading === 'function') chat.hideLoading();
                    return;
                }

                // ツール呼び出しを処理する関数（再帰的に呼び出し可能）
                const processToolCalls = async (depth = 0) => {
                    // 1度の呼び出しでの最大深度を制限
                    if (depth >= AI_CONFIG.TOOLS_MAX_COUNT) {
                        console.warn("Maximum tool call depth reached");
                        chat.addMessage(`⚠️ 最大ツール実行回数（${AI_CONFIG.TOOLS_MAX_COUNT}回）に到達しました`, "system");
                        
                        // 最大深度到達時も、現在のメッセージを履歴に1回だけ追加
                        if (aiMsgBuffer) {
                            finalizeAssistantResponse();
                        } else {
                            historyManager.setStreaming(false);
                            if (typeof chat.hideLoading === 'function') chat.hideLoading();
                        }
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
                            await logToolInvocationError({
                                toolName,
                                parameters: { rawArguments: toolCall.function.arguments },
                                errorCode: 'tool_arguments_parse_failed',
                                message: '引数のJSONパースに失敗しました',
                                toolCallId: toolCall.id || null
                            });
                            toolResults.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                name: toolName,
                                content: JSON.stringify({ success: false, error: "引数のパースに失敗しました" })
                            });
                            continue;
                        }

                        try {
                            aiTool.getToolDefinition(toolName);
                        } catch (e) {
                            await logToolInvocationError({
                                toolName,
                                parameters: args,
                                errorCode: 'unsupported_tool',
                                message: `未対応のツールです: ${toolName}`,
                                toolCallId: toolCall.id || null
                            });
                            toolResults.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                name: toolName,
                                content: JSON.stringify({ success: false, error: "未対応のツールです" })
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
                        let hasDisplayedMessage = false;
                        
                        // result.message（単数形）を優先的に表示
                        if (result.message) {
                            chat.addMessage(result.message, "system");
                            hasDisplayedMessage = true;
                        }
                        
                        // result.messages（複数形配列）がある場合は追加で表示
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
                            hasDisplayedMessage = true;
                        }
                        
                        // スクロール位置を更新
                        if (hasDisplayedMessage && chat.content && chat.content.element) {
                            chat.content.element.scrollTop = chat.content.element.scrollHeight;
                        }
                        
                        // 結果をチャットに表示（デフォルトメッセージ）
                        if (result.success) {
                            // カスタムメッセージがない場合のみデフォルトメッセージを表示
                            if (!hasDisplayedMessage) {
                                chat.addMessage(`✅ ツール実行完了: ${toolName}`, "system");
                            }
                        } else {
                            // 失敗時は常にエラーメッセージを表示（messageがあってもエラー詳細を追加）
                            if (!hasDisplayedMessage) {
                                chat.addMessage(`❌ ツール実行失敗: ${toolName} - ${result.error || '不明なエラー'}`, "system");
                            }
                        }
                        // スクロール位置を更新
                        if (chat.content && chat.content.element) {
                            chat.content.element.scrollTop = chat.content.element.scrollHeight;
                        }
                        
                        // ツール実行結果を履歴に追加
                        const historyMeta = sanitizeToolHistoryMeta(result?.historyMeta, toolName);
                        const toolContent = (result && typeof result === 'object' && !Array.isArray(result))
                            ? (() => {
                                const { historyMeta, ...resultForModel } = result;
                                return JSON.stringify(resultForModel);
                            })()
                            : JSON.stringify(result);

                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: toolName,
                            content: toolContent,
                            history_meta: historyMeta
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
                        
                        // ツール実行結果を履歴に追加（圧縮処理を適用）
                        for (const toolResult of toolResults) {
                            // ツール結果の圧縮処理
                            const compressedResult = compressToolResult(toolResult);
                            // ツールメッセージ全体をそのまま追加
                            historyManager.addMessage("tool", compressedResult);
                        }
                        
                        // AIに再度問い合わせ（ツール実行結果を含む）
                        historyManager.setStreaming(true);
                        aiMsgBuffer = "";
                        toolCallsBuffer = {};
                            let toolRequestStats = null;
                        
                        chat.addMessage("", "ai", true);
                        
                        await fetchAIChat({
                            messages: historyManager.getHistoryForAPI(),
                            model: selectedModel,
                            fileContext: null,  // ツール実行後は常にnull
                            dirContext: null,   // ツール実行後は常にnull
                            tools: tools,
                            signal: controller.signal,
                            smoothOutput: true,
                            customUrl: customUrl,
                            customApiKey: customApiKey,
                            customPrompt: customPrompt, // ベースプロンプトを渡す
                            onComplete: (stats) => {
                                toolRequestStats = stats;
                                // ツール実行後の応答でも統計情報を表示
                                if (chat.addStatsToLastAIMessage) {
                                    chat.addStatsToLastAIMessage(stats);
                                }
                                // HistoryManagerの最後のassistantメッセージにstatsを追加
                                // （tool_callsがないメッセージのみ）
                                const history = historyManager.getHistory();
                                for (let i = history.length - 1; i >= 0; i--) {
                                    if (history[i].role === 'assistant') {
                                        // tool_callsがあるメッセージはスキップ
                                        if (history[i].tool_calls && history[i].tool_calls.length > 0) {
                                            continue;
                                        }
                                        // contentがあるメッセージにのみstatsを保存
                                        if (history[i].content) {
                                            history[i]._stats = stats;
                                            historyManager.saveChatHistory();
                                            break;
                                        }
                                    }
                                }
                            },
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
                            if (toolRequestStats && toolRequestStats.wasEmptyResponse) {
                                chat.updateLastAIMessage('<span style="color:red">AI応答が空でした。再試行しても応答が得られませんでした。</span>', true);
                                historyManager.setStreaming(false);
                                if (typeof chat.hideLoading === 'function') chat.hideLoading();
                                return;
                            }

                            // 2回目以降のツール呼び出しを処理
                            await processToolCalls(depth + 1);
                            
                            // すべてのツール実行が完了したら終了処理
                            if (Object.keys(toolCallsBuffer).length === 0) {
                                finalizeAssistantResponse();
                            }
                        });
                    }
                };
                
                // 最初のツール呼び出しを処理
                await processToolCalls(0);
                
                // ツール呼び出しがない場合は通常の終了処理
                if (Object.keys(toolCallsBuffer).length === 0) {
                    finalizeAssistantResponse();
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
